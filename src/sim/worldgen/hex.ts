// 육각 칸 좌표 계산. 축 좌표(q, r), 뾰족한 쪽이 위인 배치.

export const HEX_DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export interface Axial {
  q: number;
  r: number;
}

export const hexKey = (q: number, r: number): string => `${q},${r}`;

export function hexDistance(a: Axial, b: Axial): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

/** 칸 중심의 평면 좌표. 칸 반지름 1 기준 */
export function hexToXY(q: number, r: number): { x: number; y: number } {
  return { x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r };
}

/** 반지름 radius 안의 모든 칸. 순서는 q, r 오름차순으로 고정 */
export function hexesInRadius(radius: number): Axial[] {
  const out: Axial[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) out.push({ q, r });
    }
  }
  return out;
}

/** 칸 번호마다 이웃 칸 번호 목록. 이웃 순서는 HEX_DIRS 순서 */
export function buildNeighbors(cells: readonly Axial[]): number[][] {
  const index = new Map<string, number>();
  cells.forEach((c, i) => index.set(hexKey(c.q, c.r), i));
  return cells.map((c) =>
    HEX_DIRS.flatMap(([dq, dr]) => {
      const n = index.get(hexKey(c.q + dq, c.r + dr));
      return n === undefined ? [] : [n];
    }),
  );
}

/** start에서 1~range칸 떨어진 칸들 (start는 빼고). 가까운 고리부터 */
export function cellsAround(neighbors: readonly number[][], start: number, range: number): number[] {
  const out: number[] = [];
  const seen = new Set([start]);
  let ring = [start];
  for (let i = 0; i < range; i++) {
    const next: number[] = [];
    for (const c of ring) {
      for (const n of neighbors[c]!) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
        out.push(n);
      }
    }
    ring = next;
  }
  return out;
}
