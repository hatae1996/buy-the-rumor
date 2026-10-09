// 길: 마을끼리 지형 비용 최단 경로를 구하고, 최소 신장 트리에 짧은 추가 연결을 몇 개 더한다 (마을 4곳이면 하나).
// 고리가 생겨 길 하나가 막혀도 돌아갈 수 있는 경우가 많다.
import { WORLDGEN } from '../constants';
import { AUTUMN } from '../season';
import { pathTo, shortestPaths, terrainCost } from './travel';
import type { Tile } from './types';

interface Link {
  a: number;
  b: number;
  cost: number;
  path: number[];
}

export interface RoadPlan {
  /** 길이 놓일 칸 번호 */
  tiles: Set<number>;
  /** 마을 사이 길마다 지나는 칸 (양 끝 마을 포함) */
  links: { a: number; b: number; path: number[] }[];
}

/** 마을을 모두 잇는 길. 잇지 못하면 null */
export function planRoads(
  tiles: readonly Tile[],
  neighbors: readonly number[][],
  townTiles: readonly number[],
  extraRoads = 1,
): RoadPlan | null {
  const n = townTiles.length;
  const links: Link[] = [];
  for (let a = 0; a < n; a++) {
    // 길을 놓을 때는 눈 없는 계절의 지형 비용으로 찾는다
    const paths = shortestPaths(neighbors, townTiles[a]!, (i) => terrainCost(tiles[i]!, AUTUMN));
    for (let b = a + 1; b < n; b++) {
      const cost = paths.cost[townTiles[b]!]!;
      if (Number.isFinite(cost)) links.push({ a, b, cost, path: pathTo(paths, townTiles[a]!, townTiles[b]!) });
    }
  }
  if (links.length < n - 1) return null;
  links.sort((x, y) => x.cost - y.cost);

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  const used: Link[] = [];
  const extras: Link[] = [];
  for (const link of links) {
    const ra = find(link.a);
    const rb = find(link.b);
    if (ra !== rb) {
      parent[ra] = rb;
      used.push(link);
    } else if (extras.length < extraRoads) {
      extras.push(link);
    }
  }
  if (used.length < n - 1) return null;
  const longest = used[used.length - 1]!.cost;
  for (const extra of extras) if (extra.cost < longest * WORLDGEN.extraRoadFactor) used.push(extra);

  return {
    tiles: new Set(used.flatMap((l) => l.path)),
    links: used.map(({ a, b, path }) => ({ a, b, path })),
  };
}
