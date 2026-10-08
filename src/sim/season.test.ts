import { describe, expect, it } from 'vitest';
import { CYCLE_DAYS, seasonOfDay, WINTER, type Season } from './season';

describe('계절', () => {
  it('15일에 사계절이 한 번 돈다', () => {
    expect(CYCLE_DAYS).toBe(15);
    const seen = new Set(Array.from({ length: 15 }, (_, i) => seasonOfDay(i + 1, 0)));
    expect(seen.size).toBe(4);
    expect(seasonOfDay(16, 0)).toBe(seasonOfDay(1, 0));
  });

  it('시작 계절부터 차례로', () => {
    for (const start of [0, 1, 2, 3] as Season[]) {
      expect(seasonOfDay(1, start)).toBe(start);
      let prev = start;
      for (let d = 2; d <= 30; d++) {
        const s = seasonOfDay(d, start);
        expect(s === prev || s === (prev + 1) % 4).toBe(true);
        prev = s;
      }
    }
  });

  it('겨울은 사흘, 나머지는 나흘', () => {
    const days = Array.from({ length: 15 }, (_, i) => seasonOfDay(i + 1, 0));
    expect(days.filter((s) => s === WINTER)).toHaveLength(3);
  });
});
