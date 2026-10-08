// 칸의 3D 위치. 칸 반지름 1, 평면 (x, y) → 3D (x, z).
import { hexToXY, type Tile } from '../sim/worldgen';
import { BASE_HEIGHT } from './palette';

/** 기둥 바닥 높이. 윗면 높이와 상관없이 모든 기둥이 여기서 시작한다 */
export const PRISM_BOTTOM = -0.6;

/** 윗면 높이 */
export function tileTop(tile: Tile): number {
  return BASE_HEIGHT[tile.terrain] + (tile.terrain === 'sea' ? 0 : (tile.height - 0.6) * 0.5);
}

export function tileCenter(tile: Tile): { x: number; y: number; z: number } {
  const { x, y } = hexToXY(tile.q, tile.r);
  return { x, y: tileTop(tile), z: y };
}
