// 앱 안 브라우저 안내 (0.2.0): 카톡 등에서 열었으면 로그인 전에 사파리(안드로이드는 기본 브라우저)로 열라고 안내한다.
// 카톡은 단추 하나로 넘길 수 있다. 다른 앱은 메뉴에서 "다른 브라우저로 열기"를 누르게 한다. 그래도 여기서 계속할 수 있다.
// 0.2.1: 목업(docs/reference/entry-mockup-0.2.1.png)대로 나침반 그림, 단추, 두 단계 순서, 여기서 계속하기.
import compassImg from '../../../assets/ui/entry_compass.png';
import { isIos, kakaoExternalUrl, type InAppBrowser } from '../inApp';
import { entryBrand, entryLeaf, ICON_EXTERNAL, ICON_SAFARI } from './entryParts';

const APP_NAME: Record<InAppBrowser, string> = {
  kakao: '카카오톡',
  naver: '네이버 앱',
  instagram: '인스타그램',
  facebook: '페이스북',
  line: '라인',
  other: '앱',
};

/** 메뉴에서 바깥 브라우저로 여는 순서 (두 단계) */
function steps(ios: boolean, app: InAppBrowser): [string, string] {
  if (!ios) return ['오른쪽 위 <b>더보기(⋮)</b>를 눌러요', "'<b>다른 브라우저로 열기</b>'를 선택해요"];
  if (app === 'kakao') return ['오른쪽 아래 <b>더보기(⋯)</b>를 눌러요', "'<b>Safari로 열기</b>'를 선택해요"];
  return ['오른쪽 위나 아래의 <b>더보기(⋯)</b>를 눌러요', "'<b>Safari로 열기</b>'(또는 '외부 브라우저로 열기')를 선택해요"];
}

/** 안내를 띄운다. "여기서 계속하기"를 누르면 onContinue */
export function showOpenInBrowser(root: HTMLElement, app: InAppBrowser, onContinue: () => void): void {
  const ios = isIos(navigator.userAgent);
  const browser = ios ? 'Safari' : '기본 브라우저(크롬 등)';
  const [one, two] = steps(ios, app);
  // 카톡은 단추 하나로 넘길 수 있다. 다른 앱은 메뉴 순서만
  const direct = app === 'kakao';
  const el = document.createElement('section');
  el.className = 'entry-screen entry-inapp';
  el.innerHTML = `<div class="entry-scroll">
      ${entryBrand(false)}
      <div class="entry-hero compass"><img src="${compassImg}" alt="" /></div>
      <h2 class="entry-title">${browser}에서 열어 주세요</h2>
      <p class="entry-lead">지금은 ${APP_NAME[app]} 안에서 접속했어요.</p>
      <p class="entry-lead soft">로그인을 이어서 이용하려면<br />${browser}에서 열어 주세요.</p>
      <div class="entry-card">
        ${direct ? `<a class="entry-btn teal" data-open href="${kakaoExternalUrl(location.href)}">${browser}로 열기 ${ICON_EXTERNAL}</a>` : ''}
        <p class="entry-divider">${direct ? '버튼이 작동하지 않나요?' : '이렇게 열어 주세요'}</p>
        <ol class="entry-steps"><li><span>1</span><p>${one}</p></li><li><span>2</span><p>${two}</p></li></ol>
        ${ios && app === 'kakao' ? `<p class="entry-tip">${ICON_SAFARI}나침반 아이콘이 보이면 눌러도 돼요.</p>` : ''}
      </div>
      <button type="button" class="entry-btn outline" data-stay>여기서 계속하기</button>
      <footer class="entry-foot"><p>접속한 브라우저에 따라 로그인 상태가 달라질 수 있어요.</p>${entryLeaf()}</footer>
    </div>`;
  root.replaceChildren(el);
  el.querySelector('[data-stay]')!.addEventListener('click', () => {
    el.remove();
    onContinue();
  });
}
