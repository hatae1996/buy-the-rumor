// 판 모양이 바뀌었을 때 (0.1.6: 수레를 폰 화면에 맞춘 세로형으로) 예전 저장의 짐을 새 모양에 맞춘다.
// 다 맞으면 그대로 두고, 하나라도 판 밖이거나 겹치면 큰 짐부터 빈자리 찾기로 다시 놓는다. 망가진 칸은 판 안의 것만 남긴다.
import { fits, findSpot, pieceCells, type Board } from './cart';
import { CART_TYPES, cartSlots, type BoardType } from './shapes';

const BOARD_TYPES: readonly BoardType[] = [...CART_TYPES, 'warehouse'];

/** 판 하나를 새 모양에 맞춘다. 짐을 다 놓았으면 true (칸 수가 같으니 보통 다 들어간다) */
export function refitBoard(board: Board): boolean {
  const slots = new Set(cartSlots(board.type).map(([x, y]) => `${x},${y}`));
  if (board.broken) board.broken = board.broken.filter((k) => slots.has(k));
  if (board.pieces.every((p) => fits(board, p.good, p.x, p.y, p.rot, p.id))) return true;
  const pieces = [...board.pieces].sort((a, b) => pieceCells(b).length - pieceCells(a).length || a.id - b.id);
  board.pieces = [];
  let all = true;
  for (const p of pieces) {
    const at = findSpot(board, p.good);
    if (at) board.pieces.push({ ...p, ...at });
    // 그래도 자리가 없으면 원래 자리에 둔다 (짐을 버리지 않는다. 빈칸 정리나 팔기로 풀 수 있다)
    else {
      board.pieces.push(p);
      all = false;
    }
  }
  return all;
}

function isBoard(v: unknown): v is Board {
  if (!v || typeof v !== 'object') return false;
  const b = v as Partial<Board>;
  return typeof b.type === 'string' && BOARD_TYPES.includes(b.type as BoardType) && Array.isArray(b.pieces) && typeof b.nextPieceId === 'number';
}

/** 저장된 상태 안의 모든 판(플레이어 수레, 행렬 수레, 짐꾼 손수레, 창고)을 찾아 맞춘다. 다시 놓은 판 수 */
export function refitBoards(root: unknown): number {
  let changed = 0;
  const seen = new Set<object>();
  const walk = (v: unknown): void => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (isBoard(v)) {
      const before = JSON.stringify(v.pieces);
      refitBoard(v);
      if (JSON.stringify(v.pieces) !== before) changed++;
      return;
    }
    for (const child of Array.isArray(v) ? v : Object.values(v)) walk(child);
  };
  walk(root);
  return changed;
}
