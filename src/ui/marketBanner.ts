// 장날 알림 띠 (기획 0.2.1): 게임을 열어 둔 동안 장날이 지나면 화면 위에 "장날이 열렸어요 · 결과 보기"를 잠깐 띄운다.
// 쪽지처럼 화면을 막지 않는다. 누르면 장날 결과(그날 기록)를 연다. 조용한 시간에도 화면을 열어 두었으면 띄운다
// (조용한 시간은 "자리를 비운 사이"를 모으는 규칙이다).

/** 띠가 떠 있는 시간 */
export const MARKET_BANNER_MS = 4000;

let current: { el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;

function close(): void {
  if (!current) return;
  clearTimeout(current.timer);
  current.el.remove();
  current = null;
}

/** 띠를 띄운다. 이미 떠 있으면 새 것으로 바꾼다. open: 결과 보기를 눌렀을 때 */
export function showMarketBanner(open: () => void): void {
  close();
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'market-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = '장날이 열렸어요 · <b>결과 보기</b>';
  // 위 줄 바로 아래에
  const bar = document.querySelector('.status-bar');
  if (bar) el.style.top = `${Math.round(bar.getBoundingClientRect().bottom) + 6}px`;
  el.addEventListener('click', () => {
    close();
    open();
  });
  document.body.appendChild(el);
  current = { el, timer: setTimeout(close, MARKET_BANNER_MS) };
}
