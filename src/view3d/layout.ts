// 칸의 3D 위치. 칸 반지름 1, 평면 (x, y) → 3D (x, z).
import { hexToXY, type Tile } from '../sim/worldgen';
import { BASE_HEIGHT, HEIGHT_RELIEF, HEIGHT_STEP } from './palette';

/** 기둥 바닥 높이. 윗면 높이와 상관없이 모든 기둥이 여기서 시작한다 */
export const PRISM_BOTTOM = -0.6;

/** 윗면 높이: 노이즈 높이를 계단으로 끊어 기둥 높이가 층층이 보이게 한다. 바다는 평평하다 */
export function tileTop(tile: Tile): number {
  if (tile.terrain === 'sea') return BASE_HEIGHT.sea;
  const raw = BASE_HEIGHT[tile.terrain] + (tile.height - 0.6) * HEIGHT_RELIEF;
  return Math.max(BASE_HEIGHT.sea + HEIGHT_STEP, Math.round(raw / HEIGHT_STEP) * HEIGHT_STEP);
}

export function tileCenter(tile: Tile): { x: number; y: number; z: number } {
  const { x, y } = hexToXY(tile.q, tile.r);
  return { x, y: tileTop(tile), z: y };
}

/** 칸 좌표로 정하는 0~1 값 (소품 자리, 칸 색 얼룩). 세계 난수를 쓰지 않아 그림만 바뀐다 */
export function tileHash(q: number, r: number, k = 0): number {
  let h = Math.imul(q, 374761393) ^ Math.imul(r, 668265263) ^ Math.imul(k + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
