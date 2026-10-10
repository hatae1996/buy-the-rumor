import { describe, expect, it } from 'vitest';
import { bannedWordIn, nameKey } from './names';

describe('이름 꼴', () => {
  it('띄어쓰기·기호·대소문자·전각을 걷어 낸다', () => {
    expect(nameKey('소금 상단')).toBe(nameKey('소금상단!'));
    expect(nameKey(' 소금 · 상단 ')).toBe('소금상단');
    expect(nameKey('ＡＢＣ 상단')).toBe('abc상단');
  });

  it('자음만 쓴 이름도 남는다', () => {
    expect(nameKey('ㅅㅂ')).not.toBe('');
  });
});

describe('금칙어', () => {
  it.each(['씨발 상단', '씨 발 상단', '시1발상단', '병.신 상단', '개-새-끼', 'ㅅㅂ상단', 'ㅅ ㅂ', 'F u C k 상단', 'ｆｕｃｋ', '운영자 상단'])('막는다: %s', (name) => {
    expect(bannedWordIn(name)).not.toBeNull();
  });

  it.each(['소금 상단', '바람결 상단', '새끼 고양이 상단', '시바견 상단', '대한남부 상단', '신발 상단', '병아리 상단', '십자성 상단'])(
    '멀쩡한 이름은 막지 않는다: %s',
    (name) => {
      expect(bannedWordIn(name)).toBeNull();
    },
  );

  it('운영자가 더한 말도 막는다', () => {
    expect(bannedWordIn('나쁜말 상단')).toBeNull();
    expect(bannedWordIn('나쁜 말 상단', ['나쁜말'])).toBe('나쁜말');
  });
});
