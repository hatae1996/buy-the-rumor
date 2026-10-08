// 플레이어 봇: 플레이어가 보는 것(playerView)과 지도만 보고, 명령 하나씩을 고른다.
// 실제 상태(일꾼 수, 다른 마을의 오늘 시세)는 보지 않는다. 사람이 하듯이 기억과 지금 마을 시세로 판단한다.
import { unitWeight } from '../cart';
import { ECONOMY, HORSES } from '../constants';
import type { Command, GoodId, PlayerView } from '../economy';
import { FOODS, GOODS, shelfLife } from '../economy';
import type { Rng } from '../rng';
import { townTravelDays, type WorldMap } from '../worldgen';
import { cardById } from '../expedition';
import { caravanPlanStep, createGrowthMind, growthStep, noteDay, noteMissing, type GrowthMind } from './growth';
import { bigOrderSell, bigPlanStep, bigTarget, holdForBigOrder, updateBigPlan, type BigPlan } from './bigOrder';
import type { BotProfile } from './profiles';

/** 봇이 날을 넘겨 기억하는 것 (게임 상태가 아니라 봇의 머릿속) */
export interface BotMind {
  /** 사서 어디로 가져갈지. 수레가 찰 때까지 며칠(days) 여러 물건을 산다 */
  plan: { goods: GoodId[]; to: number; days: number } | null;
  /** 오늘 한 일 (날이 바뀌면 다시 센다) */
  day: number;
  expeditionsToday: number;
  /** 오늘 이미 해 본 명령 (실패한 것을 되풀이하지 않게) */
  tried: Set<string>;
  /** 살 것 고르기에 쓰는 기억 (수레가 찼던 날, 못 고른 선택지, 원정 값) */
  growth: GrowthMind;
  /** 징조를 듣고 노리는 큰 주문 (0.0.7): 그 마을에 그 물품을 미리 모아 간다 */
  bigPlan: BigPlan | null;
}

export function createMind(): BotMind {
  return { plan: null, day: -1, expeditionsToday: 0, tried: new Set(), growth: createGrowthMind(), bigPlan: null };
}

/** 이 정도 지난 기억은 믿지 않는다 */
const MEMORY_TRUST_DAYS = 30;
/** 이보다 오래 못 본 마을은 둘러볼 만하다 */
const STALE_DAYS = 15;
/** 이보다 빨리 상하는 물건은 사서 옮기지 않는다 (산 묶음이 얼마나 묵었는지 모른다) */
const MIN_TRADE_SHELF_LIFE = 10;
/** 장사하는 봇은 시세를 아는 다른 마을이 이만큼 될 때까지 둘러본다 */
const SCOUT_TOWNS = 3;
/** 한 마을에서 며칠까지 사 모으나 (장날마다 나오는 양이 적으면 며칠에 걸쳐 수레를 채운다) */
const BUY_DAYS = 4;
/** 수레가 이만큼 차면 떠난다 (무게 비율) */
const LOAD_FULL = 0.8;
/** 한 번 실어 가서 팔 수 있다고 보는 양 (수레를 키울지 셈할 때) */
const TRIP_SELL_CAP = 25;
/** 사 모을 때 여비 말고도 남기는 돈 */
const TRIP_RESERVE = 20;

/** 오늘 할 다음 명령. 할 게 없으면 null */
export function botStep(view: PlayerView, map: WorldMap, profile: BotProfile, mind: BotMind, rng: Rng): Command | null {
  if (mind.day !== view.day) {
    mind.day = view.day;
    mind.expeditionsToday = 0;
    mind.tried.clear();
    noteDay(view, mind.growth);
    mind.bigPlan = updateBigPlan(view, mind.bigPlan, profile);
  }
  const once = (cmd: Command): Command | null => {
    const key = JSON.stringify(cmd);
    if (mind.tried.has(key)) return null;
    mind.tried.add(key);
    return cmd;
  };

  // 원정 중: 카드마다 고른다
  if (view.expedition) return once(chooseCard(view, mind)) ?? once({ type: 'endExpedition' });
  if (view.location.kind !== 'town' || !view.market) return null;
  const here = view.location.town;
  const price = view.market.price;
  // 신문에 실린 막힌 길은 돌아간다
  const days = townTravelDays(map, view.season, new Set(view.roads.blocked));

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

  // 살 것 고르기 (말, 수레, 일꾼, 창고, 두 번째 행렬, 장비)
  if (profile.growth) {
    const c = growthStep(view, profile.growth, mind.growth, once) ?? (caravanPlanStep(view) && once(caravanPlanStep(view)!));
    if (c) return c;
  }

  // 장사할 짐을 다 모았으면 원정보다 떠나기가 먼저다 (원정 기회는 날마다 생겨 기다리면 끝이 없다)
  const fillNow = view.cart.weight / Math.max(1, view.cart.maxWeight);
  const tripReady =
    mind.plan !== null && mind.plan.to !== here && (mind.plan.days >= BUY_DAYS || fillNow >= LOAD_FULL) && !view.orders.some((o) => o.side === 'buy');

  // 2. 원정
  if (
    !tripReady &&
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

  // 원정만 하는 봇이 원정할 수 없는 마을(도시)에 있으면, 길로 가장 가까운 자원지 마을로 간다 (지도의 특산으로 안다)
  if (profile.expeditions && !profile.trades && !view.canExpedition && view.orders.length === 0) {
    const c = goToResourceTown(view, map, here, days, once);
    if (c) return c;
  }

  // 3. 짐 팔기: 다른 마을에 가져가도 더 남지 않으면 여기서 판다
  const selling = new Set(view.orders.filter((o) => o.side === 'sell').map((o) => o.good));
  // 큰 주문 (0.0.7): 그 마을에 와 있고 주문이 열렸으면 주문 값으로 판다
  {
    const c = bigOrderSell(view, mind.bigPlan, selling, sellableQty, once);
    if (c) {
      if (mind.plan && mind.bigPlan?.goods.some((g) => mind.plan!.goods.includes(g))) mind.plan = null;
      return c;
    }
  }
  for (const good of GOODS) {
    const qty = sellableQty(view, good) - (good === 'grain' ? feedKeep(view) : 0);
    if (qty <= 0 || selling.has(good)) continue;
    // 큰 주문을 노리고 모은 물건은 그 주문에만 판다
    if (holdForBigOrder(view, mind.bigPlan, good)) continue;
    // 사 온 물건은 가져갈 마을에 닿으면 판다. 원정 물건은 더 비싼 곳이 없으면 여기서
    const mine = mind.plan?.goods.includes(good) ?? false;
    const arrived = mine && mind.plan!.to === here;
    const planned = mine && mind.plan!.to !== here;
    const best = bestKnownPrice(view, good, here, days, qty, null, mind.bigPlan);
    if (planned) continue;
    if (!arrived && best && best.net > price[good] * (1 + profile.minMargin) && profile.trades) {
      // 더 비싸게 팔 마을이 있으면 그리로 가져간다 (계획이 없으면 세운다: 짐을 든 채 멈추지 않게)
      if (!mind.plan) mind.plan = { goods: [good], to: best.town, days: BUY_DAYS };
      continue;
    }
    const c = once({ type: 'placeSellOrder', good, qty, minPrice: Math.max(1, Math.round(price[good] * 0.85)) });
    if (c) return c;
  }

  // 큰 주문 노리기 (0.0.7): 장사보다 먼저. 모으는 동안과 기다리는 동안은 그 마을로 가는 장사 계획으로 둔다
  if (profile.trades) {
    const big = bigPlanStep(view, mind.bigPlan, days, once);
    // 떠날 때(go)가 아니면 사 모으는 날로 둔다 (수레가 차거나 떠날 때가 되면 떠난다)
    if (big.trip) mind.plan = { goods: big.trip.goods, to: big.trip.to, days: big.trip.go ? BUY_DAYS : 0 };
    if (big.command) return big.command;
  }

  const buying = view.orders.some((o) => o.side === 'buy');
  // 너무 무거우면 떠날 수 없다: 계획한 물건이 아닌 것부터 여기서 판다
  const overweight = view.cart.weight > view.cart.maxWeight;
  if (overweight) {
    for (const good of GOODS) {
      const qty = sellableQty(view, good) - (good === 'grain' ? feedKeep(view) : 0);
      if (qty <= 0 || selling.has(good) || mind.plan?.goods.includes(good)) continue;
      const c = once({ type: 'placeSellOrder', good, qty, minPrice: Math.max(1, Math.round(price[good] * 0.7)) });
      if (c) return c;
    }
    // 덜어 낼 다른 짐이 없으면 계획한 물건이라도 넘친 만큼 판다
    if (selling.size === 0) {
      for (const good of mind.plan?.goods ?? []) {
        const over = Math.ceil((view.cart.weight - view.cart.maxWeight) / unitWeight(good));
        const qty = Math.min(over, sellableQty(view, good));
        if (qty <= 0) continue;
        const c = once({ type: 'placeSellOrder', good, qty, minPrice: Math.max(1, Math.round(price[good] * 0.7)) });
        if (c) return c;
      }
    }
  }
  // 말 먹이로 남겨 둔 곡물은 짐으로 치지 않는다 (그 때문에 다음 장사를 못 하지 않게)
  const grainHeld = view.haul.filter((l) => l.good === 'grain').reduce((s, l) => s + l.qty, 0);
  const cargo = view.haul.reduce((s, l) => s + l.qty, 0) - Math.min(grainHeld, feedKeep(view));

  // 4. 사서 옮길 물건: 기억하는 다른 마을 시세가 여기보다 충분히 높으면.
  // 한 번에 다 못 사면 수레가 찰 때까지 며칠 더 산다 (같은 마을로 가져갈 물건이면 다른 물건도)
  const fill = view.cart.weight / Math.max(1, view.cart.maxWeight);
  const loading = mind.plan !== null && mind.plan.to !== here && mind.plan.days < BUY_DAYS && fill < LOAD_FULL;
  if (profile.trades && !buying && ((cargo === 0 && !mind.plan) || loading)) {
    const deal = bestDeal(view, map, here, days, profile, loading ? mind.plan!.to : null, mind.bigPlan);
    if (deal) {
      const c = once({ type: 'placeBuyOrder', good: deal.good, qty: deal.qty, maxPrice: deal.maxPrice });
      if (c) {
        // 수레가 작아 못 산 몫은 말·큰 수레를 살 이유가 된다 (원정에서 짐을 두고 온 것과 같게 센다)
        if (deal.capped > 0) mind.growth.capped.push({ day: view.day, value: deal.capped });
        if (mind.plan) {
          if (!mind.plan.goods.includes(deal.good)) mind.plan.goods.push(deal.good);
          mind.plan.days++;
        } else mind.plan = { goods: [deal.good], to: deal.to, days: 1 };
        return c;
      }
    } else if (loading) mind.plan!.days = BUY_DAYS;
  }

  // 5. 떠나기: 산 물건을 실었으면 가져갈 마을로 (말이 있으면 길에서 먹일 곡물부터)
  const loaded = mind.plan !== null && (mind.plan.days >= BUY_DAYS || fill >= LOAD_FULL);
  // 여비가 없으면 계획을 접는다 (다음 차례에 여기서 판다)
  if (mind.plan && mind.plan.to !== here && loaded && !buying && view.gold < (days[here]![mind.plan.to]! ?? 0) * ECONOMY.player.travelFeePerDay) mind.plan = null;
  if (!buying && !overweight && selling.size === 0 && mind.plan && mind.plan.to !== here && cargo > 0 && loaded) {
    const c = once(feedFor(view, mind.plan.to) ?? { type: 'travel', to: mind.plan.to });
    if (c) return c;
  }
  // 사려던 것을 못 샀으면 계획을 버린다
  if (mind.plan && !buying && cargo === 0) mind.plan = null;

  // 7. 장사하는 봇이 아는 마을이 적으면 먼저 둘러본다 (도시를 먼저: 지도에 크게 보이고 물건을 많이 산다)
  // 6. 여기서 살 것이 없으면 기억하는 시세로 "어디서 사서 어디에 팔지"를 정해 살 마을로 간다
  let noSource = false;
  if (profile.trades && !buying && !overweight && selling.size === 0 && cargo === 0 && !mind.plan) {
    const from = bestSource(view, map, here, days, profile);
    if (from !== null) {
      const c = once(feedFor(view, from) ?? { type: 'travel', to: from });
      if (c) return c;
    } else noSource = true;
  }

  // 시세는 장날을 겪어야 기억에 남으니, 이 마을 장날을 한 번은 보고 떠난다
  const sawHere = (view.memory[here]?.day ?? -Infinity) >= view.day - 1;

  // 원정도 하는 봇이 원정할 수 없는 마을에서 장사거리도 없으면 가까운 자원지 마을로 간다 (놀면서 말 먹이만 내지 않게)
  if (profile.expeditions && sawHere && !view.canExpedition && !buying && !overweight && selling.size === 0 && cargo === 0 && !mind.plan) {
    const c = goToResourceTown(view, map, here, days, once);
    if (c) return c;
  }
  if (profile.trades && sawHere && !buying && !overweight && selling.size === 0 && cargo === 0 && !mind.plan) {
    const known = Object.entries(view.memory).filter(([id, m]) => Number(id) !== here && view.day - m.day <= MEMORY_TRUST_DAYS).length;
    // 아는 길에 남는 장사가 없으면 가장 오래 못 본 마을을 둘러본다 (원정할 수 있는 마을이면 원정하며 기다린다)
    const rescout = noSource && !(profile.expeditions && view.canExpedition);
    if (known < SCOUT_TOWNS || rescout) {
      const unknown = map.towns
        .filter((t) => t.id !== here && Number.isFinite(days[here]![t.id]!) && (rescout || view.day - (view.memory[t.id]?.day ?? -Infinity) > MEMORY_TRUST_DAYS))
        .sort(
          (a, b) =>
            (known < SCOUT_TOWNS ? Number(b.tier === 'city') - Number(a.tier === 'city') : 0) ||
            (view.memory[a.id]?.day ?? -Infinity) - (view.memory[b.id]?.day ?? -Infinity) ||
            days[here]![a.id]! - days[here]![b.id]!,
        )[0];
      const fee = unknown ? days[here]![unknown.id]! * ECONOMY.player.travelFeePerDay : Infinity;
      if (unknown && view.gold > fee * 3) {
        const c = once(feedFor(view, unknown.id) ?? { type: 'travel', to: unknown.id });
        if (c) return c;
      }
    }
  }

  // 8. 할 일이 없으면 가끔 시세를 모른 지 오래된 마을로 둘러보러 간다
  if (!buying && !overweight && selling.size === 0 && cargo === 0 && rng.next() < profile.explore) {
    const stale = map.towns
      .filter((t) => t.id !== here && Number.isFinite(days[here]![t.id]!))
      .filter((t) => view.day - (view.memory[t.id]?.day ?? -Infinity) > STALE_DAYS)
      .sort((a, b) => (view.memory[a.id]?.day ?? -1) - (view.memory[b.id]?.day ?? -1))[0];
    const fee = stale ? days[here]![stale.id]! * ECONOMY.player.travelFeePerDay : Infinity;
    if (stale && view.gold > fee * 3) {
      const c = once(feedFor(view, stale.id) ?? { type: 'travel', to: stale.id });
      if (c) return c;
    }
  }
  return null;
}

/** 길로 가장 가까운 자원지 마을로 (지도의 특산으로 안다) */
function goToResourceTown(view: PlayerView, map: WorldMap, here: number, days: number[][], once: (c: Command) => Command | null): Command | null {
  const near = map.towns
    .filter((t) => t.id !== here && t.specialties.length > 0 && Number.isFinite(days[here]![t.id]!))
    .sort((a, b) => days[here]![a.id]! - days[here]![b.id]!)[0];
  if (!near) return null;
  return once(feedFor(view, near.id) ?? { type: 'travel', to: near.id });
}

/** 피로 1을 금화로 치면 (음식 한 끼쯤) */
const FATIGUE_COST = 3;

/**
 * 카드 선택: 얻는 물건 값 × 성공 가능성 − 피로 값이 가장 큰 것.
 * 카드에 적힌 결과는 화면에 보이는 정보로 보고(숙련된 플레이어), 성공 확률은 화면 힌트(높음/반반/낮음)만 쓴다
 */
function chooseCard(view: PlayerView, mind: BotMind): Command {
  const ex = view.expedition!;
  const card = cardById(ex.card.id);
  // 장비가 없어 빠진 선택지를 기억한다 (다음에 살 이유)
  const shownIdx = new Set(ex.card.choices.map((c) => c.index));
  noteMissing(mind.growth, card.choices.filter((_, i) => !shownIdx.has(i)).map((c) => c.needs ?? {}));
  const prices = view.market?.price ?? view.memory[ex.town]?.prices;
  let best = ex.card.choices.find((c) => !c.disabled)?.index ?? 0;
  let bestScore = -Infinity;
  // 보이는 선택지 중 고를 수 있는 것만 (장비·말이 없으면 안 보이고, 도구가 없으면 못 고른다)
  for (const shown of ex.card.choices) {
    if (shown.disabled) continue;
    const i = shown.index;
    const c = card.choices[i]!;
    const hint = shown.hint;
    const odds = hint.includes('높음') ? 0.8 : hint.includes('반반') ? 0.55 : hint.includes('낮음') ? 0.3 : 1;
    let gain = 0;
    for (const e of c.success) if (e.kind === 'goods') gain += ((e.min + e.max) / 2) * (prices?.[e.good] ?? 5);
    for (const e of c.failure ?? []) if (e.kind === 'loseHaul') gain -= (1 - odds) * 5;
    // 쓰는 도구 값도 셈에 넣는다 (도구는 소모품)
    if (c.needs?.tool) gain -= (c.needs.tool * (prices?.tools ?? 60)) / ECONOMY.expedition.usesPerTool;
    const over = view.fatigue + c.fatigue > view.fatigueMax ? -100 : 0;
    const score = gain * odds - c.fatigue * FATIGUE_COST + over;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return { type: 'chooseExpeditionCard', choice: best };
}

/**
 * 말을 데리고 길을 떠나기 전: 길에서 먹일 곡물이 모자라면 먼저 산다 (마을 밖에서는 수레 곡물을 먹는다).
 * 말은 사흘 굶어야 도망가니 이틀 길은 그냥 가고, 이 마을 장에 곡물이 안 나오면 사지 않고 간다
 */
function feedFor(view: PlayerView, to: number): Command | null {
  if (!view.horses.length || !view.market) return null;
  const days = view.travel.days[to] ?? 0;
  if (days < HORSES.runAwayAfterHungryDays || view.market.yesterday.grain.supply === 0) return null;
  const need = Math.ceil(view.horses.reduce((s, h) => s + h.feed, 0) * days);
  const have = view.cargo.filter((l) => l.good === 'grain').reduce((s, l) => s + l.qty, 0);
  if (have >= need || view.orders.some((o) => o.side === 'buy' && o.good === 'grain')) return null;
  // 수레에 자리가 없으면 그냥 간다 (가는 마을 마구간에서 먹는다)
  const qty = Math.min(need - have, view.buyRoom.grain);
  if (qty <= 0) return null;
  const maxPrice = Math.max(1, Math.round(view.market.price.grain * 1.3));
  return { type: 'placeBuyOrder', good: 'grain', qty, maxPrice };
}

/** 말 먹이로 남겨 두는 곡물 (가장 먼 마을까지 갈 만큼) */
function feedKeep(view: PlayerView): number {
  if (!view.horses.length) return 0;
  const far = Math.max(0, ...view.travel.days.filter(Number.isFinite));
  return Math.ceil(view.horses.reduce((s, h) => s + h.feed, 0) * far);
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
  return view.haul.filter((l) => l.good === good && (life === null || l.age + rate < life)).reduce((s, l) => s + l.qty, 0);
}

/** 기억하는 다른 마을 시세에서 가는 비용을 뺀, 물건 하나당 값이 가장 높은 곳 */
function bestKnownPrice(
  view: PlayerView,
  good: GoodId,
  here: number,
  days: number[][],
  qty: number,
  only: number | null = null,
  big: BigPlan | null = null,
): { town: number; net: number } | null {
  let best: { town: number; net: number } | null = null;
  for (const [id, mem] of Object.entries(view.memory)) {
    const town = Number(id);
    if (only !== null && town !== only) continue;
    const d = days[here]![town]!;
    if (town === here || !Number.isFinite(d) || view.day - mem.day > MEMORY_TRUST_DAYS) continue;
    const life = shelfLife(good);
    if (life !== null && life <= d * ECONOMY.spoilRate[view.season] + 1) continue;
    const net = mem.prices[good] - (d * ECONOMY.player.travelFeePerDay) / Math.max(1, qty);
    if (!best || net > best.net) best = { town, net };
  }
  // 노리는 큰 주문: 그 마을은 주문 값에 사 준다고 본다 (가 본 적이 없어도)
  const target = bigTarget(big, good);
  if (target && target.town !== here && (only === null || only === target.town) && Number.isFinite(days[here]![target.town]!)) {
    const net = target.price - (days[here]![target.town]! * ECONOMY.player.travelFeePerDay) / Math.max(1, qty);
    if (!best || net > best.net) best = { town: target.town, net };
  }
  return best;
}

/**
 * 다른 마을에서 사서 또 다른 마을(또는 여기)에 팔 가장 남는 길: 기억하는 시세만 본다.
 * 살 마을로 가는 길값과 팔 마을로 가는 길값을 빼고도 남으면 살 마을을 돌려준다
 */
function bestSource(view: PlayerView, map: WorldMap, here: number, days: number[][], profile: BotProfile): number | null {
  const fresh = Object.entries(view.memory)
    .map(([id, m]) => ({ town: Number(id), prices: m.prices, day: m.day }))
    .filter((m) => view.day - m.day <= MEMORY_TRUST_DAYS && Number.isFinite(days[here]![m.town]!));
  const fee = ECONOMY.player.travelFeePerDay;
  let best: { town: number; profit: number } | null = null;
  for (const a of fresh) {
    if (a.town === here) continue;
    for (const b of fresh) {
      if (b.town === a.town || !Number.isFinite(days[a.town]![b.town]!)) continue;
      for (const good of GOODS) {
        if ((shelfLife(good) ?? Infinity) < MIN_TRADE_SHELF_LIFE) continue;
        const buy = a.prices[good] * 1.1;
        const sell = b.prices[good] * 0.9;
        if (sell < buy * (1 + profile.minMargin)) continue;
        const qty = Math.min(Math.floor(view.cart.maxWeight / unitWeight(good)), Math.floor((view.gold * 0.8) / buy));
        const profit = (sell - buy) * qty - (days[here]![a.town]! + days[a.town]![b.town]!) * fee;
        if (profit > 0 && (!best || profit > best.profit)) best = { town: a.town, profit };
      }
    }
  }
  void map;
  return best?.town ?? null;
}

/** 여기서 사서 기억하는 마을에 가져가 팔 가장 남는 거래 */
function bestDeal(
  view: PlayerView,
  map: WorldMap,
  here: number,
  days: number[][],
  profile: BotProfile,
  only: number | null = null,
  big: BigPlan | null = null,
): { good: GoodId; qty: number; maxPrice: number; to: number; capped: number } | null {
  const market = view.market!;
  let best: { good: GoodId; qty: number; maxPrice: number; to: number; profit: number; capped: number } | null = null;
  for (const good of GOODS) {
    if ((shelfLife(good) ?? Infinity) < MIN_TRADE_SHELF_LIFE) continue;
    const buy = market.price[good];
    const maxPrice = Math.max(1, Math.round(buy * 1.1));
    // 어제 팔려고 나온 물건이 없으면 살 수 없다고 본다. 있으면 수레와 돈이 허락하는 만큼 신청한다
    // (다 못 사면 맡긴 돈은 돌아오고, 다음 장날에 또 산다)
    const supply = market.yesterday[good].supply;
    if (supply === 0) continue;
    // 내 수레(칸·무게)와 짐꾼 수레에 더 실을 수 있는 양
    const cartCap = view.buyRoom[good];
    // 가져갈 마을까지 여비(와 비상금)는 남긴다
    const travelFee = Math.max(...map.towns.map((t) => (Number.isFinite(days[here]![t.id]!) ? days[here]![t.id]! : 0))) * ECONOMY.player.travelFeePerDay;
    const goldCap = Math.floor((Math.max(0, view.gold - travelFee - TRIP_RESERVE) * 0.9) / maxPrice);
    const qty = Math.min(cartCap, goldCap);
    if (qty <= 0) continue;
    const target = bestKnownPrice(view, good, here, days, qty, only, big);
    if (!target || !map.towns[target.town]) continue;
    const unit = target.net * 0.9 - maxPrice;
    if (target.net * 0.9 < maxPrice * (1 + profile.minMargin)) continue;
    // 실제로 살 수 있을 양(어제 나온 양)으로 견준다
    const profit = unit * Math.min(qty, supply);
    // 수레가 작아 못 사는 몫 (며칠 사 모을 때 나올 양과 돈으로 살 수 있는 양 중 작은 것까지): 하루 값으로
    // 한 번 실어 가서 팔 수 있는 양도 넘지 않게 본다 (도시가 한 장날에 받아 주는 양쯤)
    const want = Math.min(goldCap, supply * BUY_DAYS, TRIP_SELL_CAP);
    const capped = cartCap < want ? ((want - cartCap) * unit) / BUY_DAYS : 0;
    if (!best || profit > best.profit) best = { good, qty, maxPrice, to: target.town, profit, capped };
  }
  return best;
}
