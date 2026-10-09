// 신문 (기획서 "소식을 얻는 방법", 0.1.0 작업 4 → 0.1.2 "신문은 마을에서 산다").
// 신문은 장날마다 한 부 나온다(그날 장날까지의 소식). 도시 신문사에서 찍어, 마을에 있을 때 신문팔이에게서 그날 신문을 산다.
// 길 위에서는 살 수 없다. 도시에서 하루 넘게 먼 마을에는 하루 늦은 신문이 온다(초안).
// 산 신문은 날짜별로 보관하고 다시 읽는다. 사지 않은 날은 머리기사도 보이지 않는다(질문 96 기본안: 지난 신문은 팔지 않는다).
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
 * 소식이 하나도 없는 날이면 null
 */
export function paperOnSale(state: EconomyState, map: WorldMap, town: number): number | null {
  const day = state.day - 1 - paperDelay(map, town);
  return state.news.some((n) => n.day === day) ? day : null;
}

/** 신문팔이에게서 오늘 신문을 산다. 마을에 있을 때만 */
export function buyNewspaper(state: EconomyState, map: WorldMap, p: PlayerState): Err | null {
  if (p.travel) return 'traveling';
  const day = paperOnSale(state, map, p.town);
  if (day === null) return 'noPaper';
  if (p.newspapers.includes(day)) return 'alreadyBought';
  const fee = paperFree(p) ? 0 : N.fee;
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
