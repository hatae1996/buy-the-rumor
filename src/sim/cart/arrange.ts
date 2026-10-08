// 수레 싣기 최종 배치 (기획서 "멀티플레이 구조"): 폰은 퍼즐을 풀고 마지막 배치만 명령 하나로 보낸다.
// 시뮬(서버)은 모양·자리·겹침을 다시 검사하고, 짐 내용(무엇이 몇 개, 얼마나 묵었나)은 폰이 바꿀 수 없다.
// 위치만 받으니 무게와 짐 수는 그대로다. 하나라도 틀리면 아무것도 바꾸지 않는다.
import { pieceCells, type Board } from './cart';
import { cartSlots } from './shapes';

export interface Placement {
  id: number;
  x: number;
  y: number;
  rot: number;
}

export type ArrangeError = 'badArrangement';

const key = (x: number, y: number) => `${x},${y}`;

/** 배치를 검사하고 맞으면 그대로 옮긴다 */
export function arrangeBoard(board: Board, placements: readonly Placement[]): ArrangeError | null {
  // 모든 조각을 한 번씩만, 빠짐없이
  const ids = new Set(board.pieces.map((p) => p.id));
  if (placements.length !== ids.size || new Set(placements.map((p) => p.id)).size !== ids.size) return 'badArrangement';
  if (!placements.every((p) => ids.has(p.id) && [p.x, p.y, p.rot].every(Number.isInteger) && p.rot >= 0 && p.rot <= 3)) return 'badArrangement';
  const slots = new Set(cartSlots(board.type).map(([x, y]) => key(x, y)));
  const taken = new Set<string>();
  for (const pl of placements) {
    const piece = board.pieces.find((p) => p.id === pl.id)!;
    for (const [cx, cy] of pieceCells({ good: piece.good, x: pl.x, y: pl.y, rot: pl.rot })) {
      const k = key(cx, cy);
      if (!slots.has(k) || taken.has(k)) return 'badArrangement';
      taken.add(k);
    }
  }
  for (const pl of placements) Object.assign(board.pieces.find((p) => p.id === pl.id)!, { x: pl.x, y: pl.y, rot: pl.rot });
  return null;
}
