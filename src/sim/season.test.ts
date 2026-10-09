import { describe, expect, it } from 'vitest';
import { CALENDAR } from './constants';
import { CYCLE_DAYS, seasonOfDay, type Season } from './season';

describe('계절', () => {
  it('한 시즌(실제 13일, 0.0.9)에 사계절이 한 번 돈다: 하루 2.5시간이면 게임 속 125일', () => {
    expect(CYCLE_DAYS).toBe(125);
    const seen = new Set(Array.from({ length: CYCLE_DAYS }, (_, i) => seasonOfDay(i + 1, 0)));
    expect(seen.size).toBe(4);
    expect(seasonOfDay(CYCLE_DAYS + 1, 0)).toBe(seasonOfDay(1, 0));
  });

  it('시작 계절부터 차례로', () => {
    for (const start of [0, 1, 2, 3] as Season[]) {
      expect(seasonOfDay(1, start)).toBe(start);
      let prev = start;
      for (let d = 2; d <= CYCLE_DAYS * 2; d++) {
        const s = seasonOfDay(d, start);
        expect(s === prev || s === (prev + 1) % 4).toBe(true);
        prev = s;
      }
    }
  });

  it('계절마다 정해진 날 수만큼 이어진다', () => {
    const days = Array.from({ length: CYCLE_DAYS }, (_, i) => seasonOfDay(i + 1, 0));
    for (const s of [0, 1, 2, 3] as Season[]) expect(days.filter((d) => d === s)).toHaveLength(CALENDAR.seasonDays[s]);
  });
});
