// 견습 뒤에도 시스템은 하나씩 열린다 (기획서 "처음 하는 플레이어" 두 번째 표).
// 첫 다른 마을 도착 → 내가 아는 시세와 소문, 첫 장날 실패 → 최소 가격 직접 고치기,
// 금화 300 → 예약 주문, 도시 첫 방문 → 은행.
// 0.0.5부터 성장에는 단계가 없어 "손수레가 자주 꽉 차면 말과 큰 수레"는 막지 않는다 (마구간·수레방은 그 마을에 가면 늘 있다).
import { ECONOMY } from '../constants';
import type { EconomyState } from '../economy/state';
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
}

/** 장날에 팔려고 낸 것이 다 팔리지 않았으면 (첫 장날 실패) 최소 가격을 직접 고칠 수 있게 된다 */
export function noteUnsold(state: EconomyState, offered: number, sold: number): void {
  if (!state.player.apprentice && offered > sold) unlock(state, 'editPrice');
}
