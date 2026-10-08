export type Terrain = 'sea' | 'coast' | 'plain' | 'forest' | 'hills' | 'mountain';

/** 자원지 5종 */
export type ResourceKind = 'forest' | 'ore' | 'field' | 'fish' | 'salt';

export const RESOURCE_KINDS: readonly ResourceKind[] = ['forest', 'ore', 'field', 'fish', 'salt'];

export const RESOURCE_NAME: Record<ResourceKind, string> = {
  forest: '숲',
  ore: '광맥',
  field: '들판',
  fish: '어장',
  salt: '염전',
};

export const TERRAIN_NAME: Record<Terrain, string> = {
  sea: '바다',
  coast: '해안',
  plain: '평원',
  forest: '숲',
  hills: '언덕',
  mountain: '산',
};

/** 육각 칸 하나. 축 좌표(q, r)를 쓴다. 저장과 전송을 위해 다른 객체를 참조하지 않는다. */
export interface Tile {
  q: number;
  r: number;
  terrain: Terrain;
  /** 노이즈 높이와 습도. 지형을 정한 뒤에도 그림(3D 높이 등)에 쓸 수 있게 남긴다 */
  height: number;
  moisture: number;
  resource: ResourceKind | null;
  road: boolean;
}

/** 마을 규모. 생산 마을은 자원지 옆에서 원재료를 만들고, 도시는 길이 모이는 곳에서 사람과 돈이 많다 */
export type TownTier = 'town' | 'city';

export interface Town {
  id: number;
  name: string;
  tier: TownTier;
  /** WorldMap.tiles 안의 번호 */
  tile: number;
  /** 주변 자원지로 정해지는 특색. 많은 순, 최대 2개. 도시는 비어 있다 */
  specialties: ResourceKind[];
}

/** 지역 특색 태그가 붙은 땅 (원정 덱이 읽는다) */
export interface TaggedRegion {
  tag: RegionTagId;
  /** WorldMap.tiles 안의 번호 */
  tiles: number[];
}

export type RegionTagId = 'bears' | 'oldGrowth' | 'wolves' | 'exposedVein' | 'reef' | 'shoals' | 'fertile' | 'bandits';

export interface WorldMap {
  /** 요청한 시드 */
  requestedSeed: number;
  /** 규칙을 통과한 시드. 요청한 시드에서 1씩 올려 가며 찾는다 */
  seed: number;
  /** 몇 번째 지형에서 통과했나 */
  tries: number;
  radius: number;
  tiles: Tile[];
  towns: Town[];
  regions: TaggedRegion[];
}
