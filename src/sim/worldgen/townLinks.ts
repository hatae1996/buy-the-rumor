// 길로 바로 이어진 마을: 다른 마을을 거치지 않고 길 칸만 따라 닿는 마을끼리 이웃이다.
// 소문이 "길을 따라 하루에 한 마을씩" 건너는 그래프로 쓴다 (기획서 "소문").
import { buildNeighbors } from './hex';
import type { WorldMap } from './types';

const linkCache = new WeakMap<WorldMap, number[][]>();
const hopCache = new WeakMap<WorldMap, number[][]>();

/** links[a]: 마을 a와 길로 바로 이어진 마을 번호들 (작은 순). 돌려받은 표는 고치지 않는다 */
export function townLinks(map: WorldMap): number[][] {
  let links = linkCache.get(map);
  if (links) return links;
  const nbs = buildNeighbors(map.tiles);
  const townAt = new Map(map.towns.map((t) => [t.tile, t.id] as const));
  links = map.towns.map((from) => {
    const found = new Set<number>();
    const seen = new Set([from.tile]);
    const queue = [from.tile];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of nbs[cur]!) {
        if (seen.has(n) || !map.tiles[n]!.road) continue;
        seen.add(n);
        const town = townAt.get(n);
        // 다른 마을에 닿으면 그 너머로는 가지 않는다
        if (town !== undefined) found.add(town);
        else queue.push(n);
      }
    }
    return [...found].sort((a, b) => a - b);
  });
  linkCache.set(map, links);
  return links;
}

/** hops[a][b]: a에서 b까지 거치는 마을 수 (이웃이면 1). 못 가면 Infinity */
export function townHops(map: WorldMap): number[][] {
  let hops = hopCache.get(map);
  if (hops) return hops;
  const links = townLinks(map);
  hops = map.towns.map((from) => {
    const dist = map.towns.map(() => Infinity);
    dist[from.id] = 0;
    const queue = [from.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of links[cur]!) {
        if (dist[n] !== Infinity) continue;
        dist[n] = dist[cur]! + 1;
        queue.push(n);
      }
    }
    return dist;
  });
  hopCache.set(map, hops);
  return hops;
}
