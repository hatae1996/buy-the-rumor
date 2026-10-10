// 신문 (기획서 "소식을 얻는 방법", 0.1.0 작업 4 → 0.1.2 "신문은 마을에서 산다" → 0.1.3 매일 신문).
// 신문은 장날마다 한 부 나온다(그날 장날까지의 소식, 큰 소식이 없는 날도 도시 시세와 날씨, src/sim/news/daily.ts).
// 도시 신문사에서 찍어, 마을에 있을 때 신문팔이에게서 산다. 그날 신문은 정가, 지난 backIssues일 치는 backFee(답 96).
// 길 위에서는 살 수 없다. 도시에서 하루 넘게 먼 마을에는 하루 늦은 신문이 온다(초안).
// 산 신문은 날짜별로 보관하고 다시 읽는다. 사지 않은 날은 머리기사도 보이지 않는다.
// 견습 동안은 무료. 신문값은 세계 밖으로 나가는 돈이다 (여관비처럼).
import { ECONOMY } from '../constants';
import type { EconomyState, NewsItem, PlayerState } from '../economy/state';
import { AUTUMN } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';

const N = ECONOMY.newspaper;

export type NewspaperError = 'noPaper' | 'alreadyBought';
type Err = NewspaperError | 'notEnoughGold' | 'traveling';

/** 견습 동안은 신문이 무료다 */
export const paperFree = (p: PlayerState): boolean => p.apprentice !== null;

/** 그날 신문을 샀나 (산 신문만 읽는다) */
export const hasPaper = (p: PlayerState, day: number): boolean => p.newspapers.includes(day);

const lateCache = new WeakMap<WorldMap, number[]>();

/** 이 마을에 신문이 며칠 늦게 오나: 가장 가까운 도시까지 lateAfterDays일 넘게 걸리면 lateDays일 (가을 길 기준) */
export function paperDelay(map: WorldMap, town: number): number {
  let late = lateCache.get(map);
  if (!late) {
    const days = townTravelDays(map, AUTUMN);
    const cities = map.towns.filter((t) => t.tier === 'city').map((t) => t.id);
    late = map.towns.map((t) => (cities.length && Math.min(...cities.map((c) => days[t.id]![c]!)) > N.lateAfterDays ? N.lateDays : 0));
    lateCache.set(map, late);
  }
  return late[town] ?? 0;
}

/**
 * 이 마을 신문팔이가 오늘 파는 신문의 날짜 (그날 장날까지의 소식). 오늘 밤 장날 소식은 아직 없으니 어제 신문이 가장 새것이다.
 * 신문은 매일 나오지만, 아직 첫 장날이 지나지 않았으면(1일째) null
 */
export function paperOnSale(state: EconomyState, map: WorldMap, town: number, p?: PlayerState): number | null {
  // 견습 마을은 혼자 쓰는 마을이라 신문이 늦게 오지 않는다 (첫 신문 장면의 소식을 바로 받는다)
  const day = state.day - 1 - (p && paperFree(p) ? 0 : paperDelay(map, town));
  return state.news.some((n) => n.day === day) ? day : null;
}

export interface PaperForSale {
  day: number;
  fee: number;
  /** 그날 신문이면 true, 지난 신문이면 false */
  latest: boolean;
}

/** 이 마을 신문팔이가 파는 신문들: 오늘 신문(정가)과 그 앞 backIssues일 치(지난 신문 값). 새것부터 */
export function papersOnSale(state: EconomyState, map: WorldMap, town: number, p?: PlayerState): PaperForSale[] {
  const latest = paperOnSale(state, map, town, p);
  if (latest === null) return [];
  const free = p !== undefined && paperFree(p);
  const out: PaperForSale[] = [{ day: latest, fee: free ? 0 : N.fee, latest: true }];
  for (let day = latest - 1; day >= latest - N.backIssues && day >= 1; day--) {
    if (state.news.some((n) => n.day === day)) out.push({ day, fee: free ? 0 : N.backFee, latest: false });
  }
  return out;
}

/** 신문팔이에게서 신문을 산다 (날을 주지 않으면 오늘 신문). 마을에 있을 때만 */
export function buyNewspaper(state: EconomyState, map: WorldMap, p: PlayerState, want?: number): Err | null {
  if (p.travel) return 'traveling';
  const sale = papersOnSale(state, map, p.town, p);
  const paper = want === undefined ? sale[0] : sale.find((x) => x.day === want);
  if (!paper) return 'noPaper';
  const day = paper.day;
  if (p.newspapers.includes(day)) return 'alreadyBought';
  const fee = paper.fee;
  if (p.gold < fee) return 'notEnoughGold';
  p.gold -= fee;
  p.newspapers.push(day);
  if (fee > 0) p.ledger.push({ day: state.day, kind: 'info', what: 'newspaper', town: p.town, fee });
  return null;
}

/** 산 신문 한 부를 읽었다고 적는다 (안 읽은 신문 표시) */
export function readPaper(p: PlayerState, day: number): 'noPaper' | null {
  if (!p.newspapers.includes(day)) return 'noPaper';
  if (!p.papersRead.includes(day)) p.papersRead.push(day);
  return null;
}

/** 이 플레이어에게 보이는 신문 기사: 산 신문의 기사만 */
export function visibleNews(state: EconomyState, p: PlayerState): NewsItem[] {
  return state.news.filter((n) => hasPaper(p, n.day));
}
