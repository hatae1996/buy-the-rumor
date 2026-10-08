// 한국어 조사. 마을 이름이 바뀌므로 받침에 따라 고른다.

function lastSyllable(word: string): { has: boolean; isRieul: boolean } | null {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const jong = code % 28;
  return { has: jong !== 0, isRieul: jong === 8 };
}

/** 리버포드로, 스톤힐로, 골든베일로, 밀브룩으로 */
export function euro(word: string): string {
  const s = lastSyllable(word);
  return word + (s && s.has && !s.isRieul ? '으로' : '로');
}


/** 생선을, 고기를, 염장 식품을 */
export function eulReul(word: string): string {
  const s = lastSyllable(word);
  return word + (s?.has ? '을' : '를');
}

/** 상단이, 바렌이 / 리버포드가 */
export function iGa(word: string): string {
  const s = lastSyllable(word);
  return word + (s?.has ? '이' : '가');
}
