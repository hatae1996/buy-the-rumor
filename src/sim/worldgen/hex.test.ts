import { describe, expect, it } from 'vitest';
import { buildNeighbors, cellsAround, hexDistance, hexesInRadius } from './hex';

describe('육각 좌표', () => {
  it('반지름 7이면 169칸', () => {
    expect(hexesInRadius(7)).toHaveLength(169);
  });

  it('거리', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    expect(hexDistance({ q: -2, r: 2 }, { q: 2, r: -2 })).toBe(4);
  });

  it('가운데 칸은 이웃 6개, 꼭짓점 칸은 3개', () => {
    const cells = hexesInRadius(2);
    const nbs = buildNeighbors(cells);
    const at = (q: number, r: number) => cells.findIndex((c) => c.q === q && c.r === r);
    expect(nbs[at(0, 0)]).toHaveLength(6);
    expect(nbs[at(2, 0)]).toHaveLength(3);
    for (const [i, list] of nbs.entries()) {
      for (const n of list) expect(hexDistance(cells[i]!, cells[n]!)).toBe(1);
    }
  });

  it('주변 두 칸은 6 + 12칸', () => {
    const cells = hexesInRadius(4);
    const nbs = buildNeighbors(cells);
    const center = cells.findIndex((c) => c.q === 0 && c.r === 0);
    const around = cellsAround(nbs, center, 2);
    expect(around).toHaveLength(18);
    expect(around.slice(0, 6).every((i) => hexDistance(cells[i]!, cells[center]!) === 1)).toBe(true);
    expect(around.slice(6).every((i) => hexDistance(cells[i]!, cells[center]!) === 2)).toBe(true);
  });
});
