// 값 노이즈와 프랙탈 합.
// 프로토타입은 Math.sin으로 해시를 만들었지만, Math.sin의 끝자리는 엔진마다(사파리와 서버의 Node)
// 다를 수 있고 해시가 그 차이를 키운다. 같은 시드면 어디서든 같은 세계가 나오도록 정수 해시로 바꿨다.
// 여기서는 정확히 반올림되는 연산(+, -, *, /, Math.floor, Math.imul)만 쓴다.

/** 정수 격자점 (x, y)와 시드 s에 대한 [0, 1) 값 */
export function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x2545f491) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function valueNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 4옥타브 합. 대략 [0, 1) */
export function fbm(x: number, y: number, s: number): number {
  let f = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    f += amp * valueNoise(x * freq, y * freq, s + o * 13);
    amp *= 0.5;
    freq *= 2;
  }
  return f / 0.9375;
}
