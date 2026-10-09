// 플레이어 몸: 피로와 원정 기회 (기획서 "퍼즐 기회와 피로도").
// 기회는 "어디서 할 수 있나"를, 피로는 "몇 번이나 할 수 있나"를 정한다.
import { cartLots } from '../cart';
import { ECONOMY } from '../constants';
import { seasonOfDay } from '../season';
import { FOODS, shelfLife, type GoodId } from './goods';
import type { Lot } from './inventory';
import type { EconomyState, PlayerState, TownEconomy } from './state';

const F = ECONOMY.fatigue;

/** 원정을 나갈 수 있는 마을인가 (자원지가 있어야 한다. 도시는 없다) */
export function hasExpeditions(town: TownEconomy): boolean {
  return town.nodes.length > 0;
}

/** 밤마다: 저절로 조금 회복하고, 머무는 마을에 원정 기회가 하나 쌓인다 (길 위면 없다) */
export function playerNight(state: EconomyState, p: PlayerState): void {
  p.fatigue = Math.max(0, p.fatigue - F.nightlyRecovery);
  p.mealsToday = 0;
  p.restedToday = false;
  p.drankToday = false;
  if (p.travel) p.expeditionChances = 0;
  else if (hasExpeditions(state.towns[p.town]!)) {
    p.expeditionChances = Math.min(ECONOMY.expedition.maxChances, p.expeditionChances + 1);
  }
}

/** 음식 한 개로 줄어드는 피로. 신선할수록 많이 */
export function mealRecovery(lot: Lot, rate: number): number {
  const life = shelfLife(lot.good);
  if (life === null) return F.meal.keeps;
  if (lot.age + rate >= life) return F.meal.soon;
  if (lot.age < life * 0.4) return F.meal.fresh;
  return F.meal.days;
}

/** 먹을 묶음: 그 물건 중 가장 먼저 상할 것부터 */
export function pickMeal(p: PlayerState, good: GoodId): Lot | null {
  if (!FOODS.includes(good)) return null;
  const lots = cartLots(p.cart).filter((l) => l.good === good && l.qty > 0);
  if (lots.length === 0) return null;
  return lots.reduce((a, l) => (l.age > a.age ? l : a));
}

export function innOf(town: TownEconomy): { fee: number; recovery: number } {
  return town.tier === 'city' ? F.inn.city : F.inn.town;
}

/** 오늘 계절의 상하는 배율 */
export function spoilRateToday(state: EconomyState): number {
  return ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)];
}
