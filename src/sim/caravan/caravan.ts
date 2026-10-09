// 두 번째 행렬: 마부 + 말 + 수레 (기획서 "성장", 0.0.5).
// 마부는 지시서(마을 순서, 마을마다 사기/팔기와 가격 한도, 반복)대로 장날에 신청하고 다음 마을로 간다.
// 마부는 소문을 보고 지시를 바꾸지 않는다. 짐은 알아서 싣기라 칸의 80%까지만 쓴다.
// 말 2필 제한은 그대로라, 마차(2필)를 쓰면 두 번째 행렬을 못 만든다.
import { CART_TYPES, cartWeight, createCart, loadGoods, shapeOf, type Cart, type CartType } from '../cart';
import { CART, GROWTH, HORSES } from '../constants';
import { GOODS, type GoodId } from '../economy/goods';
import type { EconomyState, PlayerState } from '../economy/state';
import { hasBuilding } from '../growth/buildings';
import { lacksHorses } from '../horses/pull';
import type { WorldMap } from '../worldgen';
import type { Caravan, CaravanPlan } from './types';

export type CaravanError = 'noCarter' | 'haveCaravan' | 'noCaravan' | 'caravanAway' | 'badPlan';
type Err = CaravanError | 'traveling' | 'notEnoughGold' | 'noCartShop' | 'needHorse' | 'noHorse' | 'boardNotEmpty';

/** 아직 행렬을 맡지 않은 마부 */
function freeCarter(p: PlayerState): number | null {
  const busy = p.caravan?.carter;
  return p.hires.find((h) => h.role === 'carter' && h.id !== busy)?.id ?? null;
}

/** 내 말 수 (두 행렬 합). 한 사람 최대 2필 */
export function ownedHorses(p: PlayerState): number {
  return p.horses.length + (p.caravan?.horses.length ?? 0);
}

/**
 * 두 번째 행렬을 꾸린다: 고용한 마부, 내 말 중 일부, 이 마을 수레방에서 새로 사거나 빌린 수레 (0.0.9: rent면 빌린다).
 * 내 행렬은 남은 말로 움직일 수 있어야 하고(마차는 2필), 새 수레도 행렬 말로 움직일 수 있어야 한다
 */
export function formCaravan(state: EconomyState, p: PlayerState, map: WorldMap, horseIds: readonly number[], cart: CartType, rent = false): Err | null {
  if (p.travel) return 'traveling';
  if (p.caravan) return 'haveCaravan';
  const carter = freeCarter(p);
  if (carter === null) return 'noCarter';
  if (!hasBuilding(state, map, p.town, 'cartShop')) return 'noCartShop';
  if (!CART_TYPES.includes(cart) || (rent && CART.rentPerDay[cart] <= 0)) return 'badPlan';
  const horses = p.horses.filter((h) => horseIds.includes(h.id));
  if (horses.length !== horseIds.length || horses.length === 0) return 'noHorse';
  const left = p.horses.filter((h) => !horseIds.includes(h.id));
  const board = createCart(cart);
  if (lacksHorses(p.cart, left) || lacksHorses(board, horses)) return 'needHorse';
  // 빌리면 수레값 없이 오늘 밤부터 하루 값을 낸다 (첫 밤 값을 낼 돈은 있어야 한다)
  const price = rent ? 0 : CART.types[cart].price;
  if (p.gold < (rent ? CART.rentPerDay[cart] : price)) return 'notEnoughGold';
  p.gold -= price;
  state.towns[p.town]!.treasury += price;
  p.horses = left;
  p.caravan = {
    carter,
    horses,
    cart: board,
    town: p.town,
    travel: null,
    plan: null,
    stop: 0,
    tradedDay: null,
    recalled: false,
    rent: rent ? { town: p.town, perDay: CART.rentPerDay[cart], owed: 0 } : null,
  };
  p.ledger.push({ day: state.day, kind: 'caravan', what: 'form', town: p.town, fee: price, rented: rent });
  return null;
}

/** 지시서를 보낸다. 다음 장날부터 첫 마을로 간다 */
export function setCaravanPlan(state: EconomyState, p: PlayerState, plan: CaravanPlan): Err | null {
  const c = p.caravan;
  if (!c) return 'noCaravan';
  const okStop = (s: CaravanPlan['stops'][number]) =>
    Number.isInteger(s.town) &&
    s.town >= 0 &&
    s.town < state.towns.length &&
    s.buys.every((b) => GOODS.includes(b.good) && Number.isInteger(b.qty) && b.qty > 0 && Number.isInteger(b.maxPrice) && b.maxPrice > 0) &&
    s.sells.every((x) => GOODS.includes(x.good) && (x.qty === 'all' || (Number.isInteger(x.qty) && x.qty > 0)) && Number.isInteger(x.minPrice) && x.minPrice > 0);
  if (!plan.stops.length || plan.stops.length > GROWTH.caravan.maxStops || !plan.stops.every(okStop)) return 'badPlan';
  c.plan = JSON.parse(JSON.stringify(plan)) as CaravanPlan;
  c.stop = 0;
  c.recalled = false;
  c.tradedDay = null;
  return null;
}

/** 행렬을 불러들인다: 지시서를 멈추고 내가 있는 마을로 온다 */
export function recallCaravan(p: PlayerState): Err | null {
  const c = p.caravan;
  if (!c) return 'noCaravan';
  c.plan = null;
  c.recalled = true;
  return null;
}

/**
 * 행렬을 푼다 (내가 있는 마을에 와 있을 때, 수레가 비었을 때).
 * 말은 내 행렬로 돌아오고, 산 수레는 쓰던 수레 값으로 판다. 빌린 수레는 밀린 값을 다 내고 돌려준다
 * (어느 마을에서나, 0.0.9). 마부는 고용된 채로 남는다
 */
export function disbandCaravan(state: EconomyState, p: PlayerState): Err | null {
  const c = p.caravan;
  if (!c) return 'noCaravan';
  if (p.travel || c.travel || c.town !== p.town) return 'caravanAway';
  if (c.cart.pieces.length) return 'boardNotEmpty';
  if (c.rent) {
    const owed = c.rent.owed;
    if (p.gold < owed) return 'notEnoughGold';
    p.gold -= owed;
    state.towns[c.rent.town]!.treasury += owed;
    p.horses.push(...c.horses);
    p.caravan = null;
    p.ledger.push({ day: state.day, kind: 'caravan', what: 'disband', town: p.town, fee: owed, rented: true });
    return null;
  }
  const refund = Math.round(CART.types[c.cart.type].price * CART.tradeIn);
  p.gold += refund;
  p.horses.push(...c.horses);
  p.caravan = null;
  p.ledger.push({ day: state.day, kind: 'caravan', what: 'disband', town: p.town, fee: -refund });
  return null;
}

/**
 * 밤에: 빌린 수레 값 (0.0.9). 하루 값을 더하고, 낼 돈이 있으면 밀린 것까지 빌린 수레방 마을에 낸다.
 * 못 내면 밀린다 (행렬을 풀 때 다 내야 한다)
 */
export function caravanRentNight(state: EconomyState, p: PlayerState): void {
  const r = p.caravan?.rent;
  if (!r) return;
  r.owed += r.perDay;
  if (p.gold < r.owed) return;
  p.gold -= r.owed;
  state.towns[r.town]!.treasury += r.owed;
  p.ledger.push({ day: state.day, kind: 'caravan', what: 'rent', town: r.town, fee: r.owed });
  r.owed = 0;
}

/** 알아서 싣기: 칸의 80%까지, 행렬 말이 끌 수 있는 무게까지 더 실을 수 있는 양 */
export function autoLoadRoom(c: Caravan, good: GoodId): number {
  const slots = CART.types[c.cart.type].rows.join('').split('').filter((x) => x === '#').length;
  const limit = Math.floor(slots * GROWTH.caravan.autoLoadShare);
  const copy = JSON.parse(JSON.stringify(c.cart)) as Cart;
  const used = (cart: Cart) => cart.pieces.reduce((s, p) => s + shapeOf(p.good, 0).length, 0);
  const pull = c.horses.reduce((s, h) => s + (h.fatigue >= HORSES.fatigue.max ? HORSES.kinds[h.kind].pull / 2 : HORSES.kinds[h.kind].pull), 0);
  let weight = cartWeight(copy);
  let n = 0;
  for (;;) {
    if (weight + CART.goods[good].weight > pull) break;
    if (loadGoods(copy, good, 1) < 1) break;
    if (used(copy) > limit) break;
    weight += CART.goods[good].weight;
    n++;
  }
  return n;
}
