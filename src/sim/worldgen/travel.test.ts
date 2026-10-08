import { describe, expect, it } from 'vitest';
import { AUTUMN, WINTER } from '../season';
import { costToDays, moveCost, pathTo, shortestPaths, terrainCost } from './travel';
import type { Terrain, Tile } from './types';

const tile = (terrain: Terrain, road = false): Tile => ({
  q: 0,
  r: 0,
  terrain,
  height: 0,
  moisture: 0,
  resource: null,
  road,
});

describe('이동 비용', () => {
  it('길은 빠르고 숲과 언덕은 느리다', () => {
    expect(moveCost(tile('plain', true), AUTUMN)).toBeLessThan(moveCost(tile('plain'), AUTUMN));
    expect(moveCost(tile('forest'), AUTUMN)).toBeGreaterThan(moveCost(tile('plain'), AUTUMN));
    expect(moveCost(tile('hills'), AUTUMN)).toBeGreaterThan(moveCost(tile('forest'), AUTUMN));
    expect(moveCost(tile('sea'), AUTUMN)).toBe(Infinity);
  });

  it('겨울엔 산과 언덕이 눈으로 더 느리다. 평원은 그대로', () => {
    expect(terrainCost(tile('mountain'), WINTER)).toBe(terrainCost(tile('mountain'), AUTUMN) * 2);
    expect(moveCost(tile('hills', true), WINTER)).toBeGreaterThan(moveCost(tile('hills', true), AUTUMN));
    expect(moveCost(tile('plain'), WINTER)).toBe(moveCost(tile('plain'), AUTUMN));
  });

  it('막힌 칸은 길이 있어도 못 지나간다', () => {
    expect(moveCost(tile('plain', true), AUTUMN, true)).toBe(Infinity);
  });

  it('비용 2가 하루, 최소 하루', () => {
    expect(costToDays(0.5)).toBe(1);
    expect(costToDays(4)).toBe(2);
    expect(costToDays(Infinity)).toBe(Infinity);
  });
});

describe('최단 경로', () => {
  // 0 - 1 - 2 - 3 줄, 그리고 0 - 4 - 3 우회로
  const neighbors = [[1, 4], [0, 2], [1, 3], [2, 4], [0, 3]];

  it('싼 길을 고른다', () => {
    const cost = [1, 1, 1, 1, 10];
    const p = shortestPaths(neighbors, 0, (i) => cost[i]!);
    expect(p.cost[3]).toBe(3);
    expect(pathTo(p, 0, 3)).toEqual([0, 1, 2, 3]);
  });

  it('막히면 돌아간다', () => {
    const cost = [1, 1, Infinity, 1, 10];
    const p = shortestPaths(neighbors, 0, (i) => cost[i]!);
    expect(p.cost[3]).toBe(11);
    expect(pathTo(p, 0, 3)).toEqual([0, 4, 3]);
  });

  it('못 가면 Infinity와 빈 경로', () => {
    const cost = [1, Infinity, 1, 1, Infinity];
    const p = shortestPaths(neighbors, 0, (i) => cost[i]!);
    expect(p.cost[3]).toBe(Infinity);
    expect(pathTo(p, 0, 3)).toEqual([]);
  });
});
