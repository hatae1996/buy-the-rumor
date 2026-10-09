// 오늘 일당 (0.0.9): 마부는 행렬이 길에 있거나 장날 신청을 낸 날만 일당을 다 받고, 쉬는 날은 적게 받는다.
// 밤(hireNight)이 행렬의 밤(caravanNight)보다 먼저라, 오늘 길에 있었으면 travel이 아직 남아 있다.
import { GROWTH } from '../constants';
import type { EconomyState, PlayerState } from '../economy/state';
import type { Hire } from './hire';

const C = GROWTH.hire.carter;

/** 쉬는 날 마부 일당: 일손 사정 배율은 일하는 날과 같게 */
export function restWage(h: Pick<Hire, 'wage'>): number {
  return Math.max(1, Math.round((h.wage * C.restWage) / C.wage));
}

/** 마부가 오늘 일했나: 맡은 행렬이 길에 있거나 오늘 장날 신청을 냈다 */
export function carterWorking(state: EconomyState, p: PlayerState, h: Hire): boolean {
  const c = p.caravan;
  return c !== null && c.carter === h.id && (c.travel !== null || c.tradedDay === state.day);
}

/** 오늘 밤 줄 일당 */
export function wageToday(state: EconomyState, p: PlayerState, h: Hire): number {
  if (h.role !== 'carter' || carterWorking(state, p, h)) return h.wage;
  return restWage(h);
}
