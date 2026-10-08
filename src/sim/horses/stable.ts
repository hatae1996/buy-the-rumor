// 마구간 거래 (기획서 "말"): 말은 장날 정산 물품이 아니라 마구간에서 그 자리에서 사고판다.
// 남은 수가 줄수록 비싸고, 되팔면 그 마구간 재고로 돌아간다. 한 사람 최대 2필. NPC 상단도 같은 재고에서 산다.
import { HORSES } from '../constants';
import type { EconomyState } from '../economy/state';
import { stableAt } from './supply';
import type { Horse, HorseKind, Stable } from './types';

/** 남은 수가 n일 때 사는 값 */
function priceAtStock(kind: HorseKind, n: number): number {
  const s = HORSES.scarcity;
  const factor = n >= 3 ? s[0] : n === 2 ? s[1] : s[2];
  return Math.round(HORSES.kinds[kind].price * factor);
}

/** 지금 이 마구간에서 사는 값. 남은 게 없으면 null */
export function buyPrice(stable: Stable, kind: HorseKind): number | null {
  const n = stable.stock[kind];
  return n > 0 ? priceAtStock(kind, n) : null;
}

/** 이 마구간에 되파는 값 (돌려준 뒤 남은 수 기준 값의 일부) */
export function sellPrice(stable: Stable, kind: HorseKind): number {
  return Math.round(priceAtStock(kind, stable.stock[kind] + 1) * HORSES.resale);
}

/** 마구간에서 한 필 꺼낸다. 돈은 그 마을 금고로 간다 */
export function takeHorse(state: EconomyState, stable: Stable, kind: HorseKind): Horse | null {
  const price = buyPrice(stable, kind);
  if (price === null) return null;
  stable.stock[kind]--;
  state.towns[stable.town]!.treasury += price;
  return { id: state.horses.nextId++, kind, fatigue: 0, hungry: 0, price, home: stable.town };
}

/** 말을 마구간에 돌려준다 (되팔기, 굶다 도망침, 파산) */
export function returnHorse(state: EconomyState, town: number, horse: Horse): void {
  const stable = stableAt(state, town) ?? stableAt(state, horse.home);
  if (stable) stable.stock[horse.kind]++;
}
