// 지역 특색 태그: 맵을 만들 때 땅 덩어리나 길에 랜덤으로 붙는 특징 (기획서 "채집: 원정 카드").
// 원정 덱이 이 태그를 읽어 그 지역 카드를 섞는다. 태그 목록은 데이터로 둔다.
import { WORLDGEN } from '../constants';
import type { Rng } from '../rng';
import { cellsAround } from './hex';
import type { RegionTagId, TaggedRegion, Terrain, Tile, WorldMap } from './types';

/** 태그가 붙는 땅의 종류 */
export type RegionKind = 'forest' | 'highland' | 'coast' | 'plain' | 'road';

export interface RegionTagDef {
  id: RegionTagId;
  name: string;
  kind: RegionKind;
}

export const REGION_TAGS: readonly RegionTagDef[] = [
  { id: 'bears', name: '곰이 사는 숲', kind: 'forest' },
  { id: 'oldGrowth', name: '아름드리 고목 숲', kind: 'forest' },
  { id: 'wolves', name: '늑대가 많은 언덕', kind: 'highland' },
  { id: 'exposedVein', name: '광맥 줄기가 드러난 산', kind: 'highland' },
  { id: 'reef', name: '암초가 많은 바닷가', kind: 'coast' },
  { id: 'shoals', name: '물고기 떼가 드나드는 바닷가', kind: 'coast' },
  { id: 'fertile', name: '기름진 들판', kind: 'plain' },
  // 말을 기르는 곳. 근처 생산 마을에 마구간이 생긴다 (기획서 "말"). 맵마다 최소 한 곳
  { id: 'ranch', name: '말을 기르는 목장', kind: 'plain' },
  { id: 'bandits', name: '산적이 나오는 길', kind: 'road' },
];

export const regionTag = (id: RegionTagId): RegionTagDef => REGION_TAGS.find((t) => t.id === id)!;

const KIND_OF: Record<Terrain, RegionKind | null> = {
  forest: 'forest',
  hills: 'highland',
  mountain: 'highland',
  coast: 'coast',
  plain: 'plain',
  sea: null,
};

export function terrainRegionKind(t: Terrain): RegionKind | null {
  return KIND_OF[t];
}

/**
 * 같은 종류 땅이 이어진 덩어리와 마을 사이 길마다, 정해진 확률로 그 종류의 태그 하나를 붙인다.
 * roadLinks는 마을 사이 길 칸들 (마을 칸은 빼고 넘긴다).
 * 목장은 생산 마을(producerTiles) 근처에 최소 한 곳 생기도록 맞춘다.
 */
export function tagRegions(
  tiles: readonly Tile[],
  neighbors: readonly number[][],
  roadLinks: readonly number[][],
  producerTiles: readonly number[],
  rng: Rng,
  ranchTowns: number,
): TaggedRegion[] {
  const { regionTagChance, regionMinTiles } = WORLDGEN;
  const out: TaggedRegion[] = [];
  const plainRegions: number[][] = [];
  const pick = (kind: RegionKind, regionTiles: number[]) => {
    const options = REGION_TAGS.filter((t) => t.kind === kind);
    if (regionTiles.length < regionMinTiles || options.length === 0) return;
    if (rng.next() >= regionTagChance) return;
    out.push({ tag: options[rng.int(0, options.length - 1)]!.id, tiles: regionTiles });
  };

  // 땅 덩어리 (칸 번호 순서로 훑어 결과가 고정된다)
  const seen = new Array<boolean>(tiles.length).fill(false);
  tiles.forEach((t, start) => {
    const kind = KIND_OF[t.terrain];
    if (!kind || seen[start]) return;
    const region: number[] = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const i = stack.pop()!;
      region.push(i);
      for (const n of neighbors[i]!) {
        if (!seen[n] && KIND_OF[tiles[n]!.terrain] === kind) {
          seen[n] = true;
          stack.push(n);
        }
      }
    }
    region.sort((a, b) => a - b);
    if (kind === 'plain') plainRegions.push(region);
    pick(kind, region);
  });

  for (const link of roadLinks) pick('road', [...link]);
  ensureRanch(tiles, neighbors, producerTiles, out, plainRegions, ranchTowns);
  return out;
}

/**
 * 목장 특색이 근처(특색 범위 안)에 있는 생산 마을이 ranchTowns곳이 되게 한다 (0.0.7: 마구간 마을은 마을 4곳 맵에 2곳, 크기별 수는 WORLDGEN.sizes).
 * 모자라면 아직 목장이 없는 생산 마을마다, 그 마을 근처 들판 덩어리를 목장으로 만든다 (없으면 바로 옆 땅)
 */
function ensureRanch(
  tiles: readonly Tile[],
  neighbors: readonly number[][],
  producerTiles: readonly number[],
  out: TaggedRegion[],
  plains: readonly number[][],
  ranchTowns: number,
): void {
  const area = (t: number) => new Set([t, ...cellsAround(neighbors, t, WORLDGEN.specialtyRange)]);
  const served = (t: number) => {
    const near = area(t);
    return out.some((r) => r.tag === 'ranch' && r.tiles.some((i) => near.has(i)));
  };
  // 태그가 없는 들판 덩어리 먼저, 그다음 큰 것
  const tagged = (region: readonly number[]) => out.findIndex((r) => r.tiles[0] === region[0] && r.tiles.length === region.length);
  for (const town of producerTiles) {
    if (producerTiles.filter(served).length >= ranchTowns) return;
    if (served(town)) continue;
    const near = area(town);
    const candidates = plains
      .filter((r) => r.some((i) => near.has(i)) && (tagged(r) < 0 || out[tagged(r)]!.tag !== 'ranch'))
      .sort((a, b) => Number(tagged(a) >= 0) - Number(tagged(b) >= 0) || b.length - a.length || a[0]! - b[0]!);
    const region = candidates[0];
    if (region) {
      const at = tagged(region);
      if (at >= 0) out[at] = { tag: 'ranch', tiles: [...region] };
      else out.push({ tag: 'ranch', tiles: [...region] });
      continue;
    }
    // 들판 덩어리가 없으면 근처 들판 칸 하나와 이어진 들판 칸들로 (그것도 없으면 이 마을은 건너뛴다:
    // 맵 규칙 'ranch'가 못 맞추면 다른 지형으로 다시 만든다)
    const start = [...near].filter((i) => tiles[i]!.terrain === 'plain' && !out.some((r) => r.tiles.includes(i))).sort((a, b) => a - b)[0];
    if (start === undefined) continue;
    const land = [start];
    for (let k = 0; k < land.length; k++) {
      for (const n of neighbors[land[k]!]!) if (near.has(n) && tiles[n]!.terrain === 'plain' && !land.includes(n) && !out.some((r) => r.tiles.includes(n))) land.push(n);
    }
    out.push({ tag: 'ranch', tiles: land.sort((a, b) => a - b) });
  }
}

/** 이 태그가 특색 범위 안에 있는 마을들 (목장이면 마구간이 있는 마을) */
export function townsNearTag(map: WorldMap, neighbors: readonly number[][], tag: RegionTagId): number[] {
  const tagTiles = new Set(map.regions.filter((r) => r.tag === tag).flatMap((r) => r.tiles));
  return map.towns
    .filter((t) => [t.tile, ...cellsAround(neighbors, t.tile, WORLDGEN.specialtyRange)].some((i) => tagTiles.has(i)))
    .map((t) => t.id);
}
