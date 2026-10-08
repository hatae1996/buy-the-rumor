// 마을에서 마을로 가는 실제 경로. 지도 위에서 말이 이 칸들을 따라 움직인다.
import type { Season } from '../season';
import { buildNeighbors } from './hex';
import { costToDays, moveCost, pathTo, shortestPaths } from './travel';
import type { WorldMap } from './types';

export interface Route {
  /** 지나는 칸 번호 (출발과 도착 포함) */
  tiles: number[];
  days: number;
}

/** 못 가면 null. blocked는 산사태 등으로 막힌 칸 번호 */
export function findRoute(
  map: WorldMap,
  fromTown: number,
  toTown: number,
  season: Season,
  blocked: ReadonlySet<number> = new Set(),
): Route | null {
  const from = map.towns[fromTown]!.tile;
  const to = map.towns[toTown]!.tile;
  const paths = shortestPaths(buildNeighbors(map.tiles), from, (i) => moveCost(map.tiles[i]!, season, blocked.has(i)));
  const tiles = pathTo(paths, from, to);
  if (tiles.length === 0) return null;
  return { tiles, days: costToDays(paths.cost[to]!) };
}
