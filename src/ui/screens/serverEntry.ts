// 서버 게임의 들어가는 화면들 (작업목록-0.2.0 11번): 로그인(개인정보 한 줄), 초대 코드, 다음 시즌 기다리기, 세계에 들어가기.
// 시작 화면(founding.ts)과 같은 크림 바탕 틀을 쓴다.
import { ERROR_TEXT, type ServerError } from '../format';
import { openSheet } from '../sheet';

/** 로그인 화면에 한 줄 (handoff 0.2.0 9번) */
export const PRIVACY_LINE = '테스트용 게임이며 이메일과 플레이 기록만 저장합니다.';

function frame(root: HTMLElement, title: string, hint: string, body: string): HTMLElement {
  const el = document.createElement('section');
  el.className = 'founding entry';
  el.innerHTML = `
    <header class="founding-head">
      <h1>${title}</h1>
      <p class="founding-hint">${hint}</p>
    </header>
    <div class="founding-body"><div class="founding-card">${body}</div></div>`;
  root.replaceChildren(el);
  return el;
}

export interface LoginActions {
  google: () => Promise<string | null>;
  email: (email: string) => Promise<string | null>;
}

/** 로그인: 구글 계정 또는 이메일 링크. 로그인하면 이 주소로 돌아와 다시 연다 */
export function showLogin(root: HTMLElement, act: LoginActions): void {
  const el = frame(
    root,
    'Buy the Rumor',
    '"소문에 사서 뉴스에 팔게. 먼저 길드 명부에 이름을 올리세."',
    `<button type="button" class="founding-btn" data-google>구글 계정으로 시작</button>
     <label class="founding-name"><span>또는 이메일로 로그인 링크 받기</span>
       <input type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" data-email /></label>
     <button type="button" class="founding-btn ghost" data-send>링크 보내기</button>
     <p class="founding-error" data-error hidden></p>
     <p class="pick-note" data-sent hidden>메일함의 링크를 누르면 이 화면으로 돌아와요.</p>
     <p class="pick-note">${PRIVACY_LINE}</p>`,
  );
  const err = el.querySelector<HTMLElement>('[data-error]')!;
  const show = (m: string | null) => {
    err.textContent = m ?? '';
    err.hidden = !m;
  };
  el.querySelector('[data-google]')!.addEventListener('click', async () => show(await act.google()));
  el.querySelector('[data-send]')!.addEventListener('click', async () => {
    const email = el.querySelector<HTMLInputElement>('[data-email]')!.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('이메일 주소를 확인해 주세요.');
    const m = await act.email(email);
    show(m);
    el.querySelector<HTMLElement>('[data-sent]')!.hidden = m !== null;
  });
}

/** 초대 코드 (handoff 0.2.0 1번). 받아들여지면 끝난다 */
export function showInvite(root: HTMLElement, redeem: (code: string) => Promise<string | null>): Promise<void> {
  return new Promise((resolve) => {
    const el = frame(
      root,
      '초대 코드',
      '"지금 길드는 초대받은 상인만 받는다네. 받은 코드를 보여 주게."',
      `<label class="founding-name"><span>초대 코드 <small>8글자</small></span>
         <input type="text" autocapitalize="characters" autocomplete="off" maxlength="16" data-code /></label>
       <p class="founding-error" data-error hidden></p>
       <button type="button" class="founding-btn" data-ok>들어가기 ›</button>
       <p class="pick-note">${PRIVACY_LINE}</p>`,
    );
    const err = el.querySelector<HTMLElement>('[data-error]')!;
    el.querySelector<HTMLButtonElement>('[data-ok]')!.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const code = el.querySelector<HTMLInputElement>('[data-code]')!.value;
      if (!code.trim()) return;
      btn.disabled = true;
      const m = await redeem(code);
      btn.disabled = false;
      if (m === null) {
        el.remove();
        resolve();
      } else {
        err.textContent = m;
        err.hidden = false;
      }
    });
  });
}

/** 다음 시즌 기다리기 (답 115, 질문 138): 시즌이 없거나, 세계가 다 찼거나, 들어올 날이 지났다 */
export function showWaiting(root: HTMLElement, reason: string, retry: () => void): void {
  const text = ERROR_TEXT[reason as ServerError] ?? '지금은 들어갈 수 없어요.';
  const el = frame(root, '다음 시즌을 기다려 주세요', '"장이 다시 서면 부르겠네. 그동안 증서나 매만져 두게."', `<p>${text}</p>
     <p class="pick-note">시즌은 격주 월요일 아침 9시에 열려요.</p>
     <button type="button" class="founding-btn" data-retry>다시 확인</button>`);
  el.querySelector('[data-retry]')!.addEventListener('click', retry);
}

/** 견습을 마치고 공유 세계에 들어갈 때 (○○ 세계에 들어갑니다) */
export function noteEnterWorld(worldId: string, merchants: number): void {
  const n = /^w(\d+)$/.exec(worldId)?.[1];
  const sheet = openSheet('세계에 들어갑니다');
  sheet.body.innerHTML = `
    <p><b>${n ? `${n}번 세계` : worldId}</b>에 들어갑니다. 이 세계의 상단 ${merchants}곳과 한 시장을 나눠요.</p>
    <p class="pick-note">장날은 2시간 30분마다 열려요. 순위는 같은 시즌의 모든 세계를 합쳐 매겨요.</p>
    <div class="sheet-actions"><span></span><button type="button" class="cv-btn coral" data-ok>출발</button></div>`;
  sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
}
