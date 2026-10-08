// 탈것 = 수레(칸) + 말(끄는 무게, 속도) (기획서 "말").
// 말 없이 사람이 끌면 등짐 30, 손수레 70까지. 짐수레는 말 한 필, 마차는 두 필이 있어야 움직이고 끄는 무게는 말이 정한다.
import { CART, HORSES } from '../constants';
import type { Cart } from '../cart';
import type { Horse } from './types';

const F = HORSES.fatigue;

/** 이 수레를 움직이려면 있어야 하는 말 수 */
export function horsesNeeded(cart: Cart): number {
  return CART.types[cart.type].horses;
}

/** 말이 모자라 움직일 수 없나 */
export function lacksHorses(cart: Cart, horses: readonly Horse[]): boolean {
  return horses.length < horsesNeeded(cart);
}

/** 말 한 필이 끄는 무게. 다 지친 말은 절반만 끈다 */
export function horsePull(h: Horse): number {
  const pull = HORSES.kinds[h.kind].pull;
  return h.fatigue >= F.max ? Math.floor(pull / 2) : pull;
}

/** 실을 수 있는 최대 무게. 말이 모자라면 0 */
export function maxWeight(cart: Cart, horses: readonly Horse[]): number {
  if (lacksHorses(cart, horses)) return 0;
  const team = horses.reduce((s, h) => s + horsePull(h), 0);
  return Math.max(CART.types[cart.type].humanPull, team);
}

/** 이동 일수 배율: 가장 느린 말을 따른다. 지친 말은 빨리 달리지 못한다. 말이 없으면 사람 걸음 1 */
export function speedFactor(horses: readonly Horse[]): number {
  if (horses.length === 0) return 1;
  return Math.max(...horses.map((h) => (h.fatigue >= F.tiredAt ? 1 : HORSES.kinds[h.kind].speed)));
}

/** 사람 걸음으로 d일 걸리는 길을 이 말들로 가면 며칠 (하루는 걸린다) */
export function horseDays(d: number, horses: readonly Horse[]): number {
  if (!Number.isFinite(d)) return d;
  return Math.max(1, Math.round(d * speedFactor(horses)));
}

/** 말이 하루에 먹는 곡물 */
export function feedPerDay(horses: readonly Horse[]): number {
  return horses.reduce((s, h) => s + HORSES.kinds[h.kind].feed, 0);
}
