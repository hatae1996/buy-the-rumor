// 신문값 (기획서 "소식을 얻는 방법", 0.1.0 작업 4).
// 신문은 장날마다 나온다(그날 장날까지의 소식). 머리기사(그날 첫 줄)는 공짜로 보이고, 사면 전문을 읽는다.
// 산 날 신문은 계속 읽는다. 견습 동안은 무료. 신문값은 세계 밖으로 나가는 돈이다 (여관비처럼).
import { ECONOMY } from '../constants';
import type { EconomyState, NewsItem, PlayerState } from '../economy/state';

const N = ECONOMY.newspaper;

export type NewspaperError = 'noPaper' | 'alreadyBought' | 'paperFree';
type Err = NewspaperError | 'notEnoughGold';

/** 견습 동안은 신문이 무료다 */
export const paperFree = (p: PlayerState): boolean => p.apprentice !== null;

/** 그날 신문 전문을 읽을 수 있나 */
export const hasPaper = (p: PlayerState, day: number): boolean => paperFree(p) || p.newspapers.includes(day);

/** 그날 신문을 산다. 지난 신문은 backDays일 안의 것만 */
export function buyNewspaper(state: EconomyState, p: PlayerState, day: number): Err | null {
  if (paperFree(p)) return 'paperFree';
  if (!Number.isInteger(day) || day > state.day || day < state.day - N.backDays) return 'noPaper';
  if (!state.news.some((n) => n.day === day)) return 'noPaper';
  if (p.newspapers.includes(day)) return 'alreadyBought';
  if (p.gold < N.fee) return 'notEnoughGold';
  p.gold -= N.fee;
  p.newspapers.push(day);
  p.ledger.push({ day: state.day, kind: 'info', what: 'newspaper', town: p.travel ? p.travel.to : p.town, fee: N.fee });
  return null;
}

/**
 * 이 플레이어에게 보이는 신문: 산 날(과 견습 동안)은 전문, 아니면 날마다 머리기사 한 줄.
 * hidden: 날마다 사야 읽을 수 있는 기사 수
 */
export function visibleNews(state: EconomyState, p: PlayerState): { items: NewsItem[]; hidden: Record<number, number> } {
  const items: NewsItem[] = [];
  const hidden: Record<number, number> = {};
  const headline = new Set<number>();
  for (const n of state.news) {
    if (hasPaper(p, n.day) || !headline.has(n.day)) {
      headline.add(n.day);
      items.push(n);
    } else hidden[n.day] = (hidden[n.day] ?? 0) + 1;
  }
  return { items, hidden };
}
