// 설정 (0.2.1 목업 docs/reference/settings-mockup-0.2.1.png): 위 줄 오른쪽 톱니바퀴로 연다.
// 알림(받을 알림), 알림 시간과 횟수(방해 금지 시간, 하루 최대), 소리(배경음·효과음, 이 폰에만), 도움말(홈 화면에 추가, 의견 보내기),
// 계정(로그아웃, 계정 지우기 안내: 서버 게임만), 버전.
// 폰 알림(푸시)은 앱으로 나올 때 켜진다(답 109·110). 지금 정해 둔 알림 설정은 그때 그대로 쓴다.
import appVersion from '../../../VERSION?raw';
import { NOTIFY_KINDS, type NotifyKind } from '../../sim/notify';
import { SIM_VERSION } from '../../sim/service/version';
import { canSignOut, signOut } from '../account';
import { canSendFeedback, openFeedbackSheet } from '../feedback';
import type { Game } from '../game';
import { openLivePage } from '../livePage';
import bellImg from '../../../assets/ui/set_bell.png';
import helpImg from '../../../assets/ui/set_help.png';
import moonImg from '../../../assets/ui/set_moon.png';
import soundImg from '../../../assets/ui/set_sound.png';
import { playSfx, setSoundSettings, soundSettings } from '../sound';
import { showHomeTip } from './homeTip';

/** 설정에 보이는 알림 이름과 설명 (목업 문구. 알림 묶음 글은 시뮬의 이름을 그대로 쓴다) */
const KIND_TEXT: Record<NotifyKind, [string, string]> = {
  market: ['장날 결과', '거래 신청의 체결·미체결 결과'],
  reservation: ['예약 거래', '예약 구매·판매가 체결됐을 때'],
  arrival: ['행렬 도착', '내 행렬 또는 두 번째 행렬이 도착했을 때'],
  spoiling: ['식품 보관', '짐칸·창고의 음식이 내일 상할 때'],
  people: ['고용·말 관리', '일당 부족으로 일꾼이 떠나려 하거나 말 먹이가 떨어졌을 때'],
  season: ['시즌', '시즌 마지막 날과 공동 의뢰 결과'],
  chances: ['원정 기회', '원정 기회가 최대 6개로 찼을 때'],
  newspaper: ['신문', '새 신문이 나왔을 때'],
};

/** 카드 머리: 그림과 제목, 오른쪽 작은 표시 */
const head = (img: string, title: string, chip = '') =>
  `<header class="settings-head"><img src="${img}" alt="" /><h3>${title}</h3>${chip ? `<span class="pick-chip soon">${chip}</span>` : ''}</header>`;

/** 하루 알림 상한 고르기 */
const CAPS = [3, 6, 10, 20] as const;

const hourText = (h: number) => (h === 0 ? '밤 12시' : h < 6 ? `새벽 ${h}시` : h < 12 ? `아침 ${h}시` : h === 12 ? '낮 12시' : h < 18 ? `오후 ${h - 12}시` : `밤 ${h - 12}시`);

const hourSelect = (key: string, value: number, label: string) =>
  `<select data-${key} aria-label="${label}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === value ? 'selected' : ''}>${hourText(h)}</option>`).join('')}</select>`;

export function openSettings(game: Game): void {
  openLivePage(game, { back: '돌아가기', title: '설정' }, (body, v, page) => {
    const n = v.notify;
    const sound = soundSettings();
    body.innerHTML = `
      <section class="shop-card settings-card">
        ${head(bellImg, '알림', '폰 알림 준비 중')}
        <p class="settings-lead">폰 알림은 앱 출시 후 사용할 수 있어요.<br />지금 설정한 내용은 나중에도 유지돼요.<br /><small>게임을 열어 두면 장날 결과는 화면 위에 표시돼요.</small></p>
        <h4 class="settings-sub">받을 알림</h4>
        <ul class="settings-list">${NOTIFY_KINDS.map(
          (k) => `<li><label><span><b>${KIND_TEXT[k.kind][0]}</b><small>${KIND_TEXT[k.kind][1]}</small></span>
            <input type="checkbox" class="settings-switch" data-kind="${k.kind}" ${n.enabled[k.kind] ? 'checked' : ''} /></label></li>`,
        ).join('')}</ul>
      </section>
      <section class="shop-card settings-card">
        ${head(moonImg, '알림 시간과 횟수')}
        <h4 class="settings-sub">방해 금지 시간</h4>
        <div class="settings-hours">${hourSelect('quiet-start', n.quietStart, '방해 금지 시작')}<i>~</i>${hourSelect('quiet-end', n.quietEnd, '방해 금지 끝')}</div>
        <p class="settings-note">이 시간의 알림은 종료 시각에 모아서 알려줘요.</p>
        <div class="settings-row"><h4 class="settings-sub">하루 최대 알림</h4>
          <select data-cap aria-label="하루 최대 알림">${CAPS.map((c) => `<option value="${c}" ${c === n.dailyCap ? 'selected' : ''}>${c}개까지</option>`).join('')}${
            CAPS.includes(n.dailyCap as (typeof CAPS)[number]) ? '' : `<option value="${n.dailyCap}" selected>${n.dailyCap}개까지</option>`
          }</select></div>
        <p class="settings-note">초과한 소식은 다음 접속 시 '자리를 비운 사이'에서 확인해요.</p>
      </section>
      <section class="shop-card settings-card">
        ${head(soundImg, '소리')}
        <ul class="settings-list">
          <li><label><span><b>배경음</b><small>장터의 아침 음악</small></span><input type="checkbox" class="settings-switch" data-sound="bgm" ${sound.bgm ? 'checked' : ''} /></label></li>
          <li><label><span><b>효과음</b><small>누를 때, 살 때, 길을 떠날 때</small></span><input type="checkbox" class="settings-switch" data-sound="sfx" ${sound.sfx ? 'checked' : ''} /></label></li>
        </ul>
        <button type="button" class="shop-link" data-sfx-test>효과음 들어 보기 <span>›</span></button>
        <p class="settings-note">무음 모드에서는 소리가 나지 않아요. 이 폰에만 저장돼요.</p>
      </section>
      <section class="shop-card settings-card">
        ${head(helpImg, '도움말')}
        <button type="button" class="shop-link" data-home-tip>홈 화면에 추가하는 방법 <span>›</span></button>
        ${canSendFeedback() ? '<button type="button" class="shop-link" data-feedback>의견 보내기 <span>›</span></button>' : ''}
      </section>
      ${
        canSignOut()
          ? `<section class="shop-card settings-card">
              <header class="settings-head"><h3>계정</h3></header>
              <button type="button" class="shop-link" data-sign-out>로그아웃 <span>›</span></button>
              <p class="settings-note">계정과 기록을 지우고 싶으면 의견 보내기로 알려 주세요. 운영자가 지워 드려요.</p>
            </section>`
          : ''
      }
      <p class="settings-version">Buy the Rumor ${appVersion.trim()} · 규칙 ${SIM_VERSION}</p>`;

    body.querySelectorAll<HTMLInputElement>('[data-kind]').forEach((box) =>
      box.addEventListener('change', () => void page.send({ type: 'setNotify', enabled: { [box.dataset.kind as NotifyKind]: box.checked } })),
    );
    const num = (sel: string) => Number(body.querySelector<HTMLSelectElement>(sel)!.value);
    body.querySelector('[data-quiet-start]')!.addEventListener('change', () => void page.send({ type: 'setNotify', quietStart: num('[data-quiet-start]') }));
    body.querySelector('[data-quiet-end]')!.addEventListener('change', () => void page.send({ type: 'setNotify', quietEnd: num('[data-quiet-end]') }));
    body.querySelector('[data-cap]')!.addEventListener('change', () => void page.send({ type: 'setNotify', dailyCap: num('[data-cap]') }));
    body.querySelectorAll<HTMLInputElement>('[data-sound]').forEach((box) =>
      box.addEventListener('change', () => setSoundSettings({ [box.dataset.sound as 'bgm' | 'sfx']: box.checked })),
    );
    body.querySelector('[data-sfx-test]')!.addEventListener('click', () => playSfx('buy'));
    body.querySelector('[data-home-tip]')!.addEventListener('click', () => showHomeTip());
    body.querySelector('[data-feedback]')?.addEventListener('click', () => openFeedbackSheet());
    body.querySelector('[data-sign-out]')?.addEventListener('click', async (e) => {
      if (!confirm('로그아웃할까요? 다시 들어올 때는 이메일로 로그인해요.')) return;
      (e.currentTarget as HTMLButtonElement).disabled = true;
      await signOut();
    });
  });
}
