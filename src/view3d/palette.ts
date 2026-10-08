// 3D 지도 색. prototypes/hexmap-3d.html의 값을 옮겼다. 계절 순서는 봄, 여름, 가을, 겨울.
import type { Terrain } from '../sim/worldgen';

type BySeason = readonly [number, number, number, number];

export const TOP_COLOR: Record<Terrain, BySeason> = {
  sea: [0x5fa8b8, 0x4fa0b4, 0x5a9cac, 0x8fb9c6],
  coast: [0xe6cf9e, 0xead39a, 0xe2c79a, 0xede8dc],
  plain: [0xa9c96a, 0x9cc05a, 0xc9b868, 0xf2f5f6],
  forest: [0x7db466, 0x6aa857, 0xb59a55, 0xf0f3f4],
  hills: [0xb9ae6a, 0xb0a35e, 0xb9a061, 0xf2f5f6],
  mountain: [0x9a9283, 0x958c7c, 0x8c8577, 0xe9edef],
};

/** 겨울에 해안에 닿은 바다는 언다 */
export const FROZEN_SEA = 0xcfe2e8;

export const SIDE_COLOR: Record<Terrain, number> = {
  sea: 0x3f7f8c,
  coast: 0xb89a6a,
  plain: 0x8a6e4a,
  forest: 0x7a5e3e,
  hills: 0x7e6a48,
  mountain: 0x6e675c,
};

export const TREE_COLOR: BySeason = [0x3f8f4c, 0x2f7a40, 0xc8642e, 0x5d7a6a];
export const SNOW = 0xf0f3f4;

/** 기둥 높이 (지형마다 기본값 + 노이즈 높이) */
export const BASE_HEIGHT: Record<Terrain, number> = {
  sea: 0.25,
  coast: 0.5,
  plain: 0.65,
  forest: 0.75,
  hills: 1.15,
  mountain: 1.55,
};

export const INK = 0x2a1e16;
export const BACKGROUND = 0x2e2219;

export const PROP = {
  trunk: 0x6b4423,
  mountain: 0x8a8274,
  hills: 0x9c9150,
  wheat: 0xd8a23a,
  ore: 0x5b6ea0,
  salt: 0xffffff,
  boat: 0x8c5a2b,
  road: 0x6b4a32,
  wall: 0xf1e2c6,
  roof: 0xd2594b,
} as const;

/** 내 상단은 빨강, 다른 상단들 */
export const PAWN_COLORS = [0xd2594b, 0x2e9c98, 0xe6b43c, 0x6d4c8e] as const;
