// 길로 이어진 마을 (소문이 건너는 길).
import { describe, expect, it } from 'vitest';
import { generateWorld } from './generate';
import { townHops, townLinks } from './townLinks';

const maps = Array.from({ length: 60 }, (_, i) => generateWorld(3 + i * 7919));

describe('길로 이어진 마을', () => {
  it('이웃은 서로를 이웃으로 본다', () => {
    for (const map of maps) {
      const links = townLinks(map);
      links.forEach((ns, a) => {
        expect(ns).not.toContain(a);
        for (const b of ns) expect(links[b]).toContain(a);
      });
    }
  });

  it('모든 마을이 길로 이어져 있어 소문이 언젠가 닿는다', () => {
    for (const map of maps) {
      const hops = townHops(map);
      for (const row of hops) for (const h of row) expect(Number.isFinite(h)).toBe(true);
      // 마을 n개면 아무리 멀어도 n−1번 건너면 닿는다
      for (const row of hops) expect(Math.max(...row)).toBeLessThanOrEqual(map.towns.length - 1);
    }
  });

  it('건너는 수는 이웃이면 1, 자기 자신은 0', () => {
    for (const map of maps) {
      const links = townLinks(map);
      const hops = townHops(map);
      links.forEach((ns, a) => {
        expect(hops[a]![a]).toBe(0);
        for (const b of ns) expect(hops[a]![b]).toBe(1);
      });
    }
  });
});
