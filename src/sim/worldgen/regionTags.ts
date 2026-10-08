// 지역 특색 태그: 맵을 만들 때 땅 덩어리나 길에 랜덤으로 붙는 특징 (기획서 "채집: 원정 카드").
// 원정 덱이 이 태그를 읽어 그 지역 카드를 섞는다. 태그 목록은 데이터로 둔다.
import { WORLDGEN } from '../constants';
import type { Rng } from '../rng';
import type { RegionTagId, TaggedRegion, Terrain, Tile } from './types';

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
 */
export function tagRegions(
  tiles: readonly Tile[],
  neighbors: readonly number[][],
  roadLinks: readonly number[][],
  rng: Rng,
): TaggedRegion[] {
  const { regionTagChance, regionMinTiles } = WORLDGEN;
  const out: TaggedRegion[] = [];
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
    pick(kind, region.sort((a, b) => a - b));
  });

  for (const link of roadLinks) pick('road', [...link]);
  return out;
}
