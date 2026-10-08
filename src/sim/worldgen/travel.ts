// 이동 비용과 길 찾기. 지도 위 말 이동과 마을 사이 이동 일수에 쓴다.
import { TRAVEL } from '../constants';
import { SPRING, WINTER, type Season } from '../season';
import type { Tile } from './types';

/** 길이 없다고 칠 때 칸을 지나는 비용. 길을 놓을 경로를 찾을 때 쓴다 */
export function terrainCost(tile: Tile, season: Season): number {
  const c = TRAVEL.terrainCost[tile.terrain];
  return isSnowy(tile, season) ? c * TRAVEL.winterSnowMultiplier : c;
}

/** 실제로 칸을 지나는 비용. blocked는 산사태 등으로 막힌 칸 */
export function moveCost(tile: Tile, season: Season, blocked = false): number {
  if (blocked) return Infinity;
  if (tile.road) {
    if (isSnowy(tile, season)) return TRAVEL.winterSnowRoadCost;
    return season === SPRING ? TRAVEL.springMudRoadCost : TRAVEL.roadCost;
  }
  return terrainCost(tile, season);
}

function isSnowy(tile: Tile, season: Season): boolean {
  return season === WINTER && (tile.terrain === 'mountain' || tile.terrain === 'hills');
}

export interface ShortestPaths {
  /** 칸마다 start에서 오는 최소 비용. 못 가면 Infinity */
  cost: number[];
  /** 칸마다 바로 앞 칸. start와 못 가는 칸은 -1 */
  prev: number[];
}

/** 다익스트라. 들어가는 칸의 비용을 더한다 (출발 칸 비용은 세지 않는다) */
export function shortestPaths(
  neighbors: readonly number[][],
  start: number,
  costOf: (tile: number) => number,
): ShortestPaths {
  const n = neighbors.length;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  cost[start] = 0;
  // 칸이 169개뿐이라 단순한 선형 탐색으로 충분하다. 같은 비용이면 번호가 작은 칸이 먼저라 결과가 고정된다.
  for (;;) {
    let cur = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && cost[i]! < Infinity && (cur === -1 || cost[i]! < cost[cur]!)) cur = i;
    }
    if (cur === -1) break;
    done[cur] = true;
    for (const nb of neighbors[cur]!) {
      if (done[nb]) continue;
      const c = costOf(nb);
      if (!Number.isFinite(c)) continue;
      const nc = cost[cur]! + c;
      if (nc < cost[nb]!) {
        cost[nb] = nc;
        prev[nb] = cur;
      }
    }
  }
  return { cost, prev };
}

/** start에서 target까지 칸 번호 목록 (양 끝 포함). 못 가면 빈 배열 */
export function pathTo(paths: ShortestPaths, start: number, target: number): number[] {
  if (!Number.isFinite(paths.cost[target]!)) return [];
  const out = [target];
  let c = target;
  while (c !== start) {
    c = paths.prev[c]!;
    out.push(c);
  }
  return out.reverse();
}

/** 비용을 날 수로. 최소 하루 */
export function costToDays(cost: number): number {
  return Number.isFinite(cost) ? Math.max(1, Math.round(cost / TRAVEL.costPerDay)) : Infinity;
}
