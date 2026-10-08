// 견습 뒤에도 시스템은 하나씩 열린다 (기획서 "처음 하는 플레이어" 두 번째 표).
// 첫 다른 마을 도착 → 내가 아는 시세와 소문, 첫 장날 실패 → 최소 가격 직접 고치기,
// 금화 300 → 예약 주문, 도시 첫 방문 → 은행, 손수레가 자주 꽉 참 → 말과 큰 수레 (일꾼 고용은 나중).
import { cartWeight } from '../cart';
import { ECONOMY } from '../constants';
import type { EconomyState } from '../economy/state';
import { maxWeight } from '../horses/pull';
import type { UnlockId } from './types';

const A = ECONOMY.apprentice;

function unlock(state: EconomyState, id: UnlockId): void {
  state.player.unlocks[id] ??= state.day;
}

/** 명령 뒤와 장날 뒤에 부른다. 견습 중에는 장면이 연다 */
export function updateUnlocks(state: EconomyState): void {
  const p = state.player;
  if (p.apprentice) return;
  if (!p.travel && p.town !== p.homeTown) {
    unlock(state, 'memory');
    unlock(state, 'rumors');
  }
  if (p.gold >= A.reservationGold) unlock(state, 'reservation');
  if (!p.travel && state.towns[p.town]!.tier === 'city') unlock(state, 'bank');
  if (p.fullDays >= A.fullDaysForHorses) unlock(state, 'horses');
}

/** 밤에: 수레가 거의 꽉 찬 날을 센다 (손수레 이상) */
export function countFullDay(state: EconomyState): void {
  const p = state.player;
  if (p.cart.type === 'pack') return;
  const cap = maxWeight(p.cart, p.horses);
  if (cap > 0 && cartWeight(p.cart) >= cap * A.fullShare) p.fullDays++;
}

/** 장날에 팔려고 낸 것이 다 팔리지 않았으면 (첫 장날 실패) 최소 가격을 직접 고칠 수 있게 된다 */
export function noteUnsold(state: EconomyState, offered: number, sold: number): void {
  if (!state.player.apprentice && offered > sold) unlock(state, 'editPrice');
}
