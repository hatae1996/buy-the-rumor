// 물품 9개.
import { ECONOMY } from '../constants';

export type GoodId = 'fish' | 'meat' | 'grain' | 'wood' | 'leather' | 'ore' | 'salt' | 'salted' | 'tools';

export const GOODS: readonly GoodId[] = ['fish', 'meat', 'grain', 'wood', 'leather', 'ore', 'salt', 'salted', 'tools'];

export const GOOD_NAME: Record<GoodId, string> = {
  fish: '생선',
  meat: '고기',
  grain: '곡물',
  wood: '목재',
  leather: '가죽',
  ore: '광석',
  salt: '소금',
  salted: '염장 식품',
  tools: '도구',
};

/** 먹을 수 있는 것 */
export const FOODS: readonly GoodId[] = ['fish', 'meat', 'grain', 'salted'];

/** 염장할 수 있는 날것 */
export const RAW_FOODS: readonly GoodId[] = ['fish', 'meat'];

export const basePrice = (g: GoodId): number => ECONOMY.goods[g].basePrice;

/** 상하는 날. 안 상하면 null */
export const shelfLife = (g: GoodId): number | null => ECONOMY.goods[g].shelfLife;

export function priceBounds(g: GoodId): { min: number; max: number } {
  return {
    min: Math.max(1, Math.round(basePrice(g) * ECONOMY.priceFloor)),
    max: Math.round(basePrice(g) * ECONOMY.priceCeiling),
  };
}

export const emptyGoodMap = <T>(value: T): Record<GoodId, T> =>
  Object.fromEntries(GOODS.map((g) => [g, value])) as Record<GoodId, T>;
