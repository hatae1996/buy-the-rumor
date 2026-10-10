// 3D 지도 색 (로우폴리, 2026-10-10). 계절 순서는 봄, 여름, 가을, 겨울.
// 칸 윗면은 밝은 색과 어두운 색 둘 중 하나를 칸마다 고르고(얼룩덜룩하게), 옆면은 같은 색을 어둡게 칠한다.
import type { Terrain } from '../sim/worldgen';

type BySeason<T> = readonly [T, T, T, T];
/** 밝은 칸, 어두운 칸 */
type Pair = readonly [number, number];

export const TILE_COLOR: Record<Terrain, BySeason<Pair>> = {
  sea: [
    [0x3f7480, 0x376a76],
    [0x3a6f7c, 0x326571],
    [0x3d6a73, 0x355f69],
    [0x6f95a0, 0x648995],
  ],
  coast: [
    [0xdccb8e, 0xcdbb7e],
    [0xe0cc88, 0xd0bb78],
    [0xd6bf86, 0xc6ae76],
    [0xe9ece8, 0xdfe3e0],
  ],
  plain: [
    [0xbcd468, 0xa3c257],
    [0xb5cf5c, 0x9bbd4c],
    [0xcdb85f, 0xb9a24e],
    [0xf1f4f4, 0xe4e9ea],
  ],
  forest: [
    [0x6f9a48, 0x5f8a3f],
    [0x648f42, 0x557f39],
    [0x8f8a45, 0x7e7a3c],
    [0xe3e8e8, 0xd6dddd],
  ],
  hills: [
    [0x95b452, 0x86a548],
    [0x8dad4a, 0x7e9e41],
    [0xab9a4f, 0x9a8a45],
    [0xe9edee, 0xdde3e4],
  ],
  mountain: [
    [0x8d8a7d, 0x7f7c70],
    [0x88857a, 0x7a776c],
    [0x8a8274, 0x7c7468],
    [0xc9cfd2, 0xbcc3c6],
  ],
};

/** 겨울에 해안에 닿은 바다는 언다 */
export const FROZEN_SEA = 0xcfe2e8;

/** 옆면은 윗면 색에 이만큼 곱한다 (빛을 덜 받는 쪽은 조명이 더 어둡게 한다) */
export const SIDE_SHADE = 0.74;

/** 바늘잎나무. 가을엔 몇 그루가 물든다. 겨울엔 짙은 초록에 눈이 얹힌다 */
export const TREE_COLOR: BySeason<readonly number[]> = [
  [0x3d6b3a, 0x335e33, 0x47763f],
  [0x2f5a30, 0x284f2b, 0x386536],
  [0x2f5a30, 0xc0662e, 0xd49a34, 0x9c4a2a],
  [0x3a5446, 0x324b3e],
];
export const SNOW = 0xf0f3f4;

/** 기둥 높이: 지형마다 기본값 + 노이즈 높이를 HEIGHT_STEP 계단으로 끊는다 */
export const BASE_HEIGHT: Record<Terrain, number> = {
  sea: 0.2,
  coast: 0.45,
  plain: 0.6,
  forest: 0.7,
  hills: 1.05,
  mountain: 1.5,
};
/** 노이즈 높이를 얼마나 크게 반영하나 */
export const HEIGHT_RELIEF = 0.9;
export const HEIGHT_STEP = 0.18;

export const INK = 0x2a1e16;
export const BACKGROUND = 0x2e2219;

export const PROP = {
  trunk: 0x6b4423,
  rock: 0x8f8d84,
  rockDark: 0x75736b,
  bush: 0x6f9a3e,
  wheat: 0xd8a23a,
  ore: 0x5b6ea0,
  salt: 0xffffff,
  boat: 0x8c5a2b,
  road: 0x7a5a3c,
  wall: 0xf1e2c6,
  roof: 0xd2594b,
  cityRoof: 0x2e9c98,
} as const;

/** 내 상단은 빨강, 다른 상단들 */
export const PAWN_COLORS = [0xd2594b, 0x2e9c98, 0xe6b43c, 0x6d4c8e] as const;
/** 내 말 발밑 고리 (밝은 종이색: 초록 들판과 바다 위에서 잘 보인다) */
export const MARKER_RING = 0xfff4d6;
