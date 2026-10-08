// 플레이어 봇: 플레이어가 보는 것(playerView)과 지도만 보고, 명령 하나씩을 고른다.
// 실제 상태(일꾼 수, 다른 마을의 오늘 시세)는 보지 않는다. 사람이 하듯이 기억과 지금 마을 시세로 판단한다.
import { unitWeight } from '../cart';
import { ECONOMY } from '../constants';
import type { Command, GoodId, PlayerView } from '../economy';
import { FOODS, GOODS, shelfLife } from '../economy';
import type { Rng } from '../rng';
import type { Season } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';
import { cardById } from '../expedition';
import type { BotProfile } from './profiles';

/** 봇이 날을 넘겨 기억하는 것 (게임 상태가 아니라 봇의 머릿속) */
export interface BotMind {
  /** 사서 어디로 가져갈지 */
  plan: { good: GoodId; to: number } | null;
  /** 오늘 한 일 (날이 바뀌면 다시 센다) */
  day: number;
  expeditionsToday: number;
  /** 오늘 이미 해 본 명령 (실패한 것을 되풀이하지 않게) */
  tried: Set<string>;
}

export function createMind(): BotMind {
  return { plan: null, day: -1, expeditionsToday: 0, tried: new Set() };
}

/** 이 정도 지난 기억은 믿지 않는다 */
const MEMORY_TRUST_DAYS = 30;
/** 이보다 오래 못 본 마을은 둘러볼 만하다 */
const STALE_DAYS = 15;
/** 이보다 빨리 상하는 물건은 사서 옮기지 않는다 (산 묶음이 얼마나 묵었는지 모른다) */
const MIN_TRADE_SHELF_LIFE = 10;

/** 마을 사이 이동 일수는 지도와 계절로 정해진다 (계산이 무거워 기억해 둔다) */
const daysCache = new WeakMap<WorldMap, Map<Season, number[][]>>();
function travelDays(map: WorldMap, season: Season): number[][] {
  let bySeason = daysCache.get(map);
  if (!bySeason) daysCache.set(map, (bySeason = new Map()));
  let days = bySeason.get(season);
  if (!days) bySeason.set(season, (days = townTravelDays(map, season)));
  return days;
}

/** 오늘 할 다음 명령. 할 게 없으면 null */
export function botStep(view: PlayerView, map: WorldMap, profile: BotProfile, mind: BotMind, rng: Rng): Command | null {
  if (mind.day !== view.day) {
    mind.day = view.day;
    mind.expeditionsToday = 0;
    mind.tried.clear();
  }
  const once = (cmd: Command): Command | null => {
    const key = JSON.stringify(cmd);
    if (mind.tried.has(key)) return null;
    mind.tried.add(key);
    return cmd;
  };

  // 원정 중: 카드마다 고른다
  if (view.expedition) return once(chooseCard(view)) ?? once({ type: 'endExpedition' });
  if (view.location.kind !== 'town' || !view.market) return null;
  const here = view.location.town;
  const price = view.market.price;
  const days = travelDays(map, view.season);

  // 1. 지쳤으면 먹고, 그래도 많이 지쳤으면 여관
  if (view.fatigue >= profile.restAt && view.mealsLeft > 0) {
    const food = oldestFood(view);
    if (food) {
      const c = once({ type: 'eat', good: food });
      if (c) return c;
    }
  }
  if (view.fatigue >= profile.restAt + 2 && view.inn && !view.inn.rested && view.gold > view.inn.fee * 6) {
    const c = once({ type: 'restAtInn' });
    if (c) return c;
  }

  // 2. 원정
  if (
    profile.expeditions &&
    view.canExpedition &&
    view.expeditionChances > 0 &&
    mind.expeditionsToday < profile.expeditionsPerDay &&
    view.fatigue < profile.restAt &&
    view.cart.weight < view.cart.maxWeight * 0.8
  ) {
    const c = once({ type: 'startExpedition' });
    if (c) {
      mind.expeditionsToday++;
      return c;
    }
  }

  // 3. 짐 팔기: 다른 마을에 가져가도 더 남지 않으면 여기서 판다
  const selling = new Set(view.orders.filter((o) => o.side === 'sell').map((o) => o.good));
  for (const good of GOODS) {
    const qty = sellableQty(view, good);
    if (qty === 0 || selling.has(good)) continue;
    // 사 온 물건은 가져갈 마을에 닿으면 판다. 원정 물건은 더 비싼 곳이 없으면 여기서
    const arrived = mind.plan?.good === good && mind.plan.to === here;
    const planned = mind.plan?.good === good && mind.plan.to !== here;
    const best = bestKnownPrice(view, good, here, days, qty);
    if (planned) continue;
    if (!arrived && best && best.net > price[good] * (1 + profile.minMargin) && profile.trades) continue;
    const c = once({ type: 'placeSellOrder', good, qty, minPrice: Math.max(1, Math.round(price[good] * 0.85)) });
    if (c) {
      if (mind.plan?.good === good) mind.plan = null;
      return c;
    }
  }

  const buying = view.orders.some((o) => o.side === 'buy');
  // 너무 무거우면 떠날 수 없다: 계획한 물건이 아닌 것부터 여기서 판다
  const overweight = view.cart.weight > view.cart.maxWeight;
  if (overweight) {
    for (const good of GOODS) {
      const qty = sellableQty(view, good);
      if (qty === 0 || selling.has(good) || mind.plan?.good === good) continue;
      const c = once({ type: 'placeSellOrder', good, qty, minPrice: Math.max(1, Math.round(price[good] * 0.7)) });
      if (c) return c;
    }
  }
  const cargo = view.cargo.reduce((s, l) => s + l.qty, 0);

  // 4. 사서 옮길 물건: 기억하는 다른 마을 시세가 여기보다 충분히 높으면
  if (profile.trades && !buying && cargo === 0 && !mind.plan) {
    const deal = bestDeal(view, map, here, days, profile);
    if (deal) {
      const c = once({ type: 'placeBuyOrder', good: deal.good, qty: deal.qty, maxPrice: deal.maxPrice });
      if (c) {
        mind.plan = { good: deal.good, to: deal.to };
        return c;
      }
    }
  }

  // 5. 떠나기: 산 물건을 실었으면 가져갈 마을로
  if (!buying && !overweight && selling.size === 0 && mind.plan && mind.plan.to !== here && cargo > 0) {
    const c = once({ type: 'travel', to: mind.plan.to });
    if (c) return c;
  }
  // 사려던 것을 못 샀으면 계획을 버린다
  if (mind.plan && !buying && cargo === 0) mind.plan = null;

  // 6. 할 일이 없으면 가끔 시세를 모른 지 오래된 마을로 둘러보러 간다
  if (!buying && !overweight && selling.size === 0 && cargo === 0 && rng.next() < profile.explore) {
    const stale = map.towns
      .filter((t) => t.id !== here && Number.isFinite(days[here]![t.id]!))
      .filter((t) => view.day - (view.memory[t.id]?.day ?? -Infinity) > STALE_DAYS)
      .sort((a, b) => (view.memory[a.id]?.day ?? -1) - (view.memory[b.id]?.day ?? -1))[0];
    const fee = stale ? days[here]![stale.id]! * ECONOMY.player.travelFeePerDay : Infinity;
    if (stale && view.gold > fee * 3) {
      const c = once({ type: 'travel', to: stale.id });
      if (c) return c;
    }
  }
  return null;
}

/** 피로 1을 금화로 치면 (음식 한 끼쯤) */
const FATIGUE_COST = 3;

/**
 * 카드 선택: 얻는 물건 값 × 성공 가능성 − 피로 값이 가장 큰 것.
 * 카드에 적힌 결과는 화면에 보이는 정보로 보고(숙련된 플레이어), 성공 확률은 화면 힌트(높음/반반/낮음)만 쓴다
 */
function chooseCard(view: PlayerView): Command {
  const ex = view.expedition!;
  const card = cardById(ex.card.id);
  const prices = view.market?.price ?? view.memory[ex.town]?.prices;
  let best = 0;
  let bestScore = -Infinity;
  card.choices.forEach((c, i) => {
    const hint = ex.card.choices[i]?.hint ?? '';
    const odds = hint.includes('높음') ? 0.8 : hint.includes('반반') ? 0.55 : hint.includes('낮음') ? 0.3 : 1;
    let gain = 0;
    for (const e of c.success) if (e.kind === 'goods') gain += ((e.min + e.max) / 2) * (prices?.[e.good] ?? 5);
    for (const e of c.failure ?? []) if (e.kind === 'loseHaul') gain -= (1 - odds) * 5;
    const over = view.fatigue + c.fatigue > view.fatigueMax ? -100 : 0;
    const score = gain * odds - c.fatigue * FATIGUE_COST + over;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return { type: 'chooseExpeditionCard', choice: best };
}

function oldestFood(view: PlayerView): GoodId | null {
  let pick: GoodId | null = null;
  let left = Infinity;
  for (const l of view.cargo) {
    if (!FOODS.includes(l.good)) continue;
    const remain = (shelfLife(l.good) ?? 1e6) - l.age;
    if (remain < left) {
      left = remain;
      pick = l.good;
    }
  }
  return pick;
}

/** 오늘 장에 낼 수 있는 양 (내일이면 상할 것은 못 낸다) */
function sellableQty(view: PlayerView, good: GoodId): number {
  const life = shelfLife(good);
  const rate = ECONOMY.spoilRate[view.season];
  return view.cargo.filter((l) => l.good === good && (life === null || l.age + rate < life)).reduce((s, l) => s + l.qty, 0);
}

/** 기억하는 다른 마을 시세에서 가는 비용을 뺀, 물건 하나당 값이 가장 높은 곳 */
function bestKnownPrice(
  view: PlayerView,
  good: GoodId,
  here: number,
  days: number[][],
  qty: number,
): { town: number; net: number } | null {
  let best: { town: number; net: number } | null = null;
  for (const [id, mem] of Object.entries(view.memory)) {
    const town = Number(id);
    const d = days[here]![town]!;
    if (town === here || !Number.isFinite(d) || view.day - mem.day > MEMORY_TRUST_DAYS) continue;
    const life = shelfLife(good);
    if (life !== null && life <= d * ECONOMY.spoilRate[view.season] + 1) continue;
    const net = mem.prices[good] - (d * ECONOMY.player.travelFeePerDay) / Math.max(1, qty);
    if (!best || net > best.net) best = { town, net };
  }
  return best;
}

/** 여기서 사서 기억하는 마을에 가져가 팔 가장 남는 거래 */
function bestDeal(
  view: PlayerView,
  map: WorldMap,
  here: number,
  days: number[][],
  profile: BotProfile,
): { good: GoodId; qty: number; maxPrice: number; to: number } | null {
  const market = view.market!;
  let best: { good: GoodId; qty: number; maxPrice: number; to: number; profit: number } | null = null;
  const freeWeight = view.cart.maxWeight - view.cart.weight;
  for (const good of GOODS) {
    if ((shelfLife(good) ?? Infinity) < MIN_TRADE_SHELF_LIFE) continue;
    const buy = market.price[good];
    const maxPrice = Math.max(1, Math.round(buy * 1.1));
    // 어제 이 마을에 팔려고 나온 만큼만 살 수 있다고 본다
    const supply = market.yesterday[good].supply;
    const qty = Math.min(
      view.cart.room[good],
      Math.floor(freeWeight / unitWeight(good)),
      Math.floor((view.gold * 0.8) / maxPrice),
      Math.floor(supply * 0.5),
    );
    if (qty <= 0) continue;
    const target = bestKnownPrice(view, good, here, days, qty);
    if (!target || !map.towns[target.town]) continue;
    const profit = (target.net * 0.9 - maxPrice) * qty;
    if (target.net * 0.9 < maxPrice * (1 + profile.minMargin)) continue;
    if (!best || profit > best.profit) best = { good, qty, maxPrice, to: target.town, profit };
  }
  return best;
}
