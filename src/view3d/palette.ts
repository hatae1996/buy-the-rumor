// 3D 지도 색 (로우폴리, 2026-10-10). 계절 순서는 봄, 여름, 가을, 겨울.
// 봄은 파스텔(하늘빛 바다, 연두 들판, 벚꽃)로 산뜻하게, 겨울은 눈.
// 칸 윗면은 밝은 색과 어두운 색 둘 중 하나를 칸마다 고르고(얼룩덜룩하게), 옆면은 같은 색을 어둡게 칠한다.
import type { Terrain } from '../sim/worldgen';

type BySeason<T> = readonly [T, T, T, T];
/** 밝은 칸, 어두운 칸 */
type Pair = readonly [number, number];

export const TILE_COLOR: Record<Terrain, BySeason<Pair>> = {
  sea: [
    [0x78bcd6, 0x6bb0cc],
    [0x3a6f7c, 0x326571],
    [0x3d6a73, 0x355f69],
    [0x6f95a0, 0x648995],
  ],
  coast: [
    [0xf4e7c0, 0xebdcb0],
    [0xe0cc88, 0xd0bb78],
    [0xd6bf86, 0xc6ae76],
    [0xe9ece8, 0xdfe3e0],
  ],
  plain: [
    [0xcbe8a4, 0xb8de90],
    [0xb5cf5c, 0x9bbd4c],
    [0xcdb85f, 0xb9a24e],
    [0xf1f4f4, 0xe4e9ea],
  ],
  forest: [
    [0xa6d38e, 0x97c882],
    [0x648f42, 0x557f39],
    [0x8f8a45, 0x7e7a3c],
    [0xe3e8e8, 0xd6dddd],
  ],
  hills: [
    [0xb6db94, 0xa8d188],
    [0x8dad4a, 0x7e9e41],
    [0xab9a4f, 0x9a8a45],
    [0xe9edee, 0xdde3e4],
  ],
  mountain: [
    [0xbab5c2, 0xaca7b6],
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
  [0x7fbf73, 0x6fb267, 0x93ca80],
  [0x2f5a30, 0x284f2b, 0x386536],
  [0x2f5a30, 0xc0662e, 0xd49a34, 0x9c4a2a],
  [0x3a5446, 0x324b3e],
];
export const SNOW = 0xf0f3f4;

/** 봄: 숲에 섞이는 동그란 벚꽃나무와 들판의 꽃 */
export const BLOSSOM = [0xf6b9cb, 0xf9cdd9, 0xf2a7bf, 0xfbe0e7] as const;
export const FLOWER = [0xf7b3c6, 0xffffff, 0xd9c2ef, 0xf9d27e, 0xf49fb4] as const;
/** 계절마다 덤불과 언덕 둔덕 색 */
export const BUSH_COLOR: BySeason<number> = [0x9fd280, 0x6f9a3e, 0x9a8a45, SNOW];
/** 산 바위: 큰 봉우리, 작은 봉우리. 봄은 연보랏빛 회색 */
export const ROCK_COLOR: BySeason<Pair> = [
  [0xb9b2c4, 0xa7a0b4],
  [0x8f8d84, 0x75736b],
  [0x8f8d84, 0x75736b],
  [0x8f8d84, 0x75736b],
];

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
