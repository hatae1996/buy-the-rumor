import { describe, expect, it } from 'vitest';
import { AUTUMN, WINTER } from '../season';
import { townTravelDays } from './days';
import { generateWorld } from './generate';
import { hexDistance } from './hex';
import { findRoute } from './route';

const map = generateWorld(20261008);

describe('마을 사이 경로', () => {
  it('출발 마을에서 시작해 도착 마을에서 끝나고, 한 칸씩 이어진다', () => {
    const route = findRoute(map, 0, 3, AUTUMN)!;
    expect(route.tiles[0]).toBe(map.towns[0]!.tile);
    expect(route.tiles.at(-1)).toBe(map.towns[3]!.tile);
    for (let i = 1; i < route.tiles.length; i++) {
      expect(hexDistance(map.tiles[route.tiles[i - 1]!]!, map.tiles[route.tiles[i]!]!)).toBe(1);
    }
  });

  it('바다를 지나지 않는다', () => {
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        if (a === b) continue;
        for (const i of findRoute(map, a, b, WINTER)!.tiles) expect(map.tiles[i]!.terrain).not.toBe('sea');
      }
    }
  });

  it('걸리는 날은 이동 일수 표와 같다', () => {
    const days = townTravelDays(map, AUTUMN);
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        if (a !== b) expect(findRoute(map, a, b, AUTUMN)!.days).toBe(days[a]![b]);
      }
    }
  });

  it('길이 막히면 돌아가거나 못 간다', () => {
    const route = findRoute(map, 0, 1, AUTUMN)!;
    const middle = route.tiles[Math.floor(route.tiles.length / 2)]!;
    const detour = findRoute(map, 0, 1, AUTUMN, new Set([middle]));
    if (detour) {
      expect(detour.tiles).not.toContain(middle);
      expect(detour.days).toBeGreaterThanOrEqual(route.days);
    }
  });
});
