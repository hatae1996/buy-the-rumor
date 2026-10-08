// 말과 수레 명령: 마구간에서 말 사고팔기, 말 쉬게 하기, 수레방에서 수레 바꾸기.
import { cartLots, createCart, loadGoods, type CartType } from '../cart';
import { CART, HORSES } from '../constants';
import type { EconomyState } from '../economy/state';
import { buyPrice, sellPrice, takeHorse, returnHorse } from './stable';
import { lacksHorses } from './pull';
import { stableAt } from './supply';
import type { HorseKind } from './types';
import type { WorldMap } from '../worldgen';
import { hasBuilding } from '../growth/buildings';
import { noteMoment } from '../ranking/record';

export type HorseError =
  | 'noStable'
  | 'noHorseLeft'
  | 'tooManyHorses'
  | 'noHorse'
  | 'stableNoGold'
  | 'alreadyRestedHorses'
  | 'horsesNotTired'
  | 'sameCart'
  | 'ordersPending'
  | 'needHorse'
  | 'noCartShop';
type Err = HorseError | 'traveling' | 'notEnoughGold' | 'noRoom';

/** 지금 마을 마구간에서 말을 산다 */
export function buyHorse(state: EconomyState, kind: HorseKind): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  const stable = stableAt(state, p.town);
  if (!stable) return 'noStable';
  // 두 행렬 합쳐 한 사람 최대 2필
  if (p.horses.length + (p.caravan?.horses.length ?? 0) >= HORSES.maxPerOwner) return 'tooManyHorses';
  const price = buyPrice(stable, kind);
  if (price === null) return 'noHorseLeft';
  if (p.gold < price) return 'notEnoughGold';
  const h = takeHorse(state, stable, kind)!;
  p.gold -= h.price;
  p.horses.push(h);
  p.ledger.push({ day: state.day, kind: 'horse', what: 'buy', town: p.town, horse: kind, price: h.price });
  noteMoment(state, 'firstHorse');
  return null;
}

/** 지금 마을 마구간에 말을 되판다. 그 마구간 재고로 돌아간다 */
export function sellHorse(state: EconomyState, horseId: number): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  const stable = stableAt(state, p.town);
  if (!stable) return 'noStable';
  const h = p.horses.find((x) => x.id === horseId);
  if (!h) return 'noHorse';
  const price = sellPrice(stable, h.kind);
  // 마구간 주인은 마을 금고에서 값을 치른다
  const town = state.towns[p.town]!;
  if (town.treasury < price) return 'stableNoGold';
  p.horses = p.horses.filter((x) => x !== h);
  returnHorse(state, p.town, h);
  town.treasury -= price;
  p.gold += price;
  p.ledger.push({ day: state.day, kind: 'horse', what: 'sell', town: p.town, horse: h.kind, price });
  return null;
}

/** 마구간에서 말을 쉬게 한다 (하루 한 번, 말마다 값). 값은 여관비처럼 경제에서 빠져나간다 */
export function restHorses(state: EconomyState): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  if (!p.horses.length) return 'noHorse';
  if (p.horsesRested) return 'alreadyRestedHorses';
  if (p.horses.every((h) => h.fatigue === 0)) return 'horsesNotTired';
  const fee = HORSES.fatigue.rest.fee * p.horses.length;
  if (p.gold < fee) return 'notEnoughGold';
  p.gold -= fee;
  for (const h of p.horses) h.fatigue = Math.max(0, h.fatigue - HORSES.fatigue.rest.recovery);
  p.horsesRested = true;
  p.ledger.push({ day: state.day, kind: 'horseRest', town: p.town, fee });
  return null;
}

/** 수레방 값: 새 수레 값에서 쓰던 수레를 쳐 준 값을 뺀다 */
export function cartCost(from: CartType, to: CartType): number {
  return Math.max(0, CART.types[to].price - Math.round(CART.types[from].price * CART.tradeIn));
}

/**
 * 수레를 바꾼다. 짐은 새 수레에 옮겨 싣고, 다 못 실으면 바꾸지 않는다.
 * 장날 신청이 걸려 있으면 잡아 둔 자리 때문에 바꿀 수 없다
 */
export function buyCart(state: EconomyState, map: WorldMap, type: CartType): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  // 수레방은 목재 마을과 도시에만 있다 (0.0.5). 다만 말이 모자라 수레가 움직이지 않으면
  // 어느 마을에서나 손수레로 바꿀 수 있다 (말을 잃고 갇히지 않게, 0.0.7)
  const stuck = type === 'handcart' && lacksHorses(p.cart, p.horses);
  if (!stuck && !hasBuilding(state, map, p.town, 'cartShop')) return 'noCartShop';
  if (p.cart.type === type) return 'sameCart';
  if (state.orders.some((o) => o.owner.kind === 'player')) return 'ordersPending';
  const cost = cartCost(p.cart.type, type);
  if (p.gold < cost) return 'notEnoughGold';
  const next = createCart(type);
  for (const lot of cartLots(p.cart)) {
    if (loadGoods(next, lot.good, lot.qty, lot.age) < lot.qty) return 'noRoom';
  }
  p.gold -= cost;
  // 수레방은 그 마을 사람이니 값은 마을 금고로
  state.towns[p.town]!.treasury += cost;
  p.ledger.push({ day: state.day, kind: 'cart', town: p.town, from: p.cart.type, to: type, price: cost });
  p.cart = next;
  return null;
}
