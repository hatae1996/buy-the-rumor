// 창고 (기획서 "성장", 0.0.5): 마을마다 빌리는 칸 판. 짐을 두고 다니고, 내가 없어도 그 마을 장날에 판다.
// 수레 판과 같은 짐 조각 규칙을 쓰고, 음식은 창고에서도 상한다. 보관료는 짐이 차지한 칸 수만큼 날마다 낸다 (0.0.8).
// 보관료가 밀리면 짐을 꺼내거나 팔 수 없고, 너무 오래 밀리면 창고지기가 짐을 거둬 간다(빚이 되지 않는다).
import { cartCount, cartLots, createCart, transferPiece, type Board, type Cart } from '../cart';
import { moveBetween } from '../hire/boards';
import { GROWTH } from '../constants';
import type { GoodId } from '../economy/goods';
import type { EconomyState, PlayerState } from '../economy/state';
import { hasBuilding } from '../growth/buildings';
import { boardFee } from './fee';
import type { WorldMap } from '../worldgen';

const W = GROWTH.warehouse;

export interface Warehouse {
  town: number;
  board: Cart<'warehouse'>;
  /** 밀린 보관료 */
  owed: number;
  /** 보관료가 밀린 날 수 */
  owedDays: number;
  /** 빌린 날 */
  since: number;
}

export type WarehouseError = 'noWarehouse' | 'haveWarehouse' | 'warehouseNotEmpty' | 'warehouseOwed';
type Err = WarehouseError | 'traveling' | 'notEnoughGold' | 'notEnoughGoods' | 'noRoom' | 'badQty' | 'ordersPending';

/** 이 창고의 오늘 보관료 (짐이 차지한 칸 수만큼) */
export function warehouseFeeOf(w: Warehouse): number {
  return boardFee(w.board);
}

export function warehouseAt(p: PlayerState, town: number): Warehouse | null {
  return p.warehouses.find((w) => w.town === town) ?? null;
}

/** 지금 마을 창고를 빌린다 (보증금 겸 첫날 값) */
export function rentWarehouse(state: EconomyState, p: PlayerState, map: WorldMap): Err | null {
  if (p.travel) return 'traveling';
  if (!hasBuilding(state, map, p.town, 'warehouse')) return 'noWarehouse';
  if (warehouseAt(p, p.town)) return 'haveWarehouse';
  if (p.gold < W.deposit) return 'notEnoughGold';
  p.gold -= W.deposit;
  state.towns[p.town]!.treasury += W.deposit;
  p.warehouses.push({ town: p.town, board: createCart('warehouse'), owed: 0, owedDays: 0, since: state.day });
  p.ledger.push({ day: state.day, kind: 'warehouse', what: 'rent', town: p.town, fee: W.deposit });
  return null;
}

/** 빈 창고를 돌려준다 (밀린 값을 다 냈을 때) */
export function releaseWarehouse(state: EconomyState, p: PlayerState, town: number): Err | null {
  const w = warehouseAt(p, town);
  if (!w) return 'noWarehouse';
  if (w.owed > 0) return 'warehouseOwed';
  if (w.board.pieces.length > 0 || state.orders.some((o) => o.owner.kind === 'store' && o.owner.pid === p.id && o.owner.town === town)) return 'warehouseNotEmpty';
  p.warehouses = p.warehouses.filter((x) => x !== w);
  return null;
}

/** 수레 짐을 지금 마을 창고에 넣는다 */
export function storeGoods(p: PlayerState, good: GoodId, qty: number): Err | null {
  if (p.travel) return 'traveling';
  const w = warehouseAt(p, p.town);
  if (!w) return 'noWarehouse';
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  if (cartCount(p.cart, good) < qty) return 'notEnoughGoods';
  return moveBetween(p.cart, w.board, good, qty);
}

/** 지금 마을 창고 짐을 수레로 꺼낸다 (보관료가 밀리면 못 꺼낸다) */
/**
 * 창고와 수레 두 판 사이로 조각을 끌어 옮긴다 (0.1.2 짐칸 화면). from: 꺼낼 판. qty: 몇 개만 (없으면 담을 수 있는 만큼).
 * 밀린 보관료가 있으면 창고에서 꺼낼 수 없다 (넣기는 된다)
 */
export function transferBetween(
  p: PlayerState,
  from: 'cart' | 'warehouse',
  pieceId: number,
  x: number,
  y: number,
  rot: number,
  qty?: number,
): Err | 'cantPlace' | 'badQty' | null {
  if (qty !== undefined && (!Number.isInteger(qty) || qty <= 0)) return 'badQty';
  if (p.travel) return 'traveling';
  const w = warehouseAt(p, p.town);
  if (!w) return 'noWarehouse';
  if (from === 'warehouse' && w.owed > 0) return 'warehouseOwed';
  const [src, dst] = from === 'cart' ? [p.cart, w.board] : [w.board, p.cart];
  return transferPiece(src as Board, dst as Board, pieceId, x, y, rot, qty) ? null : 'cantPlace';
}

export function retrieveGoods(p: PlayerState, good: GoodId, qty: number): Err | null {
  if (p.travel) return 'traveling';
  const w = warehouseAt(p, p.town);
  if (!w) return 'noWarehouse';
  if (w.owed > 0) return 'warehouseOwed';
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  if (cartCount(w.board, good) < qty) return 'notEnoughGoods';
  return moveBetween(w.board, p.cart, good, qty);
}

/** 밤에: 보관료를 낸다. 못 내면 밀리고, 너무 오래 밀리면 창고지기가 짐을 거둬 가고 창고가 끝난다 */
export function warehouseNight(state: EconomyState, p: PlayerState): void {
  const keep: Warehouse[] = [];
  for (const w of p.warehouses) {
    w.owed += warehouseFeeOf(w);
    if (p.gold >= w.owed) {
      if (w.owed > 0) {
        p.gold -= w.owed;
        state.towns[w.town]!.treasury += w.owed;
        p.ledger.push({ day: state.day, kind: 'warehouse', what: 'rent', town: w.town, fee: w.owed });
      }
      w.owed = 0;
      w.owedDays = 0;
    } else w.owedDays++;
    if (w.owedDays > W.maxOwedDays) {
      const lost = cartLots(w.board).reduce((s, l) => s + l.qty, 0);
      p.ledger.push({ day: state.day, kind: 'warehouse', what: 'seized', town: w.town, fee: 0, lost });
      continue;
    }
    keep.push(w);
  }
  p.warehouses = keep;
}
