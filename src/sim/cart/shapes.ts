// 수레 칸 모양과 물품 모양. 좌표는 [x, y] (오른쪽, 아래로 증가).
import { CART, GROWTH } from '../constants';
import type { GoodId } from '../economy/goods';

export type CartType = keyof typeof CART.types;
/** 짐을 싣는 판: 수레 4종과 창고 */
export type BoardType = CartType | 'warehouse';
export type Cell = readonly [number, number];

export const CART_TYPES = Object.keys(CART.types) as CartType[];

// 모양은 상수 데이터에서만 나오니 한 번 계산해 기억한다 (빈자리 찾기가 자주 부른다). 돌려받은 배열은 고치지 않는다
const slotsCache = new Map<BoardType, Cell[]>();
const shapeCache = new Map<string, Cell[]>();
const rotationsCache = new Map<GoodId, number[]>();

/** 판의 모양 (수레마다, 창고) */
export function boardRows(type: BoardType): readonly string[] {
  return type === 'warehouse' ? GROWTH.warehouse.rows : CART.types[type].rows;
}

/** 수레에서 실을 수 있는 칸들 */
export function cartSlots(type: BoardType): Cell[] {
  const cached = slotsCache.get(type);
  if (cached) return cached;
  const out: Cell[] = [];
  boardRows(type).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') out.push([x, y]);
  });
  slotsCache.set(type, out);
  return out;
}

export function cartSize(type: BoardType): { w: number; h: number } {
  const rows = boardRows(type);
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

/** 90도씩 rot번 돌린 모양. 돌린 뒤 가장 왼쪽 위가 (0, 0)이 되게 옮긴다 */
export function shapeOf(good: GoodId, rot: number): Cell[] {
  const k = `${good}:${((rot % 4) + 4) % 4}`;
  const cached = shapeCache.get(k);
  if (cached) return cached;
  let cells: Cell[] = CART.goods[good].shape.map(([x, y]) => [x, y] as const);
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) cells = cells.map(([x, y]) => [-y, x] as const);
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const out = cells.map(([x, y]) => [x - minX, y - minY] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  shapeCache.set(k, out);
  return out;
}

/** 서로 다른 모양이 되는 회전들 (1칸 짜리는 하나뿐) */
export function distinctRotations(good: GoodId): number[] {
  const cached = rotationsCache.get(good);
  if (cached) return cached;
  const seen = new Set<string>();
  const out = [0, 1, 2, 3].filter((rot) => {
    const key = JSON.stringify(shapeOf(good, rot));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  rotationsCache.set(good, out);
  return out;
}

export const stackLimit = (good: GoodId): number => CART.goods[good].stack;
export const unitWeight = (good: GoodId): number => CART.goods[good].weight;
