// 시드 기반 난수. 시뮬레이션 안에서는 Math.random() 대신 이것만 쓴다.
// mulberry32: prototypes/hexmap-2d.html의 rng()와 같은 수열을 낸다.

export interface Rng {
  /** [0, 1) 실수 */
  next(): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
  /** 배열에서 하나 */
  pick<T>(items: readonly T[]): T;
  /** 지금 상태값. createRng(state())로 같은 자리부터 이어 돌린다 (저장과 불러오기). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('빈 배열에서 고를 수 없다');
      return items[Math.floor(next() * items.length)]!;
    },
    state() {
      return a >>> 0;
    },
  };
}

/** 숫자 여러 개를 섞어 시드 하나로 (원정마다 다른 난수를 같은 규칙으로 만든다) */
export function mixSeed(...parts: number[]): number {
  let h = 0x2545f491;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x9e3779b1);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** 피셔-예이츠로 제자리에서 섞는다. sort에 랜덤 비교 함수를 넘기면 엔진마다 결과가 달라서 쓰지 않는다 */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** 2.3이면 70%는 2, 30%는 3. 평균이 x가 되는 정수 */
export function stochasticRound(x: number, rng: Rng): number {
  if (x <= 0) return 0;
  const base = Math.floor(x);
  return base + (rng.next() < x - base ? 1 : 0);
}
