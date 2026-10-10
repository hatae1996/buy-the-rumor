// 서버 게임의 들어가는 화면들 (작업목록-0.2.0 11번): 로그인(개인정보 한 줄), 초대 코드, 다음 시즌 기다리기, 세계에 들어가기.
// 시작 화면(founding.ts)과 같은 크림 바탕 틀을 쓴다.
import type { Look } from '../../sim/looks';
import { categoryName, certificateView, type Certificate, type CategoryId, type Emblem } from '../../sim/ranking';
import { ERROR_TEXT, type ServerError } from '../format';
import { openPage } from '../page';
import { openSheet } from '../sheet';
import { certificateCard, openLookPage } from './certificate';

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
  /** 없으면 구글 단추를 보이지 않는다 (설정 전) */
  google: (() => Promise<string | null>) | null;
  email: (email: string) => Promise<string | null>;
  /** 메일에 온 로그인 코드로 이 기기에서 로그인 (링크를 다른 기기에서 받았을 때). 실패하면 까닭 */
  verify: (email: string, code: string) => Promise<string | null>;
  /** 코드로 로그인했다 (다시 연다) */
  done: () => void;
}

/** 로그인: 구글 계정 또는 이메일 링크. 로그인하면 이 주소로 돌아와 다시 연다 */
export function showLogin(root: HTMLElement, act: LoginActions): void {
  const el = frame(
    root,
    'Buy the Rumor',
    '"소문에 사서 뉴스에 팔게. 먼저 길드 명부에 이름을 올리세."',
    `${act.google ? '<button type="button" class="founding-btn" data-google>구글 계정으로 시작</button>' : ''}
     <label class="founding-name"><span>${act.google ? '또는 ' : ''}이메일로 로그인</span>
       <input type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" data-email /></label>
     <button type="button" class="founding-btn ghost" data-send>로그인 메일 받기</button>
     <div data-code-box hidden>
       <label class="founding-name"><span>메일에 온 숫자</span>
         <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" data-code /></label>
       <button type="button" class="founding-btn" data-verify>로그인</button>
       <p class="pick-note">메일을 다른 기기(컴퓨터 등)에서 봐도 숫자만 여기에 넣으면 돼요. 이 기기에서 메일의 링크를 눌러도 돼요.</p>
     </div>
     <p class="founding-error" data-error hidden></p>
     <p class="pick-note">${PRIVACY_LINE}</p>`,
  );
  const err = el.querySelector<HTMLElement>('[data-error]')!;
  const show = (m: string | null) => {
    err.textContent = m ?? '';
    err.hidden = !m;
  };
  const google = act.google;
  if (google) el.querySelector('[data-google]')!.addEventListener('click', async () => show(await google()));
  el.querySelector('[data-send]')!.addEventListener('click', async () => {
    const email = el.querySelector<HTMLInputElement>('[data-email]')!.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('이메일 주소를 확인해 주세요.');
    const send = el.querySelector<HTMLButtonElement>('[data-send]')!;
    send.disabled = true;
    const m = await act.email(email);
    send.disabled = false;
    show(m);
    if (m === null) {
      send.textContent = '메일 다시 받기';
      el.querySelector<HTMLElement>('[data-code-box]')!.hidden = false;
      el.querySelector<HTMLInputElement>('[data-code]')!.focus();
    }
  });
  el.querySelector('[data-verify]')!.addEventListener('click', async (e) => {
    const email = el.querySelector<HTMLInputElement>('[data-email]')!.value.trim();
    const code = el.querySelector<HTMLInputElement>('[data-code]')!.value.replace(/\s/g, '');
    if (!/^\d{6,8}$/.test(code)) return show('메일에 온 숫자를 넣어 주세요.');
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const m = await act.verify(email, code);
    btn.disabled = false;
    if (m) return show(m);
    act.done();
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

/** 대기 화면에 더 보이는 것 (0.2.1, 답 138) */
export interface WaitingExtras {
  /** 지난 시즌 명예의 전당. 첫 시즌이라 비면 null (그 줄을 숨긴다) */
  hall: Promise<{ seasonId: string; entries: { category: string; name: string }[] } | null>;
  /** 내 상인 증서 (상단을 세웠으면) */
  certificate: Certificate | null;
  /** 얼굴이나 문장을 바꾼다 (계정 함수). 바뀐 증서, 또는 실패 문구 */
  setLook: (look: { face?: Look; emblem?: Emblem }) => Promise<Certificate | string>;
}

/** 시즌 id(여는 날, 한국 날짜)를 "10월 12일 시즌"으로 */
const seasonText = (id: string) => {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(id);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일 시즌` : id;
};

/**
 * 다음 시즌 기다리기 (답 115, 질문 138): 시즌이 없거나, 세계가 다 찼거나, 들어올 날이 지났다.
 * 기다리는 동안 지난 시즌 명예의 전당과 내 상인 증서(얼굴·문장 바꾸기)를 본다 (0.2.1)
 */
export function showWaiting(root: HTMLElement, reason: string, retry: () => void, extras?: WaitingExtras): void {
  const text = ERROR_TEXT[reason as ServerError] ?? '지금은 들어갈 수 없어요.';
  const el = frame(root, '다음 시즌을 기다려 주세요', '"장이 다시 서면 부르겠네. 그동안 증서나 매만져 두게."', `<p>${text}</p>
     <p class="pick-note">시즌은 격주 월요일 아침 9시에 열려요.</p>
     <section class="hall-of-fame" data-hall hidden></section>
     ${extras?.certificate ? '<button type="button" class="founding-btn ghost" data-cert>내 상인 증서 ›</button>' : ''}
     <button type="button" class="founding-btn" data-retry>다시 확인</button>`);
  el.classList.add('entry-waiting');
  el.querySelector('[data-retry]')!.addEventListener('click', retry);
  if (!extras) return;
  void extras.hall
    .then((h) => {
      if (!h?.entries.length) return;
      const box = el.querySelector<HTMLElement>('[data-hall]')!;
      box.innerHTML = `<h3>지난 시즌 명예의 전당 <small>${seasonText(h.seasonId)}</small></h3>
        <ul>${h.entries.map((e) => `<li><span>${categoryName(e.category as CategoryId)}</span><b>${e.name}</b></li>`).join('')}</ul>`;
      box.hidden = false;
    })
    .catch(() => undefined);
  let cert = extras.certificate;
  el.querySelector('[data-cert]')?.addEventListener('click', () => {
    const page = openPage({ back: '돌아가기', title: '상인 증서' });
    const render = () => {
      page.body.innerHTML = `${certificateCard(certificateView(cert!))}
        <div class="cert-parts">
          <button type="button" class="shop-link" data-edit-face>얼굴 바꾸기 <span>›</span></button>
          <button type="button" class="shop-link" data-edit-emblem>문장 바꾸기 <span>›</span></button>
        </div>
        <p class="ledger-note plain">상단 이름은 다음 시즌에 들어가기 전에 바꿀 수 있어요.</p>`;
      const edit = (kind: 'face' | 'emblem') =>
        openLookPage(kind, cert!, async (look) => {
          const r = await extras.setLook(look);
          if (typeof r === 'string') return r;
          cert = r;
          render();
          return null;
        });
      page.body.querySelector('[data-edit-face]')!.addEventListener('click', () => edit('face'));
      page.body.querySelector('[data-edit-emblem]')!.addEventListener('click', () => edit('emblem'));
    };
    render();
  });
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
