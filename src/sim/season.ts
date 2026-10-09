import { CALENDAR } from './constants';

// 계절. 한 시즌(실제 13일)에 사계절이 돌고, 시작 계절은 랜덤이다.
export type Season = 0 | 1 | 2 | 3;

export const SPRING: Season = 0;
export const SUMMER: Season = 1;
export const AUTUMN: Season = 2;
export const WINTER: Season = 3;

export const SEASON_NAME: Record<Season, string> = { 0: '봄', 1: '여름', 2: '가을', 3: '겨울' };

/** 사계절이 한 바퀴 도는 날 = 시즌 하나 (실제 13일, 게임 속 125일) */
export const CYCLE_DAYS = CALENDAR.seasonDays.reduce((a, b) => a + b, 0);

/** day는 1부터. 시작 계절부터 사계절이 차례로 돈다 */
export function seasonOfDay(day: number, startSeason: Season): Season {
  let left = (day - 1) % CYCLE_DAYS;
  let s = startSeason as number;
  for (;;) {
    const len = CALENDAR.seasonDays[s]!;
    if (left < len) return s as Season;
    left -= len;
    s = (s + 1) % 4;
  }
}
