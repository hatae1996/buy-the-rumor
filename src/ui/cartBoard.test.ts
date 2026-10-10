// 짐칸 판: 네모가 아닌 짐의 그림 자리 (0.1.6)
import { describe, expect, it } from 'vitest';
import { largestRect } from './cartBoard';

describe('짐 그림 자리 (가장 큰 네모)', () => {
  it('네모 짐은 조각 전체', () => {
    expect(largestRect([[2, 1], [3, 1], [4, 1]])).toEqual([2, 1, 3, 1]);
    expect(largestRect([[0, 0], [1, 0], [0, 1], [1, 1]])).toEqual([0, 0, 2, 2]);
  });

  it('ㄱ자 짐은 자기 칸 안의 가장 큰 네모 (빈 모서리에 그림이 넘치지 않게)', () => {
    // ■■
    // ■□
    expect(largestRect([[0, 0], [1, 0], [0, 1]])).toEqual([0, 0, 2, 1]);
    // ■□
    // ■■
    // ■■
    expect(largestRect([[3, 0], [3, 1], [4, 1], [3, 2], [4, 2]])).toEqual([3, 1, 2, 2]);
  });

  it('한 칸 짐', () => {
    expect(largestRect([[5, 2]])).toEqual([5, 2, 1, 1]);
  });
});
