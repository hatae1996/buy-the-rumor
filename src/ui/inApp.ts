// 앱 안 브라우저 알아보기 (0.2.0 예행연습 준비): 카톡으로 받은 링크를 누르면 카톡 안 브라우저로 열린다.
// 거기서 로그인하면 사파리·홈 화면 앱과 로그인이 따로 놀고(저장소가 따로), 이메일 링크도 다른 브라우저로 열려 어긋난다.

export type InAppBrowser = 'kakao' | 'naver' | 'instagram' | 'facebook' | 'line' | 'other';

/** 사용자 에이전트로 앱 안 브라우저를 알아본다. 보통 브라우저면 null */
export function inAppBrowser(ua: string): InAppBrowser | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp|NAVER\/|whale.*inapp/i.test(ua) && !/Whale\/[\d.]+ (Mobile )?Safari/i.test(ua)) return 'naver';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/\bLine\//i.test(ua)) return 'line';
  if (/DaumApps|; wv\)/i.test(ua)) return 'other';
  return null;
}

export function isIos(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

/** 카톡 안 브라우저에서 기본 브라우저로 넘기는 주소 (카카오가 주는 길: 안드로이드, 최근 iOS) */
export function kakaoExternalUrl(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}
