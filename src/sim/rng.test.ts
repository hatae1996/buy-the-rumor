import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('같은 시드면 같은 수열', () => {
    const a = createRng(20261008);
    const b = createRng(20261008);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('다른 시드면 다른 수열', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('프로토타입과 같은 첫 값 (seed 20261008)', () => {
    // prototypes/hexmap-2d.html의 rng(20261008)()을 그대로 옮긴 값
    const proto = (seed: number) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const p = proto(20261008);
    const r = createRng(20261008);
    for (let i = 0; i < 10; i++) expect(r.next()).toBe(p());
  });

  it('next는 [0, 1), int는 양 끝 포함', () => {
    const r = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(1, 4);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('state로 이어서 돌리면 같은 수열', () => {
    const a = createRng(99);
    a.next();
    a.next();
    const b = createRng(a.state());
    expect(b.next()).toBe(a.next());
  });
});
