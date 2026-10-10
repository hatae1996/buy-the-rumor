// 앱 안 브라우저 안내 (0.2.0): 카톡 등에서 열었으면 로그인 전에 사파리(안드로이드는 기본 브라우저)로 열라고 안내한다.
// 카톡은 단추 하나로 넘길 수 있다. 다른 앱은 메뉴에서 "다른 브라우저로 열기"를 누르게 한다. 그래도 여기서 계속할 수 있다.
import { isIos, kakaoExternalUrl, type InAppBrowser } from '../inApp';

const APP_NAME: Record<InAppBrowser, string> = {
  kakao: '카카오톡',
  naver: '네이버 앱',
  instagram: '인스타그램',
  facebook: '페이스북',
  line: '라인',
  other: '앱',
};

/** 안내를 띄운다. "여기서 계속하기"를 누르면 onContinue */
export function showOpenInBrowser(root: HTMLElement, app: InAppBrowser, onContinue: () => void): void {
  const ios = isIos(navigator.userAgent);
  const browser = ios ? 'Safari' : '기본 브라우저(크롬 등)';
  const menu = ios
    ? app === 'kakao'
      ? '오른쪽 아래 <b>⋯</b>(또는 나침반) 단추 → <b>Safari로 열기</b>'
      : '오른쪽 위나 아래의 <b>⋯</b> 메뉴 → <b>Safari로 열기</b>(또는 "외부 브라우저로 열기")'
    : '오른쪽 위 <b>⋮</b> 메뉴 → <b>다른 브라우저로 열기</b>';
  const el = document.createElement('section');
  el.className = 'founding entry';
  el.innerHTML = `
    <header class="founding-head">
      <h1>${browser}에서 열어 주세요</h1>
      <p class="founding-hint">지금 ${APP_NAME[app]} 안에서 열었어요. 여기서 로그인하면 ${browser}나 홈 화면 앱과 로그인이 따로 놀고, 이메일 로그인 링크도 다른 곳에서 열려요.</p>
    </header>
    <div class="founding-body"><div class="founding-card">
      ${app === 'kakao' ? `<a class="founding-btn" data-open href="${kakaoExternalUrl(location.href)}">${browser}로 열기</a>` : ''}
      <p class="pick-note">${app === 'kakao' ? '단추가 안 되면 ' : ''}${menu} 순서로 눌러 주세요.</p>
      <button type="button" class="founding-btn ghost" data-stay>그래도 여기서 계속하기</button>
    </div></div>`;
  root.replaceChildren(el);
  el.querySelector('[data-stay]')!.addEventListener('click', () => {
    el.remove();
    onContinue();
  });
}
