// 홈 화면에 추가 안내 (handoff 0.2.0 10번): 견습을 마치고 처음 길을 떠날 때 한 번만 작은 쪽지로.
// 이미 홈 화면에서 열었으면(주소창 없이 꽉 찬 화면) 띄우지 않는다. "다시 보지 않기"를 누르면 이 폰에서는 다시 안 띄운다.
import { openSheet } from '../sheet';

const KEY = 'buy-the-rumor/home-tip';

/** 사파리 공유 단추 (네모에서 위로 나가는 화살표) */
const SHARE_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11H5v10h14V11h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

function standalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

/** 띄울 때가 되면 띄운다. 띄웠으면 true (기록 사건을 남길 때 쓴다) */
export function maybeShowHomeTip(): boolean {
  if (standalone() || dismissed()) return false;
  showHomeTip();
  return true;
}

/** 설정에서 다시 볼 때는 "다시 보지 않기"와 상관없이 띄운다 (0.2.1) */
export function showHomeTip(): void {
  const sheet = openSheet('홈 화면에 추가');
  sheet.body.innerHTML = `
    <p>홈 화면에 추가하면 주소창 없이 꽉 찬 화면으로 열려요.</p>
    <p class="home-tip-how">사파리 아래쪽 ${SHARE_ICON} 공유 단추 → "홈 화면에 추가"</p>
    <div class="sheet-actions">
      <button type="button" class="cv-btn" data-never>다시 보지 않기</button>
      <button type="button" class="cv-btn coral" data-ok>확인</button>
    </div>`;
  sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
  sheet.body.querySelector('[data-never]')!.addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, 'off');
    } catch {
      // 저장하지 못해도 이번에는 닫는다
    }
    sheet.close();
  });
}
