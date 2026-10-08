// 자원지: 마을 주변 두 칸 안의 자원지 칸으로 만든다. 숲, 광맥, 어장은 쓰면 줄고 천천히 회복한다.
import { ECONOMY, WORLDGEN } from '../constants';
import { buildNeighbors, cellsAround, type ResourceKind, type WorldMap } from '../worldgen';
import type { ResourceNode, TownEconomy } from './state';

/** 마을 주변 자원지. 도시는 자원지 옆이 아니라서 채집 일꾼이 없다 */
export function townNodes(map: WorldMap, townId: number): ResourceNode[] {
  const town = map.towns[townId]!;
  if (town.tier === 'city') return [];
  const area = [town.tile, ...cellsAround(buildNeighbors(map.tiles), town.tile, WORLDGEN.specialtyRange)];
  const tiles = new Map<ResourceKind, number>();
  for (const i of area) {
    const r = map.tiles[i]!.resource;
    if (r) tiles.set(r, (tiles.get(r) ?? 0) + 1);
  }
  return [...tiles].map(([kind, n]) => {
    const capacity = n * ECONOMY.node.capacityPerTile;
    return { kind, tiles: n, amount: capacity, capacity };
  });
}

export function findNode(town: TownEconomy, kind: ResourceKind): ResourceNode | undefined {
  return town.nodes.find((n) => n.kind === kind);
}

export function depletes(kind: ResourceKind): boolean {
  return ECONOMY.node.regrowth[kind] !== null;
}

/** 남은 양에 따른 생산 배율. 줄지 않는 자원지는 늘 1 */
export function nodeYield(node: ResourceNode): number {
  return depletes(node.kind) ? 0.4 + 0.6 * (node.amount / node.capacity) : 1;
}

export function regrow(node: ResourceNode): void {
  const r = ECONOMY.node.regrowth[node.kind];
  if (r === null) return;
  node.amount = Math.min(node.capacity, Math.max(0, node.amount + r * node.amount * (1 - node.amount / node.capacity) + 0.3));
}
