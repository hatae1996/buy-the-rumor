// 내 짐을 싣는 판들: 내 수레, 짐꾼 손수레, 지금 마을 창고. 판 사이로 짐을 옮긴다.
// 장날 신청과 원정 짐은 내 수레가 먼저 받고, 원정에서 다 못 실으면 짐꾼 수레에 싣는다.
import { cartCount, cartLots, cartWeight, loadGoods, roomFor, takeGoods, unitWeight, type Board } from '../cart';
import { CART } from '../constants';
import { maxWeight } from '../horses/pull';
import type { GoodId } from '../economy/goods';
import type { PlayerState } from '../economy/state';

/** 판 이름: 'cart', 'porter:<일꾼 번호>', 'warehouse'(지금 마을 창고), 'caravan'(같은 마을에 와 있는 두 번째 행렬) */
export type BoardRef = 'cart' | 'warehouse' | 'caravan' | `porter:${number}`;

export type BoardError = 'noBoard' | 'warehouseOwed';

/** 판 찾기. 창고는 지금 마을에 있을 때만, 짐꾼은 따라다니므로 늘 */
export function resolveBoard(p: PlayerState, ref: BoardRef): Board | BoardError {
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
  p: PlayerState,
  from: BoardRef,
  to: BoardRef,
  good: GoodId,
  qty: number,
): BoardError | 'noRoom' | 'notEnoughGoods' | 'badQty' | null {
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  const a = resolveBoard(p, from);
  const b = resolveBoard(p, to);
  if (typeof a === 'string') return a;
  if (typeof b === 'string') return b;
  if (a === b) return 'noBoard';
  // 보관료가 밀린 창고에서는 꺼낼 수 없다
  if (from === 'warehouse' && p.warehouses.find((w) => w.board === a)!.owed > 0) return 'warehouseOwed';
  if (cartCount(a, good) < qty) return 'notEnoughGoods';
  return moveBetween(a, b, good, qty);
}

/** 짐꾼 손수레가 장에서 산 짐을 더 받을 수 있는 양: 칸과 사람이 끄는 무게 안에서, 잡아 둔 자리 빼고 */
export function porterBuyRoom(board: Board, good: GoodId): number {
  const reserved = board.pieces.reduce((s, p) => s + p.incoming.reduce((a, i) => a + i.qty, 0) * unitWeight(p.good), 0);
  const free = CART.types.handcart.humanPull - cartWeight(board) - reserved;
  return Math.max(0, Math.min(roomFor(board, good), Math.floor(free / unitWeight(good))));
}

/** 짐꾼 (일꾼 번호와 수레) */
export function porters(p: PlayerState): { id: number; board: Board }[] {
  return p.hires.flatMap((h) => (h.board ? [{ id: h.id, board: h.board }] : []));
}

/**
 * 장날 사기 신청을 판마다 나눈다: 내 수레에 끄는 무게까지 먼저, 넘치면 짐꾼 수레에.
 * 짐꾼 수레에도 다 못 실으면 남은 몫은 내 수레 칸에 싣는다 (무거우면 떠나기 전에 덜어야 한다, 0.0.5까지와 같다).
 * 칸도 모자라면 null. porter가 없는 몫이 내 수레다
 */
export function splitBuy(p: PlayerState, good: GoodId, qty: number): { porter?: number; qty: number }[] | null {
  const room = roomFor(p.cart, good);
  const reserved = p.cart.pieces.reduce((s, x) => s + x.incoming.reduce((a, i) => a + i.qty, 0) * unitWeight(x.good), 0);
  const free = maxWeight(p.cart, p.horses) - cartWeight(p.cart) - reserved;
  let main = Math.min(qty, room, Math.max(0, Math.floor(free / unitWeight(good))));
  const extra: { porter?: number; qty: number }[] = [];
  let left = qty - main;
  for (const { id, board } of porters(p)) {
    if (left <= 0) break;
    const n = Math.min(left, porterBuyRoom(board, good));
    if (n > 0) extra.push({ porter: id, qty: n });
    left -= n;
  }
  // 짐꾼 수레에도 못 실은 몫은 내 수레 칸에
  const more = Math.min(left, room - main);
  main += more;
  left -= more;
  if (left > 0) return null;
  return [...(main > 0 ? [{ qty: main }] : []), ...extra];
}

/** 장날 팔기 신청을 판마다 나눈다: 내 수레 짐부터, 모자라면 짐꾼 수레 짐. count는 판에서 낼 수 있는 양 */
export function splitSell(p: PlayerState, qty: number, count: (board: Board) => number): { porter?: number; qty: number }[] | null {
  const main = Math.min(qty, count(p.cart));
  const parts: { porter?: number; qty: number }[] = main > 0 ? [{ qty: main }] : [];
  let left = qty - main;
  for (const { id, board } of porters(p)) {
    if (left <= 0) break;
    const n = Math.min(left, count(board));
    if (n > 0) parts.push({ porter: id, qty: n });
    left -= n;
  }
  return left > 0 ? null : parts;
}

/** 원정에서 내 수레에 다 못 실은 짐을 짐꾼 수레에 싣는다. 실은 양 */
export function loadOverflow(p: PlayerState, good: GoodId, qty: number, age: number): number {
  let left = qty;
  for (const board of porterBoards(p)) {
    if (left <= 0) break;
    // 짐꾼은 사람이 끌어 무게 70까지만 싣는다 (넘치면 떠날 수 없다)
    left -= loadGoods(board, good, Math.min(left, porterBuyRoom(board, good)), age, 0);
  }
  return qty - left;
}

/** 짐꾼 수레에 실린 짐 (순자산, 상함) */
export function porterLots(p: PlayerState) {
  return porterBoards(p).flatMap(cartLots);
}
