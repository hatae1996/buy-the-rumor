// 봇의 살 것 고르기 (0.0.5 작업 9, 기획서 "성장"): 말과 큰 수레, 짐꾼, 채집꾼과 창고, 두 번째 행렬, 장비.
// 봇은 화면에 보이는 것(playerView)과 자기 기억(BotMind)만으로 판단한다.
// 사는 이유는 사람이 느끼는 것과 같게 잡고, 셈이 맞을 때만 산다:
// - 말·짐꾼: 원정에서 두고 온 짐 값(수레가 찼다)이 하루 먹이·일당보다 크면
// - 채집꾼·창고: 내 원정 값의 채집꾼 몫이 일당 + 보관료보다 크면
// - 장비: 장비가 없어 못 고른 선택지를 두 번 넘게 보면
// 사고 나서도 하루 유지비 며칠 치와 비상금은 남긴다. 써 보니 손해면 내보내고, 돈이 모자라면 말을 판다.
// 셈과 상관없이 "살 수 있게 된 날"도 따로 적는다 (기획 숫자 맞추기용).
import { ECONOMY, GROWTH, HORSES } from '../constants';
import type { Command, GoodId, PlayerView } from '../economy';
import { GOODS } from '../economy';
import type { GearKind } from '../expedition';
import type { CaravanPlan } from '../caravan';
import type { HorseKind } from '../horses';
import type { BotGrowth } from './profiles';

/** 봇이 처음 산 날 (보고용) */
export type GrowthKind = 'horse' | 'wagon' | 'porter' | 'gatherer' | 'warehouse' | 'caravan' | 'gear';
/** 셈과 상관없이 돈으로는 살 수 있게 된 날 (보고용) */
export type AffordKind = 'horse' | 'porter' | 'gatherer';

/** 살 것 고르기에 쓰는 봇의 기억 */
export interface GrowthMind {
  /** 원정에서 두고 온 짐 값 (날, 값). 짐꾼·말을 살 이유 */
  lost: { day: number; value: number }[];
  /** 장사에서 수레가 작아 못 산 몫의 값 (날, 값). 말·큰 수레를 살 이유 (짐꾼 수레는 장에서 산 짐을 받지 않는다) */
  capped: { day: number; value: number }[];
  /** 장비가 없어 못 고른 선택지 */
  gearWanted: Partial<Record<GearKind, number>>;
  /** 원정 한 번에 거둔 값 (최근 몇 개) */
  hauls: number[];
  /** 채집꾼이 창고에 넣은 값 (날, 값) */
  gathered: { day: number; value: number }[];
  /** 짐꾼 수레에서 짐을 옮긴 마지막 날 (짐꾼이 쓸모 있었나) */
  porterUsed: number;
  /** 고용한 날 (일꾼 번호 → 날) */
  hiredOn: Record<number, number>;
  /** 창고를 빌린 날 (마을 → 날) */
  rentedOn: Record<number, number>;
  /** 처음 산 날 */
  firsts: Partial<Record<GrowthKind, number>>;
  /** 돈으로는 살 수 있게 된 첫날 */
  couldAfford: Partial<Record<AffordKind, number>>;
}

export function createGrowthMind(): GrowthMind {
  return { lost: [], capped: [], gearWanted: {}, hauls: [], gathered: [], porterUsed: -1, hiredOn: {}, rentedOn: {}, firsts: {}, couldAfford: {} };
}

/** 이만큼 지난 일은 잊는다 (새로 들인 것도 이만큼 써 보고 판단한다) */
const RECENT_DAYS = 10;
/** 짐꾼은 몇 명까지 */
const MAX_PORTERS = 1;
/** 장비가 없어 못 고른 선택지를 이만큼 보면 산다 */
const GEAR_REASON = 2;
/** 원정 값을 몇 개까지 기억하나 */
const HAUL_MEMORY = 10;

const perDay = (xs: { day: number; value: number }[], today: number) =>
  xs.filter((x) => today - x.day <= RECENT_DAYS).reduce((s, x) => s + x.value, 0) / RECENT_DAYS;

/** 어제 장부(원정에서 두고 온 짐, 거둔 값, 채집꾼 몫)를 기억에 넣는다. 날이 바뀔 때 부른다 */
export function noteDay(view: PlayerView, g: GrowthMind): void {
  const priceAt = (town: number) => (view.market?.town === town ? view.market.price : view.memory[town]?.prices);
  for (const e of view.ledger) {
    if (e.day !== view.day - 1) continue;
    if (e.kind === 'expedition') {
      const prices = priceAt(e.town);
      if (!prices) continue;
      const qty = e.goods.reduce((s, x) => s + x.qty, 0);
      const value = e.goods.reduce((s, x) => s + x.qty * prices[x.good], 0);
      g.hauls.push(value);
      if (e.leftBehind > 0) g.lost.push({ day: e.day, value: e.leftBehind * (qty ? value / qty : 0) });
    } else if (e.kind === 'gathered') {
      const prices = priceAt(e.town);
      if (prices) g.gathered.push({ day: e.day, value: e.goods.reduce((s, x) => s + x.qty * prices[x.good], 0) });
    }
  }
  g.hauls = g.hauls.slice(-HAUL_MEMORY);
  g.lost = g.lost.filter((x) => view.day - x.day <= RECENT_DAYS);
  g.capped = g.capped.filter((x) => view.day - x.day <= RECENT_DAYS);
  g.gathered = g.gathered.filter((x) => view.day - x.day <= RECENT_DAYS);
  for (const h of view.hires) g.hiredOn[h.id] ??= view.day - 1;
  // 짐꾼 수레에 짐이 있으면 짐꾼이 쓸모 있었다 (원정 짐이든 장에서 산 짐이든)
  if (view.hires.some((h) => h.board?.pieces.length)) g.porterUsed = view.day;
}

/** 원정 카드에서 장비가 없어 빠진 선택지를 기억한다 */
export function noteMissing(g: GrowthMind, needs: { gear?: GearKind }[]): void {
  for (const n of needs) if (n.gear) g.gearWanted[n.gear] = (g.gearWanted[n.gear] ?? 0) + 1;
}

/** 이 마을 곡물 한 개 값 (모르면 보통 값) */
function grainPrice(view: PlayerView): number {
  return view.market?.price.grain ?? 6;
}

/** 하루 유지비가 이만큼 늘어도 버틸 돈이 있나 */
function affordable(view: PlayerView, growth: BotGrowth, price: number, addUpkeep: number): boolean {
  return view.gold - price >= growth.reserve + (view.upkeep.total + addUpkeep) * growth.upkeepDays;
}

const avgHaul = (g: GrowthMind) => (g.hauls.length ? g.hauls.reduce((a, b) => a + b, 0) / g.hauls.length : 0);

/**
 * 오늘 살 것 하나 (또는 줄일 것 하나). 없으면 null.
 * 마을에 있고 원정 중이 아닐 때만 부른다
 */
export function growthStep(view: PlayerView, growth: BotGrowth, g: GrowthMind, once: (c: Command) => Command | null): Command | null {
  if (view.location.kind !== 'town') return null;
  const here = view.location.town;
  const mark = (kind: GrowthKind, c: Command | null) => {
    if (c) g.firsts[kind] ??= view.day;
    return c;
  };
  const afford = (kind: AffordKind, ok: boolean) => {
    if (ok) g.couldAfford[kind] ??= view.day;
    return ok;
  };
  const has = (role: string) => view.hires.some((h) => h.role === role);

  // 1. 줄이기: 돈이 모자라면 일당이 큰 일꾼부터, 그래도 모자라면 말을 판다
  if (view.gold < growth.reserve / 2 && view.upkeep.total > 0) {
    const hire = [...view.hires].sort((a, b) => b.wage - a.wage).find((h) => (h.role !== 'carter' || !view.caravan) && !h.board?.pieces.length);
    if (hire) {
      const c = once({ type: 'dismissHire', hireId: hire.id });
      if (c) return c;
    }
    // 말이 있어야 움직이는 수레는 수레방에서 손수레로 바꾸고(쳐 준 값이 남는다), 그다음 말을 판다
    if (view.cart.horsesNeeded > 0 && view.carts.some((c) => c.type === 'handcart' && c.cost !== null)) {
      const c = once({ type: 'buyCart', cart: 'handcart' });
      if (c) return c;
    }
    const horse = view.horses.find((h) => h.sellPrice !== null);
    if (horse && view.cart.horsesNeeded === 0) {
      const c = once({ type: 'sellHorse', horseId: horse.id });
      if (c) return c;
    }
  }
  // 써 보니 손해: 채집꾼 몫이 일당 + 보관료보다 적거나, 짐꾼 수레를 열흘 동안 안 썼으면 내보낸다
  for (const h of view.hires) {
    if (view.day - (g.hiredOn[h.id] ?? view.day) <= RECENT_DAYS) continue;
    const losing =
      (h.role === 'gatherer' && perDay(g.gathered, view.day) < h.wage + GROWTH.warehouse.rentPerDay) ||
      (h.role === 'porter' && view.day - g.porterUsed > RECENT_DAYS && !h.board?.pieces.length);
    if (!losing) continue;
    const c = once({ type: 'dismissHire', hireId: h.id });
    if (c) return c;
  }
  // 채집꾼이 없는 창고는 비면 돌려준다 (빌린 지 얼마 안 됐으면 기다린다)
  for (const w of view.warehouses) {
    if (w.count > 0 || w.owed > 0 || view.hires.some((h) => h.role === 'gatherer' && h.town === w.town)) continue;
    if (view.day - (g.rentedOn[w.town] ?? -Infinity) <= RECENT_DAYS) continue;
    if (view.orders.some((o) => o.from === 'store' && o.town === w.town)) continue;
    const c = once({ type: 'releaseWarehouse', town: w.town });
    if (c) return c;
  }

  // 2. 장비: 못 고른 선택지를 여러 번 봤고 돈이 넉넉하면
  for (const [gear, times] of Object.entries(g.gearWanted) as [GearKind, number][]) {
    if (times < GEAR_REASON || view.gear.some((x) => x.kind === gear && x.uses !== null)) continue;
    const price = ECONOMY.expedition.gear[gear].price;
    if (!affordable(view, growth, price, 0)) continue;
    const c = mark('gear', once({ type: 'buyGear', gear }));
    if (c) {
      g.gearWanted[gear] = 0;
      return c;
    }
  }

  const lostPerDay = perDay(g.lost, view.day);
  // 말·큰 수레는 원정에서 두고 온 짐과 장사에서 못 산 몫을 함께 본다
  const roomPerDay = lostPerDay + perDay(g.capped, view.day);

  // 3. 첫 말: 손수레보다 많이 끄는 말 (짐말, 빠른 말). 마구간이 있는 마을에서
  if (view.horses.length === 0 && view.stable) {
    const pick = view.stable.horses
      .filter((h) => h.stock > 0 && h.price !== null && h.pull > view.cart.maxWeight)
      .map((h) => ({ h, feed: h.feed * grainPrice(view) * HORSES.stableFeedMarkup }))
      .filter((x) => afford('horse', affordable(view, growth, x.h.price!, x.feed)))
      .sort((a, b) => b.h.pull - a.h.pull)[0];
    if (pick && (growth.horseGoal || roomPerDay >= pick.feed * growth.payMargin)) {
      const c = mark('horse', once({ type: 'buyHorse', kind: pick.h.kind as HorseKind }));
      if (c) return c;
    }
  }

  // 4. 말이 있고 수레가 여전히 차면 짐수레 (칸이 넓다). 수레방이 있는 마을에서
  if (view.horses.length >= 1 && (view.cart.type === 'pack' || view.cart.type === 'handcart') && (roomPerDay > 0 || growth.horseGoal)) {
    const wagon = view.carts.find((c) => c.type === 'wagon' && c.cost !== null);
    if (wagon && affordable(view, growth, wagon.cost!, 0)) {
      const c = mark('wagon', once({ type: 'buyCart', cart: 'wagon' }));
      if (c) return c;
    }
  }

  // 5. 짐꾼: 두고 온 짐이나 수레가 작아 못 산 몫의 값이 일당보다 크면 (짐꾼 수레에도 장에서 산 짐을 싣는다).
  // 데려온 뒤에도 여전히 모자라면 한 명 더 (MAX_PORTERS까지). 새로 데려온 짐꾼은 열흘 써 보고 판단한다
  const porterCount = view.hires.filter((h) => h.role === 'porter').length;
  const lastPorter = Math.max(-Infinity, ...view.hires.filter((h) => h.role === 'porter').map((h) => g.hiredOn[h.id] ?? view.day));
  if (porterCount < MAX_PORTERS && view.day - lastPorter > RECENT_DAYS) {
    const offer = view.hireBoard.find((o) => o.role === 'porter');
    if (offer && afford('porter', affordable(view, growth, offer.wage, offer.wage)) && roomPerDay >= offer.wage * growth.payMargin) {
      const c = mark('porter', once({ type: 'hire', role: 'porter' }));
      if (c) return c;
    }
  }

  // 6. 채집꾼과 창고: 내 원정 값의 채집꾼 몫이 일당과 보관료보다 크면, 원정을 하는 마을에서
  if (growth.gatherer && !has('gatherer') && view.canExpedition) {
    const offer = view.hireBoard.find((o) => o.role === 'gatherer');
    const hasWarehouse = view.warehouses.some((w) => w.town === here);
    const cost = (offer?.wage ?? Infinity) + GROWTH.warehouse.rentPerDay;
    // 창고를 이미 빌렸으면 보관료는 유지비에 들어 있다
    const add = hasWarehouse ? (offer?.wage ?? 0) : cost;
    const ok = offer !== undefined && afford('gatherer', affordable(view, growth, offer.wage + (hasWarehouse ? 0 : GROWTH.warehouse.deposit), add));
    if (ok && g.hauls.length >= 3 && avgHaul(g) * GROWTH.gathererShare >= cost * growth.payMargin) {
      const c = hasWarehouse ? mark('gatherer', once({ type: 'hire', role: 'gatherer' })) : mark('warehouse', once({ type: 'rentWarehouse' }));
      if (c) {
        if (!hasWarehouse) g.rentedOn[here] = view.day;
        return c;
      }
    }
  }

  // 7. 채집꾼이 넣은 창고 짐을 장에 낸다 (이 마을이면 지금 시세, 아니면 기억하는 시세로)
  const sell = sellStored(view);
  if (sell) {
    const c = once(sell);
    if (c) return c;
  }

  // 8. 두 번째 행렬 (잘하는 봇만): 마부를 데려오고, 남는 말 한 필과 손수레로 꾸려 두 마을 사이를 오가게 한다
  if (growth.caravan && !view.caravan) {
    const c = caravanStep(view, growth, once, mark);
    if (c) return c;
  }
  return null;
}

/** 창고 짐을 장에 내기. 이미 낸 물건은 빼고 */
function sellStored(view: PlayerView): Command | null {
  for (const w of view.warehouses) {
    if (w.owed > 0 || w.count === 0) continue;
    const here = view.location.kind === 'town' && view.location.town === w.town;
    const prices = here ? view.market?.price : view.day - (view.memory[w.town]?.day ?? -Infinity) <= RECENT_DAYS ? view.memory[w.town]!.prices : null;
    if (!prices) continue;
    const onSale = new Set(view.orders.filter((o) => o.from === 'store' && o.town === w.town).map((o) => o.good));
    const qty: Partial<Record<GoodId, number>> = {};
    for (const p of w.pieces) qty[p.good] = (qty[p.good] ?? 0) + p.qty;
    for (const good of GOODS) {
      const n = qty[good] ?? 0;
      if (n === 0 || onSale.has(good)) continue;
      // 채집꾼이 없는 창고는 비우려고 내놓는다 (값을 따지지 않는다)
      const clearing = !view.hires.some((h) => h.role === 'gatherer' && h.town === w.town);
      return { type: 'placeStoreSellOrder', town: w.town, good, qty: n, minPrice: clearing ? 1 : Math.max(1, Math.round(prices[good] * 0.8)) };
    }
  }
  return null;
}

/** 두 번째 행렬: 마부 → 말(내 것 중 하나를 넘기거나 새로) → 행렬 꾸리기 → 지시서 */
function caravanStep(
  view: PlayerView,
  growth: BotGrowth,
  once: (c: Command) => Command | null,
  mark: (kind: GrowthKind, c: Command | null) => Command | null,
): Command | null {
  if (view.gold < growth.caravanGold || view.location.kind !== 'town') return null;
  const here = view.location.town;
  const route = bestRoute(view, here);
  if (!route) return null;
  // 내 수레를 끄는 데 필요 없는 말과 이 마을 수레방이 있어야 꾸릴 수 있다 (없는데 마부부터 데려오면 일당만 나간다)
  const spare = view.horses.length - view.cart.horsesNeeded;
  if (spare <= 0 || !view.carts.some((c) => c.type === 'handcart')) return null;
  const carter = view.hires.find((h) => h.role === 'carter');
  if (!carter) {
    const offer = view.hireBoard.find((o) => o.role === 'carter');
    return offer && affordable(view, growth, offer.wage, offer.wage) ? once({ type: 'hire', role: 'carter' }) : null;
  }
  const horseIds = view.horses.slice(view.cart.horsesNeeded, view.cart.horsesNeeded + 1).map((h) => h.id);
  return mark('caravan', once({ type: 'formCaravan', horseIds, cart: 'handcart' }));
}

/** 기억하는 시세로 여기서 사서 가장 남는 마을 하나 (두 번째 행렬 지시서) */
function bestRoute(view: PlayerView, here: number): CaravanPlan | null {
  const price = view.market?.price;
  if (!price) return null;
  let best: { plan: CaravanPlan; gain: number } | null = null;
  for (const [id, mem] of Object.entries(view.memory)) {
    const to = Number(id);
    if (to === here || view.day - mem.day > 30) continue;
    for (const good of GOODS) {
      const gain = mem.prices[good] * 0.9 - price[good] * 1.1;
      if (gain <= price[good] * 0.2 || (best && gain <= best.gain)) continue;
      best = {
        gain,
        plan: {
          stops: [
            { town: here, buys: [{ good, qty: 20, maxPrice: Math.round(price[good] * 1.1) }], sells: [] },
            { town: to, buys: [], sells: [{ good, qty: 'all', minPrice: Math.round(mem.prices[good] * 0.85) }] },
          ],
          repeat: true,
        },
      };
    }
  }
  return best?.plan ?? null;
}

/** 행렬을 꾸렸는데 지시서가 없으면 보낸다 */
export function caravanPlanStep(view: PlayerView): Command | null {
  if (!view.caravan || view.caravan.plan || !view.caravan.here || view.location.kind !== 'town') return null;
  const plan = bestRoute(view, view.location.town);
  return plan ? { type: 'setCaravanPlan', plan } : null;
}
