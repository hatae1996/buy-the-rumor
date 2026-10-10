// 상단 이름 검사 (작업목록-0.2.0 4번, handoff 0.2.0 7번): 금칙어와 같은 이름.
// 띄어쓰기·기호·숫자 섞기("씨 발", "시1발", "병.신")를 잡으려고 이름과 금칙어를 같은 꼴(key)로 바꿔 견준다.
import { BASE_BANNED_WORDS } from './bannedWords';

/**
 * 견주는 꼴: 호환 글자를 풀고(NFKC) 영문은 소문자로, 한글 음절·자모와 영문·숫자만 남긴다.
 * 같은 이름 막기(certificates.name_key)에도 이 꼴을 쓴다: "소금 상단"과 "소금상단!"은 같은 이름
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    // NFKC는 호환 자모(ㄱ U+3131…)를 첫가끝 자모(U+1100…)로 바꾸므로 둘 다 남긴다
    .replace(/[^0-9a-zᄀ-ᇿㄱ-ㆎ가-힣]/g, '');
}

/** 금칙어 하나를 견줄 꼴들로 */
function variants(key: string): string[] {
  const noDigits = key.replace(/[0-9]/g, '');
  return noDigits && noDigits !== key ? [key, noDigits] : [key];
}

/** 이름에 금칙어가 들어 있으면 그 금칙어, 없으면 null. extra는 운영자가 더한 목록(banned_words 표) */
export function bannedWordIn(name: string, extra: readonly string[] = []): string | null {
  const forms = variants(nameKey(name));
  for (const word of [...BASE_BANNED_WORDS, ...extra]) {
    const w = nameKey(word);
    if (w && forms.some((f) => f.includes(w))) return word;
  }
  return null;
}
