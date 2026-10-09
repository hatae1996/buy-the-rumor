// 수레 칸 모양과 물품 모양. 좌표는 [x, y] (오른쪽, 아래로 증가).
import { CART, ECONOMY, FOOD, GROWTH } from '../constants';
import { GOOD_NAME, shelfLife, type GoodId } from '../economy/goods';
import type { GearKind } from '../expedition/types';

export type CartType = keyof typeof CART.types;
/** 짐을 싣는 판: 수레 4종과 창고 */
export type BoardType = CartType | 'warehouse';
export type Cell = readonly [number, number];

export const CART_TYPES = Object.keys(CART.types) as CartType[];

/**
 * 짐칸에 싣는 것: 장날 물품, 장비, 여행 식량 (0.1.2). 장비와 여행 식량은 장날에서 사고팔지 않는다
 */
export type ItemId = GoodId | GearKind | 'rations';
/** 물품이 아닌 짐 */
export type NonGoodItem = Exclude<ItemId, GoodId>;

/** 장날 물품인가 (장비, 여행 식량이 아닌가) */
export function isGood(item: ItemId): item is GoodId {
  return item in CART.goods;
}

/** 장비인가 */
export function isGear(item: ItemId): item is GearKind {
  return item !== 'rations' && item in CART.items;
}

interface ItemSpec {
  shape: readonly (readonly [number, number])[];
  stack: number;
  weight: number;
}

function specOf(item: ItemId): ItemSpec {
  return isGood(item) ? CART.goods[item] : CART.items[item];
}

/** 짐 이름 (물품, 장비, 여행 식량) */
export function itemName(item: ItemId): string {
  if (isGood(item)) return GOOD_NAME[item];
  return item === 'rations' ? '여행 식량' : ECONOMY.expedition.gear[item].name;
}

/** 보관 기간 (날). 장비는 상하지 않는다 */
export function itemShelfLife(item: ItemId): number | null {
  if (isGood(item)) return shelfLife(item);
  return item === 'rations' ? FOOD.rations.shelfLife : null;
}

// 모양은 상수 데이터에서만 나오니 한 번 계산해 기억한다 (빈자리 찾기가 자주 부른다). 돌려받은 배열은 고치지 않는다
const slotsCache = new Map<BoardType, Cell[]>();
const shapeCache = new Map<ItemId, Cell[][]>();
const rotationsCache = new Map<ItemId, number[]>();

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
export function shapeOf(good: ItemId, rot: number): Cell[] {
  const r = ((rot % 4) + 4) % 4;
  let byRot = shapeCache.get(good);
  if (!byRot) shapeCache.set(good, (byRot = []));
  const cached = byRot[r];
  if (cached) return cached;
  let cells: Cell[] = specOf(good).shape.map(([x, y]) => [x, y] as const);
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) cells = cells.map(([x, y]) => [-y, x] as const);
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const out = cells.map(([x, y]) => [x - minX, y - minY] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  byRot[r] = out;
  return out;
}

/** 서로 다른 모양이 되는 회전들 (1칸 짜리는 하나뿐) */
export function distinctRotations(good: ItemId): number[] {
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

export const stackLimit = (good: ItemId): number => specOf(good).stack;
export const unitWeight = (good: ItemId): number => specOf(good).weight;
