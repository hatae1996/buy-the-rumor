// 길의 식량 (0.1.2, 기획서 "직접 해 본 뒤 고친 것 - 식량").
// 이동하는 날마다 사람이 식량을 먹는다: 나와 짐꾼은 내 수레·짐꾼 수레에서, 두 번째 행렬의 마부는 행렬 수레에서.
// 음식 물품(생선, 고기, 곡물, 염장 식품)과 잡화점 여행 식량 중 먼저 상할 것부터 하나에 식량 1.
// 떨어지면 그날 피로가 크게 오르고 남은 길이 늘어난다. 죽거나 짐을 잃지는 않는다. 마을에 머무는 날은 먹지 않는다.
import { cartCount, itemShelfLife, loadGoods, roomFor, takeGoods, type Board, type ItemId } from '../cart';
import { ECONOMY, FOOD } from '../constants';
import { porterBoards } from '../hire/boards';
import { FOODS } from './goods';
import type { EconomyState, PlayerState, Travel } from './state';

/** 길에서 먹을 수 있는 것 */
export const ROAD_FOODS: readonly ItemId[] = [...FOODS, 'rations'];

/** 판들에 실린 식량 수 */
export function foodOn(boards: readonly Board[]): number {
  return boards.reduce((s, b) => s + ROAD_FOODS.reduce((a, f) => a + cartCount(b, f), 0), 0);
}

/** 내 행렬과 함께 다니는 사람: 나 + 짐꾼 (마부는 두 번째 행렬과 다닌다) */
export function travellers(p: PlayerState): number {
  return 1 + p.hires.filter((h) => h.role === 'porter').length;
}

/** 내 행렬이 하루에 먹는 식량 */
export function foodPerDay(p: PlayerState): number {
  return travellers(p) * FOOD.perPersonPerDay;
}

/** 내 행렬의 식량 (내 수레 + 짐꾼 수레) */
export function myFood(p: PlayerState): number {
  return foodOn([p.cart, ...porterBoards(p)]);
}

/**
 * 판들에서 식량 n을 먹는다: 먼저 상할 것부터(남은 날이 적은 묶음). 먹은 것과 모자란 양을 돌려준다.
 * 같은 물건이 여러 판에 있으면 앞 판부터
 */
export function eatFrom(boards: readonly Board[], n: number): { eaten: { good: ItemId; qty: number }[]; short: number } {
  const eaten = new Map<ItemId, number>();
  let left = n;
  while (left > 0) {
    // 남은 날이 가장 적은 식량 묶음을 찾는다
    let best: { board: Board; good: ItemId; leftDays: number } | null = null;
    for (const board of boards) {
      for (const piece of board.pieces) {
        if (!ROAD_FOODS.includes(piece.good) || piece.uses !== undefined) continue;
        const life = itemShelfLife(piece.good) ?? Infinity;
        for (const l of piece.lots) {
          if (l.qty <= 0) continue;
          const leftDays = life - l.age;
          if (!best || leftDays < best.leftDays) best = { board, good: piece.good, leftDays };
        }
      }
    }
    if (!best) break;
    const got = takeGoods(best.board, best.good, 1).reduce((s, l) => s + l.qty, 0);
    if (got === 0) break;
    eaten.set(best.good, (eaten.get(best.good) ?? 0) + got);
    left -= got;
  }
  return { eaten: [...eaten].map(([good, qty]) => ({ good, qty })), short: left };
}

/**
 * 길 위의 밤에 먹는다. 모자라면 배고픈 날: 피로가 오르고, 남은 길이 늘어난다(늘어난 몫이 하루를 넘으면 남은 날 +1).
 * 배고팠으면 true
 */
export function eatOnRoad(state: EconomyState, p: PlayerState, travel: Travel): boolean {
  const need = foodPerDay(p);
  const { eaten, short } = eatFrom([p.cart, ...porterBoards(p)], need);
  p.ledger.push({ day: state.day, kind: 'roadFood', eaten, short });
  if (short <= 0) return false;
  p.fatigue = Math.min(ECONOMY.fatigue.max, p.fatigue + FOOD.hungryFatigue);
  slowDown(travel);
  return true;
}

/** 배고픈 날: 남은 길이 늘어난다 */
export function slowDown(travel: Travel): void {
  travel.hunger = (travel.hunger ?? 0) + FOOD.hungrySlowDays;
  if (travel.hunger >= 1) {
    travel.hunger -= 1;
    travel.daysLeft += 1;
    travel.days += 1;
  }
}

/** 잡화점 여행 식량 값: 그 마을 곡물·염장 식품 시세 평균의 priceFactor배 (하나당, 적어도 1) */
export function rationPrice(state: EconomyState, town: number): number {
  const ref = state.towns[town]!.refPrice;
  return Math.max(1, Math.round(((ref.grain + ref.salted) / 2) * FOOD.rations.priceFactor));
}

/** 잡화점에서 여행 식량을 산다 (모든 마을). 실을 수 있는 만큼, 값은 마을 금고로 */
export function buyRations(state: EconomyState, p: PlayerState, qty: number): 'traveling' | 'badQty' | 'noRoom' | 'notEnoughGold' | null {
  if (p.travel) return 'traveling';
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  const price = rationPrice(state, p.town);
  const n = Math.min(qty, roomFor(p.cart, 'rations', qty), Math.floor(p.gold / price));
  if (n <= 0) return roomFor(p.cart, 'rations', 1) === 0 ? 'noRoom' : 'notEnoughGold';
  loadGoods(p.cart, 'rations', n, 0, price);
  p.gold -= n * price;
  state.towns[p.town]!.treasury += n * price;
  p.ledger.push({ day: state.day, kind: 'rations', town: p.town, qty: n, price });
  return null;
}
