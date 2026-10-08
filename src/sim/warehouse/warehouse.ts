// 창고 (기획서 "성장", 0.0.5): 마을마다 빌리는 칸 판. 짐을 두고 다니고, 내가 없어도 그 마을 장날에 판다.
// 수레 판과 같은 짐 조각 규칙을 쓰고, 음식은 창고에서도 상한다. 보관료는 날마다 낸다.
// 보관료가 밀리면 짐을 꺼내거나 팔 수 없고, 너무 오래 밀리면 창고지기가 짐을 거둬 간다(빚이 되지 않는다).
import { cartCount, cartLots, createCart, loadGoods, takeGoods, type Cart } from '../cart';
import { GROWTH } from '../constants';
import type { GoodId } from '../economy/goods';
import type { EconomyState, PlayerState } from '../economy/state';
import { hasBuilding } from '../growth/buildings';
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

export function warehouseAt(p: PlayerState, town: number): Warehouse | null {
  return p.warehouses.find((w) => w.town === town) ?? null;
}

/** 지금 마을 창고를 빌린다 (보증금 겸 첫날 값) */
export function rentWarehouse(state: EconomyState, map: WorldMap): Err | null {
  const p = state.player;
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
export function releaseWarehouse(state: EconomyState, town: number): Err | null {
  const p = state.player;
  const w = warehouseAt(p, town);
  if (!w) return 'noWarehouse';
  if (w.owed > 0) return 'warehouseOwed';
  if (w.board.pieces.length > 0 || state.orders.some((o) => o.owner.kind === 'store' && o.owner.town === town)) return 'warehouseNotEmpty';
  p.warehouses = p.warehouses.filter((x) => x !== w);
  return null;
}

/** 수레 짐을 지금 마을 창고에 넣는다 */
export function storeGoods(state: EconomyState, good: GoodId, qty: number): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  const w = warehouseAt(p, p.town);
  if (!w) return 'noWarehouse';
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  if (cartCount(p.cart, good) < qty) return 'notEnoughGoods';
  return moveGoods(p.cart, w.board, good, qty);
}

/** 지금 마을 창고 짐을 수레로 꺼낸다 (보관료가 밀리면 못 꺼낸다) */
export function retrieveGoods(state: EconomyState, good: GoodId, qty: number): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  const w = warehouseAt(p, p.town);
  if (!w) return 'noWarehouse';
  if (w.owed > 0) return 'warehouseOwed';
  if (!Number.isInteger(qty) || qty <= 0) return 'badQty';
  if (cartCount(w.board, good) < qty) return 'notEnoughGoods';
  return moveGoods(w.board, p.cart, good, qty);
}

/** 한 판에서 다른 판으로 옮긴다. 다 안 들어가면 옮기지 않는다 */
function moveGoods(from: Cart<'warehouse'> | PlayerState['cart'], to: Cart<'warehouse'> | PlayerState['cart'], good: GoodId, qty: number): Err | null {
  const backup = JSON.stringify([from, to]);
  const lots = takeGoods(from, good, qty);
  for (const l of lots) {
    if (loadGoods(to, l.good, l.qty, l.age) < l.qty) {
      const [f, t] = JSON.parse(backup) as [typeof from, typeof to];
      Object.assign(from, f);
      Object.assign(to, t);
      return 'noRoom';
    }
  }
  return null;
}

/** 밤에: 보관료를 낸다. 못 내면 밀리고, 너무 오래 밀리면 창고지기가 짐을 거둬 가고 창고가 끝난다 */
export function warehouseNight(state: EconomyState): void {
  const p = state.player;
  const keep: Warehouse[] = [];
  for (const w of p.warehouses) {
    w.owed += W.rentPerDay;
    if (p.gold >= w.owed) {
      p.gold -= w.owed;
      state.towns[w.town]!.treasury += w.owed;
      p.ledger.push({ day: state.day, kind: 'warehouse', what: 'rent', town: w.town, fee: w.owed });
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
