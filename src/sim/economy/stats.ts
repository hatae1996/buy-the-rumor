// 관찰용 수치: 통화량, 인구, 굶주림. 개발용 화면과 안정성 테스트에서 쓴다.
import { GOODS, type GoodId } from './goods';
import { count } from './inventory';
import { JOBS, type JobId } from './jobs';
import type { EconomyState } from './state';

/** 세상에 있는 돈 전부 (신청에 맡겨 둔 돈 포함) */
export function moneySupply(state: EconomyState): number {
  let m = state.player.gold;
  for (const w of state.workers) m += w.gold;
  for (const t of state.traders) m += t.gold;
  for (const t of state.towns) m += t.treasury;
  for (const o of state.orders) m += o.reserved;
  return m;
}

export function population(state: EconomyState, town?: number): number {
  return state.workers.filter((w) => town === undefined || w.town === town).length;
}

export function jobCounts(state: EconomyState, town: number): Record<JobId, number> {
  const out = Object.fromEntries(JOBS.map((j) => [j, 0])) as Record<JobId, number>;
  for (const w of state.workers) if (w.town === town) out[w.job]++;
  return out;
}

export function hungryWorkers(state: EconomyState, town?: number): number {
  return state.workers.filter((w) => w.hunger > 0 && (town === undefined || w.town === town)).length;
}

/** 마을 일꾼들이 갖고 있는 물품 양 */
export function townStock(state: EconomyState, town: number): Record<GoodId, number> {
  const out = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<GoodId, number>;
  for (const w of state.workers) if (w.town === town) for (const g of GOODS) out[g] += count(w.inv, g);
  return out;
}
