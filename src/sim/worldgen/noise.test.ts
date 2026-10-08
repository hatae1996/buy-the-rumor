import { describe, expect, it } from 'vitest';
import { fbm, hash2, valueNoise } from './noise';

describe('노이즈', () => {
  it('해시는 [0, 1)이고 같은 입력이면 같은 값', () => {
    for (let x = -20; x < 20; x++) {
      for (let y = -20; y < 20; y++) {
        const v = hash2(x, y, 5);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
        expect(hash2(x, y, 5)).toBe(v);
      }
    }
  });

  it('해시 값이 고르게 퍼진다', () => {
    const buckets = new Array<number>(10).fill(0);
    for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) buckets[Math.floor(hash2(x, y, 3) * 10)]!++;
    for (const b of buckets) expect(b).toBeGreaterThan(800);
  });

  it('격자점에서는 해시 값과 같다 (값 노이즈)', () => {
    expect(valueNoise(3, -4, 9)).toBe(hash2(3, -4, 9));
  });

  it('fbm은 대략 [0, 1)', () => {
    for (let i = 0; i < 2000; i++) {
      const v = fbm(i * 0.37, i * 0.11, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1.0001);
    }
  });

  it('엔진에 상관없이 같은 값 (고정값)', () => {
    // 정수 연산만 쓰므로 사파리와 Node에서 같아야 한다. 이 값이 바뀌면 모든 맵이 바뀐다.
    expect(hash2(1, 2, 3)).toMatchInlineSnapshot(`0.23927108710631728`);
    expect(fbm(12.5, -3.25, 997)).toMatchInlineSnapshot(`0.34174292533037565`);
  });
});
