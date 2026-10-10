import { describe, expect, it } from 'vitest';
import { inAppBrowser, isIos, kakaoExternalUrl } from '../../src/ui/inApp';

const UA = {
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36;KAKAOTALK 2410650',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0',
  naver: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.10.0)',
};

describe('앱 안 브라우저', () => {
  it('카톡(아이폰·안드로이드), 인스타그램, 네이버 앱은 앱 안, 사파리·크롬은 아니다', () => {
    expect(inAppBrowser(UA.kakaoIos)).toBe('kakao');
    expect(inAppBrowser(UA.kakaoAndroid)).toBe('kakao');
    expect(inAppBrowser(UA.instagram)).toBe('instagram');
    expect(inAppBrowser(UA.naver)).toBe('naver');
    expect(inAppBrowser(UA.safari)).toBeNull();
    expect(inAppBrowser(UA.chromeAndroid)).toBeNull();
  });

  it('아이폰 알아보기, 카톡에서 바깥 브라우저로 넘기는 주소', () => {
    expect(isIos(UA.kakaoIos)).toBe(true);
    expect(isIos(UA.kakaoAndroid)).toBe(false);
    expect(kakaoExternalUrl('https://hatae1996.github.io/buy-the-rumor/?a=1')).toBe(
      'kakaotalk://web/openExternal?url=https%3A%2F%2Fhatae1996.github.io%2Fbuy-the-rumor%2F%3Fa%3D1',
    );
  });
});
