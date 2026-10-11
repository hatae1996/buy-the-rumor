// 서버 게임의 들어가는 화면들 (작업목록-0.2.0 11번): 로그인(개인정보 한 줄), 초대 코드, 다음 시즌 기다리기, 세계에 들어가기.
// 로그인·메일 확인·초대 코드·대기 화면은 0.2.1 목업 화면(entry.css).
// 시작 화면(founding.ts)과 같은 크림 바탕 틀을 쓴다.
import type { Look } from '../../sim/looks';
import { categoryName, certificateView, type Certificate, type CategoryId, type Emblem } from '../../sim/ranking';
import { ERROR_TEXT, type ServerError } from '../format';
import { openPage } from '../page';
import { openSheet } from '../sheet';
import doorImg from '../../../assets/ui/entry_guild_door.png';
import inviteImg from '../../../assets/ui/entry_invite_letter.png';
import { certificateCard, openLookPage } from './certificate';
import groundImg from '../../../assets/ui/waiting_ground.png';
import stallImg from '../../../assets/ui/waiting_stall.png';
import wallImg from '../../../assets/ui/waiting_wall.png';
import trophyImg from '../../../assets/ui/rank_trophy.png';
import { entryBrand, entryBrandStack, entryLeaf, ICON_HOURGLASS, ICON_MAIL, ICON_REFRESH } from './entryParts';
import { showMailCheck } from './mailCheck';

/** 로그인 화면에 한 줄 (handoff 0.2.0 9번, 0.2.1 목업 문구) */
export const PRIVACY_LINE = '테스트 버전 · 이메일과 플레이 기록을 저장해요.';

export interface LoginActions {
  /** 없으면 구글 단추를 보이지 않는다 (설정 전) */
  google: (() => Promise<string | null>) | null;
  email: (email: string) => Promise<string | null>;
  /** 메일에 온 로그인 코드로 이 기기에서 로그인 (링크를 다른 기기에서 받았을 때). 실패하면 까닭 */
  verify: (email: string, code: string) => Promise<string | null>;
  /** 코드로 로그인했다 (다시 연다) */
  done: () => void;
}

/**
 * 로그인: 구글 계정 또는 이메일 링크. 로그인하면 이 주소로 돌아와 다시 연다.
 * 0.2.1 목업(docs/reference/entry-mockup-0.2.1.png): 큰 상호, 길드 문 그림, 그 위에 걸친 카드
 */
export function showLogin(root: HTMLElement, act: LoginActions): void {
  const el = document.createElement('section');
  el.className = 'entry-screen entry-login';
  el.innerHTML = `<div class="entry-scroll">
      ${entryBrand(true)}
      <p class="entry-tagline">소문을 사고, 기회를 잡으세요.</p>
      <div class="entry-hero door"><img src="${doorImg}" alt="" /></div>
      <div class="entry-card overlap">
        <h2>상인의 여정을 시작하세요</h2>
        <p class="entry-sub">이메일로 로그인</p>
        ${act.google ? '<button type="button" class="entry-btn ghost" data-google>구글 계정으로 시작</button>' : ''}
        <label class="entry-field"><span>이메일 주소</span>
          <input type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" data-email /></label>
        <button type="button" class="entry-btn coral" data-send>${ICON_MAIL}<span>로그인 메일 받기</span></button>
        <p class="entry-error" data-error hidden></p>
        <p class="entry-note">메일로 받은 링크를 누르면 로그인돼요.</p>
      </div>
      <footer class="entry-foot">${entryLeaf()}<p>${PRIVACY_LINE}</p></footer>
    </div>`;
  root.replaceChildren(el);
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
    // 보냈으면 메일 확인 화면에서 인증번호를 넣는다
    if (m === null) showMailCheck(root, email, act, PRIVACY_LINE);
    else show(m);
  });
}

/** 초대 코드 (handoff 0.2.0 1번, 0.2.1 목업 "길드 초대장"). 받아들여지면 끝난다 */
export function showInvite(root: HTMLElement, redeem: (code: string) => Promise<string | null>): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('section');
    el.className = 'entry-screen entry-invite';
    el.innerHTML = `<div class="entry-scroll">
        ${entryBrand(false)}
        <div class="entry-hero letter"><img src="${inviteImg}" alt="" /></div>
        <h2 class="entry-title">길드 초대장</h2>
        <p class="entry-lead soft">지금은 초대받은 상인만 입장할 수 있어요.</p>
        <div class="entry-card">
          <label class="entry-field"><span class="entry-field-title">초대 코드 입력</span>
            <small>전달받은 8자리 코드를 입력해 주세요.</small>
            <input type="text" autocapitalize="characters" autocomplete="off" maxlength="16" placeholder="초대 코드 8자리" data-code /></label>
          <button type="button" class="entry-btn coral" data-ok>길드에 들어가기 ›</button>
          <p class="entry-error" data-error hidden></p>
          <p class="entry-note center">초대 코드는 이메일 인증번호와 달라요.</p>
        </div>
        <footer class="entry-foot">${entryLeaf()}<p>${PRIVACY_LINE}</p></footer>
      </div>`;
    root.replaceChildren(el);
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

/** 기다리는 까닭마다 두 줄 (0.2.1 목업) */
const WAIT_TEXT: Record<string, string> = {
  seasonClosed: '이번 시즌 참가 기간이 끝났어요.',
  worldsFull: '이번 시즌 세계가 모두 찼어요.',
  noSeason: '지금은 열린 시즌이 없어요.',
};

/**
 * 다음 시즌 기다리기 (답 115, 질문 138): 시즌이 없거나, 세계가 다 찼거나, 들어올 날이 지났다.
 * 기다리는 동안 지난 시즌 명예의 전당과 내 상인 증서(얼굴·문장 바꾸기)를 본다 (0.2.1).
 * 0.2.1 목업(docs/reference/waiting-mockup-0.2.1.png): 닫힌 노점, 시작 시각, 명예의 전당(없으면 증서 꾸미기 안내)
 */
export function showWaiting(root: HTMLElement, reason: string, retry: () => void, extras?: WaitingExtras): void {
  const first = WAIT_TEXT[reason] ?? ERROR_TEXT[reason as ServerError] ?? '지금은 들어갈 수 없어요.';
  const el = document.createElement('section');
  el.className = 'entry-screen entry-waiting';
  el.innerHTML = `<div class="entry-scroll">
      ${entryBrandStack()}
      <h2 class="entry-title big">다음 시즌을 준비하고 있어요</h2>
      <div class="entry-hero stall"><img class="wall" src="${wallImg}" alt="" /><img class="stall-img" src="${stallImg}" alt="" /></div>
      <p class="entry-lead">${first}<br />다음 시즌에 새로운 장사를 시작해 보세요.</p>
      <p class="entry-when">${ICON_HOURGLASS}격주 월요일 오전 9시 시작</p>
      <section class="hall-of-fame" data-hall hidden></section>
      <p class="entry-divider plain" data-cert-hint ${extras?.certificate ? '' : 'hidden'}><span>✦</span></p>
      <p class="entry-note center" data-cert-hint ${extras?.certificate ? '' : 'hidden'}>기다리는 동안 상인 증서를 꾸며 보세요.</p>
      ${extras?.certificate ? '<button type="button" class="entry-btn outline teal-line" data-cert>내 상인 증서 ›</button>' : ''}
      <button type="button" class="entry-btn coral" data-retry>${ICON_REFRESH}다시 확인</button>
      <img class="entry-ground" src="${groundImg}" alt="" />
    </div>`;
  root.replaceChildren(el);
  el.querySelector('[data-retry]')!.addEventListener('click', retry);
  if (!extras) return;
  void extras.hall
    .then((h) => {
      if (!h?.entries.length) return;
      const box = el.querySelector<HTMLElement>('[data-hall]')!;
      box.innerHTML = `<h3><img src="${trophyImg}" alt="" />지난 시즌 명예의 전당 <small>${seasonText(h.seasonId)}</small></h3>
        <ul>${h.entries.map((e) => `<li><span>${categoryName(e.category as CategoryId)}</span><b>${e.name}</b></li>`).join('')}</ul>`;
      box.hidden = false;
      // 명예의 전당이 있으면 증서 꾸미기 안내는 숨긴다 (목업)
      el.querySelectorAll<HTMLElement>('[data-cert-hint]').forEach((x) => (x.hidden = true));
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
