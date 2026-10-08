// 내 짐을 싣는 판들: 내 수레, 짐꾼 손수레, 지금 마을 창고. 판 사이로 짐을 옮긴다.
// 장날 신청과 원정 짐은 내 수레가 먼저 받고, 원정에서 다 못 실으면 짐꾼 수레에 싣는다.
import { cartCount, cartLots, loadGoods, takeGoods, type Board } from '../cart';
import type { GoodId } from '../economy/goods';
import type { EconomyState, PlayerState } from '../economy/state';

/** 판 이름: 'cart', 'porter:<일꾼 번호>', 'warehouse'(지금 마을 창고), 'caravan'(같은 마을에 와 있는 두 번째 행렬) */
export type BoardRef = 'cart' | 'warehouse' | 'caravan' | `porter:${number}`;

export type BoardError = 'noBoard' | 'warehouseOwed';

/** 판 찾기. 창고는 지금 마을에 있을 때만, 짐꾼은 따라다니므로 늘 */
export function resolveBoard(state: EconomyState, ref: BoardRef): Board | BoardError {
  const p = state.player;
  if (ref === 'cart') return p.cart;
  if (ref === 'caravan') {
    const c = p.caravan;
    if (!c || p.travel || c.travel || c.town !== p.town) return 'noBoard';
    return c.cart;
  }
  if (ref === 'warehouse') {
    if (p.travel) return 'noBoard';
    const w = p.warehouses.find((x) => x.town === p.town);
    if (!w) return 'noBoard';
    return w.board;
  }
  const id = Number(ref.slice('porter:'.length));
  return p.hires.find((h) => h.id === id && h.board)?.board ?? 'noBoard';
}

/** 짐꾼 수레들 */
export function porterBoards(p: PlayerState): Board[] {
  return p.hires.flatMap((h) => (h.board ? [h.board] : []));
}

/** 한 판에서 다른 판으로 옮긴다. 다 안 들어가면 옮기지 않는다 */
export function moveBetween(from: Board, to: Board, good: GoodId, qty: number): 'noRoom' | null {
  const backup = JSON.stringify([from, to]);
  for (const l of takeGoods(from, good, qty)) {
    if (loadGoods(to, l.good, l.qty, l.age) < l.qty) {
      const [f, t] = JSON.parse(backup) as [Board, Board];
      Object.assign(from, f);
      Object.assign(to, t);
      return 'noRoom';
    }
  }
  return null;
}

export function transferGoods(
  state: EconomyState,
  from: BoardRef,
  to: BoardRef,
  good: GoodId,
  qty: number,
): BoardError | 'noRoom' | 'notEnoughGoods' | 'badQty' | null {
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  const a = resolveBoard(state, from);
  const b = resolveBoard(state, to);
  if (typeof a === 'string') return a;
  if (typeof b === 'string') return b;
  if (a === b) return 'noBoard';
  // 보관료가 밀린 창고에서는 꺼낼 수 없다
  if (from === 'warehouse' && state.player.warehouses.find((w) => w.board === a)!.owed > 0) return 'warehouseOwed';
  if (cartCount(a, good) < qty) return 'notEnoughGoods';
  return moveBetween(a, b, good, qty);
}

/** 원정에서 내 수레에 다 못 실은 짐을 짐꾼 수레에 싣는다. 실은 양 */
export function loadOverflow(p: PlayerState, good: GoodId, qty: number, age: number): number {
  let left = qty;
  for (const board of porterBoards(p)) {
    if (left <= 0) break;
    left -= loadGoods(board, good, left, age);
  }
  return qty - left;
}

/** 짐꾼 수레에 실린 짐 (순자산, 상함) */
export function porterLots(p: PlayerState) {
  return porterBoards(p).flatMap(cartLots);
}
