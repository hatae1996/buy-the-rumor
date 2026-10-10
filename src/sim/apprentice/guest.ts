// 견습 손님 (기획 0.2.1, 답 137·140·141). 견습 신문의 조선소 소식은 신문에만 실리고 사건을 일으키지 않는다(로컬과 서버 모두).
// 공유 세계에 사건을 일으키면 다른 사람의 목재 장사가 흔들리므로, 졸업생이 가는 마을에 그 사람만의 손님을 둔다:
// 견습에서 산 목재를 견습에서 산 수량까지만, 졸업 장면에서 노상인이 말해 준 값에 산다.
// 그 마을에 도착한 뒤 첫 장날에 장날 정산과 따로 먼저 맞추고(시세와 체결량에 들어가지 않는다), 남은 양은 보통 장으로 간다.
// 그 장날이 지나거나 다른 마을에 서면 사라진다. 다른 사람에게는 보이지 않는다(신문·시세·큰손 기사에 나오지 않음).
import { ECONOMY } from '../constants';
import type { Accounts } from '../economy/accounts';
import { takeOldest } from '../economy/inventory';
import type { EconomyState, PlayerState } from '../economy/state';
import { eventDef } from '../events/defs';
import type { ApprenticeGuest } from './types';

const A = ECONOMY.apprentice;
const GOOD = 'wood';

/**
 * 졸업할 때 손님을 정한다 (졸업 장면의 노상인 말도 이 값을 쓴다). 견습에서 산 목재가 수레에 없으면 null.
 * 값은 조선소 큰 주문 값(그 마을 기준 값 × 사건 배율)이고, 산 값의 guestMinMarkup배보다 낮지 않게 (첫 거래는 반드시 이익)
 */
export function apprenticeGuestOf(state: EconomyState, p: PlayerState, carried: number): ApprenticeGuest | null {
  const ap = p.apprentice;
  if (!ap) return null;
  const buys = p.ledger.filter((e) => e.kind === 'buy' && e.good === GOOD);
  const bought = buys.reduce((n, e) => n + (e.kind === 'buy' ? e.qty : 0), 0);
  const qty = Math.min(bought, carried);
  if (qty <= 0) return null;
  const paid = buys.reduce((n, e) => n + (e.kind === 'buy' ? e.qty * e.price : 0), 0) / bought;
  const factor = eventDef('shipyard').effects.find((e) => e.kind === 'bigOrder' && e.good === GOOD);
  const offered = Math.round(state.towns[ap.destination]!.refPrice[GOOD] * (factor?.kind === 'bigOrder' ? factor.factor : 1));
  return { town: ap.destination, good: GOOD, qty, price: Math.max(offered, Math.ceil(paid * A.guestMinMarkup)) };
}

export interface GuestFill {
  qty: number;
  price: number;
  /** 예약 주문(도착하면 팔기)이 낸 신청이면 그 예약 번호 */
  reservation?: number;
}

/**
 * 장날 정산 전에: 손님이 있는 마을에 서 있으면, 그 물품 판매 신청(내 수레 짐) 중 손님 값 이하로 낸 것을
 * 남은 수량만큼 먼저 산다. 돈은 바깥에서 온다. 다 판 신청은 목록에서 뺀다
 */
export function settleApprenticeGuest(state: EconomyState, p: PlayerState, accounts: Accounts): GuestFill[] {
  const g = p.apprenticeGuest;
  if (!g || p.travel || p.town !== g.town) return [];
  const out: GuestFill[] = [];
  let left = g.qty;
  for (const o of state.orders) {
    if (left <= 0) break;
    if (o.town !== g.town || o.good !== g.good || o.side !== 'sell' || o.limit > g.price) continue;
    if (o.owner.kind !== 'player' || o.owner.pid !== p.id) continue;
    const n = Math.min(left, o.qty);
    if (n <= 0) continue;
    takeOldest(o.lots, g.good, n);
    o.qty -= n;
    left -= n;
    accounts.addGold(o.owner, n * g.price);
    // 다 팔렸으면 안 팔릴 때 돌아올 자리로 잡아 둔 칸을 푼다
    if (o.qty === 0) accounts.receive(o.owner, [], o.id);
    out.push({ qty: n, price: g.price, ...(o.reservation !== undefined ? { reservation: o.reservation } : {}) });
  }
  state.orders = state.orders.filter((o) => o.side !== 'sell' || o.qty > 0);
  return out;
}

/** 장날이 지난 뒤: 길 위가 아니면 (손님 마을의 첫 장날을 지났거나 다른 마을에 섰으면) 손님은 사라진다 */
export function expireApprenticeGuest(p: PlayerState): void {
  if (p.apprenticeGuest && !p.travel) p.apprenticeGuest = null;
}
