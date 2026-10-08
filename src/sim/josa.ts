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

/** 숫자 읽는 소리로 은/는: 40은, 15는, 100은 */
export function numEunNeun(n: number): string {
  const v = Math.abs(Math.round(n));
  // 일의 자리가 0이면 십·백·천(받침 있음)으로 끝난다
  const last = v % 10;
  const has = v === 0 || last === 0 || [1, 3, 6, 7, 8].includes(last);
  return `${v}${has ? '은' : '는'}`;
}

/** 숫자 읽는 소리로 으로/로: 4로, 3으로, 10으로, 7로(ㄹ 받침) */
export function numEuro(n: number): string {
  const v = Math.abs(Math.round(n));
  const last = v % 10;
  // 영·삼·육, 그리고 십·백·천으로 끝나면 으로 (일·칠·팔은 ㄹ 받침이라 로)
  const eu = v === 0 || last === 0 || last === 3 || last === 6;
  return `${v}${eu ? '으로' : '로'}`;
}
