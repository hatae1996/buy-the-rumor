// 마을 사이 이동 일수.
import type { Season } from '../season';
import { buildNeighbors } from './hex';
import { costToDays, moveCost, shortestPaths } from './travel';
import type { Tile, WorldMap } from './types';

// 지도와 계절, 막힌 칸이 같으면 결과도 같다. 날마다, 명령마다 부르니 기억해 둔다
const cache = new WeakMap<WorldMap, Map<string, number[][]>>();

/**
 * days[a][b]: 마을 a에서 b까지 걸리는 날. 못 가면 Infinity. blocked는 막힌 칸 번호.
 * 돌려받은 표는 여럿이 같이 쓰므로 고치지 않는다
 */
export function townTravelDays(map: WorldMap, season: Season, blocked: ReadonlySet<number> = new Set()): number[][] {
  let byKey = cache.get(map);
  if (!byKey) cache.set(map, (byKey = new Map()));
  const key = `${season}|${[...blocked].sort((a, b) => a - b).join(',')}`;
  let days = byKey.get(key);
  if (!days) {
    days = travelDaysBetween(map.tiles, buildNeighbors(map.tiles), map.towns.map((t) => t.tile), season, blocked);
    byKey.set(key, days);
  }
  return days;
}

export function travelDaysBetween(
  tiles: readonly Tile[],
  neighbors: readonly number[][],
  townTiles: readonly number[],
  season: Season,
  blocked: ReadonlySet<number> = new Set(),
): number[][] {
  return townTiles.map((from) => {
    const paths = shortestPaths(neighbors, from, (i) => moveCost(tiles[i]!, season, blocked.has(i)));
    return townTiles.map((to) => (to === from ? 0 : costToDays(paths.cost[to]!)));
  });
}

/** 마을마다 가장 가까운 다른 마을까지의 날 */
export function nearestTownDays(days: readonly number[][]): number[] {
  return days.map((row, a) => Math.min(...row.filter((_, b) => b !== a)));
}

/**
 * 도시가 교통 요지인가. 마을마다 가장 가까운 도시(같으면 앞 번호)의 몫으로 나누고,
 * 도시마다 자기 몫 마을까지 걸리는 날 합이 그 몫의 어느 마을보다도 작아야 한다.
 * 도시가 하나면 "다른 곳까지 걸리는 날 합이 가장 작다"와 같다
 */
export function citiesAreHubs(days: readonly number[][], cities: readonly number[]): boolean {
  const owner = days.map((row, a) => (cities.includes(a) ? a : cities.reduce((best, c) => (row[c]! < row[best]! ? c : best), cities[0]!)));
  return cities.every((c) => {
    const group = owner.flatMap((o, i) => (o === c ? [i] : []));
    const sum = (a: number) => group.reduce((s, b) => s + days[a]![b]!, 0);
    const mine = sum(c);
    return group.every((i) => mine <= sum(i));
  });
}
