// 상태 해시: 같은 시드·같은 명령이면 로컬과 서버의 상태가 글자 하나까지 같은지 맞춰 본다 (작업목록-0.2.0 2번).
// 암호용이 아니다. JSON 글자열에 32비트 해시 둘(cyrb53 방식)을 돌려 16자리로 적는다.

/** 값을 JSON으로 적어 해시한다. 키 순서도 해시에 들어간다 (저장·불러오기에서 순서가 바뀌면 다른 값) */
export function stateHash(value: unknown): string {
  return hashText(JSON.stringify(value));
}

export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
