// 창고 보관료 (0.0.8): 짐이 차지한 칸 수만큼 낸다. 빈 창고는 0.
// 성장 목록과 봇 어림에서도 쓰므로 다른 시스템에 기대지 않는 작은 파일로 둔다.
import { cartSlots, usedCells, type Board } from '../cart';
import { GROWTH } from '../constants';

/** 짐이 차지한 칸 수로 정하는 하루 보관료: 칸 cellsPerCoin개마다 1골드, 올림 */
export function warehouseFee(cells: number): number {
  return Math.ceil(cells / GROWTH.warehouse.cellsPerCoin);
}

/** 창고 칸 수 */
export const WAREHOUSE_CELLS = cartSlots('warehouse').length;

/** 꽉 찬 창고의 하루 보관료 (봇이 미리 어림할 때, 성장 목록) */
export const WAREHOUSE_FULL_FEE = warehouseFee(WAREHOUSE_CELLS);

/** 이 창고 판의 오늘 보관료 */
export function boardFee(board: Board): number {
  return warehouseFee(usedCells(board));
}
