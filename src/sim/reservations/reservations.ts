// 예약 주문 (기획서 "시장", 0.1.0 작업 3, 질문 88 답).
// 하루 2~3번 접속하는 게임이라, 자리를 비운 사이에도 장날에 신청이 들어가게 미리 넣어 둔다.
// - 여러 날 가는 신청: 마감 날까지 날마다 그 마을 장날에 다시 들어간다. 장날은 동시호가라
//   "가죽이 40 이하로 떨어지면 10개 사라"는 "최대 40에 10개 사기를 다 찰 때까지 날마다 내기"와 같다.
//   조건 값을 따로 보지 않으니 그 마을에 없는 사람에게 시세가 새지 않는다. 알리는 것은 체결과 체결 값(내 거래)뿐.
// - 도착하면 팔기: 가는 마을에 도착한 뒤 첫 장날에 수레 짐을 낸다 (한 번).
// 짐은 그 마을 창고나, 그 마을에 와 있는 수레에서. 산 것은 그 마을 창고로(없으면 와 있는 수레로).
// 그날 돈이나 짐, 자리가 없으면 그날은 건너뛴다 (빚이 되지 않는다).
import { cartLots, cartWeight, roomFor, unitWeight, type Board } from '../cart';
import { ECONOMY } from '../constants';
import type { Accounts } from '../economy/accounts';
import { GOODS, type GoodId } from '../economy/goods';
import { sellableCount } from '../economy/inventory';
import type { EconomyState, Order, PlayerState } from '../economy/state';
import { porterBoards, splitBuy, splitSell } from '../hire/boards';
import { maxWeight } from '../horses/pull';
import { seasonOfDay } from '../season';
import { warehouseAt } from '../warehouse/warehouse';

export type Reservation =
  | {
      id: number;
      kind: 'standing';
      town: number;
      good: GoodId;
      side: 'buy' | 'sell';
      /** 아직 남은 양 (체결될 때마다 준다) */
      qty: number;
      /** 사기는 최대 값, 팔기는 최소 값 */
      limit: number;
      /** 이날 장날까지 */
      until: number;
    }
  | {
      id: number;
      kind: 'onArrival';
      /** 가는 마을 */
      town: number;
      good: GoodId;
      qty: number | 'all';
      minPrice: number;
    };

export type ReservationError = 'locked' | 'tooManyReservations' | 'badDeadline' | 'noReservation' | 'notTraveling';
type Err = ReservationError | 'badGood' | 'badQty' | 'badPrice' | 'noTown';

const isCount = (n: number) => Number.isInteger(n) && n > 0;

function common(p: PlayerState, good: GoodId): Err | null {
  if (p.unlocks.reservation === undefined) return 'locked';
  if (p.reservations.length >= ECONOMY.reservation.max) return 'tooManyReservations';
  if (!GOODS.includes(good)) return 'badGood';
  return null;
}

/** 여러 날 가는 신청을 넣는다. 마감 날은 오늘부터 시즌 마지막 날까지 */
export function reserveStanding(
  state: EconomyState,
  p: PlayerState,
  r: { town: number; good: GoodId; side: 'buy' | 'sell'; qty: number; limit: number; until: number },
): Err | null {
  const e = common(p, r.good);
  if (e) return e;
  if (!state.towns[r.town]) return 'noTown';
  if (r.side !== 'buy' && r.side !== 'sell') return 'badQty';
  if (!isCount(r.qty)) return 'badQty';
  if (!isCount(r.limit)) return 'badPrice';
  const last = state.season ? state.season.startDay + state.season.length - 1 : Infinity;
  if (!Number.isInteger(r.until) || r.until < state.day || r.until > last) return 'badDeadline';
  p.reservations.push({ id: state.nextId++, kind: 'standing', town: r.town, good: r.good, side: r.side, qty: r.qty, limit: r.limit, until: r.until });
  return null;
}

/** 가는 길에: 도착하면 이 물건을 판다 */
export function reserveOnArrival(state: EconomyState, p: PlayerState, r: { good: GoodId; qty: number | 'all'; minPrice: number }): Err | null {
  const e = common(p, r.good);
  if (e) return e;
  if (!p.travel) return 'notTraveling';
  if (r.qty !== 'all' && !isCount(r.qty)) return 'badQty';
  if (!isCount(r.minPrice)) return 'badPrice';
  p.reservations.push({ id: state.nextId++, kind: 'onArrival', town: p.travel.to, good: r.good, qty: r.qty, minPrice: r.minPrice });
  return null;
}

export function cancelReservation(p: PlayerState, id: number): Err | null {
  if (!p.reservations.some((r) => r.id === id)) return 'noReservation';
  p.reservations = p.reservations.filter((r) => r.id !== id);
  return null;
}

/**
 * 장날 전에: 이 플레이어의 예약 주문을 오늘 장날 신청으로 넣는다. 마감이 지난 것은 지운다.
 * 넣은 신청에는 예약 번호(reservation)를 단다 (체결되면 남은 양을 줄인다)
 */
export function placeReservations(state: EconomyState, p: PlayerState, accounts: Accounts): Order[] {
  const out: Order[] = [];
  const keep: Reservation[] = [];
  const rate = ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)];
  const here = (town: number) => !p.travel && p.town === town;
  const tag = (o: Order | null, id: number) => {
    if (!o) return;
    o.reservation = id;
    out.push(o);
  };
  for (const r of p.reservations) {
    if (r.kind === 'onArrival') {
      if (p.travel) {
        keep.push(r);
        continue;
      }
      // 도착한 마을이 아니면(길이 바뀜) 지운다. 도착했으면 한 번 내고 지운다
      if (p.town !== r.town) continue;
      const can = (b: Board) => sellableCount(cartLots(b), r.good, rate);
      // 내 수레와 짐꾼 수레에 있는 만큼 (내일이면 상할 것은 빼고)
      const all = [p.cart, ...porterBoards(p)].reduce((s, b) => s + can(b), 0);
      const qty = Math.min(r.qty === 'all' ? all : r.qty, all);
      if (qty > 0) {
        for (const part of splitSell(p, qty, can) ?? []) {
          tag(accounts.place({ kind: 'player', pid: p.id, ...(part.porter === undefined ? {} : { porter: part.porter }) }, r.town, r.good, 'sell', part.qty, r.minPrice), r.id);
        }
      }
      continue;
    }
    if (state.day > r.until || r.qty <= 0) continue;
    keep.push(r);
    const w = warehouseAt(p, r.town);
    const store = w && w.owed === 0 ? w : null;
    if (r.side === 'sell') {
      // 그 마을 창고 짐부터, 모자라면 와 있는 수레 짐
      let left = r.qty;
      if (store) {
        const n = Math.min(left, sellableCount(cartLots(store.board), r.good, rate));
        if (n > 0) {
          const o = accounts.place({ kind: 'store', pid: p.id, town: r.town }, r.town, r.good, 'sell', n, r.limit);
          tag(o, r.id);
          left -= o?.qty ?? 0;
        }
      }
      if (left > 0 && here(r.town)) {
        const n = Math.min(left, sellableCount(cartLots(p.cart), r.good, rate));
        if (n > 0) tag(accounts.place({ kind: 'player', pid: p.id }, r.town, r.good, 'sell', n, r.limit), r.id);
      }
      continue;
    }
    // 사기: 그날 맡길 수 있는 돈만큼. 그 마을 창고로, 없으면 와 있는 수레로
    const affordable = Math.min(r.qty, Math.floor(p.gold / r.limit));
    if (affordable <= 0) continue;
    if (store) {
      const n = Math.min(affordable, roomFor(store.board, r.good));
      if (n > 0) tag(accounts.place({ kind: 'store', pid: p.id, town: r.town }, r.town, r.good, 'buy', n, r.limit), r.id);
    } else if (here(r.town)) {
      const free = maxWeight(p.cart, p.horses) - cartWeight(p.cart) - incomingWeight(p.cart);
      const n = Math.min(affordable, roomFor(p.cart, r.good), Math.max(0, Math.floor(free / unitWeight(r.good))));
      const parts = n > 0 ? splitBuy(p, r.good, n) : null;
      for (const part of parts ?? []) {
        tag(accounts.place({ kind: 'player', pid: p.id, ...(part.porter === undefined ? {} : { porter: part.porter }) }, r.town, r.good, 'buy', part.qty, r.limit), r.id);
      }
    }
  }
  p.reservations = keep;
  return out;
}

/** 체결된 만큼 남은 양을 줄이고, 다 찬 신청은 지운다 */
export function noteReservationFill(p: PlayerState, id: number, qty: number): void {
  const r = p.reservations.find((x) => x.id === id);
  if (!r || r.kind !== 'standing') return;
  r.qty -= qty;
  if (r.qty <= 0) p.reservations = p.reservations.filter((x) => x !== r);
}

/** 장날 사기 신청으로 잡아 둔 자리의 무게 */
function incomingWeight(b: Board): number {
  return b.pieces.reduce((s, x) => s + x.incoming.reduce((a, i) => a + i.qty, 0) * unitWeight(x.good), 0);
}
