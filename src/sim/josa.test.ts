import { describe, expect, it } from 'vitest';
import { euro, eulReul, iGa } from './josa';

describe('조사', () => {
  it('으로/로: 받침이 없거나 ㄹ이면 로', () => {
    expect(euro('리버포드')).toBe('리버포드로');
    expect(euro('스톤힐')).toBe('스톤힐로');
    expect(euro('밀브룩')).toBe('밀브룩으로');
    expect(euro('벨헤이븐')).toBe('벨헤이븐으로');
  });

  it('을/를, 이/가', () => {
    expect(eulReul('생선')).toBe('생선을');
    expect(eulReul('도구')).toBe('도구를');
    expect(eulReul('염장 식품')).toBe('염장 식품을');
    expect(iGa('바렌 상단')).toBe('바렌 상단이');
    expect(iGa('리버포드')).toBe('리버포드가');
  });
});
