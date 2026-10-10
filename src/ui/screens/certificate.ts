// 상인 증서 (기획서 "상인 증서 (ID카드)", 0.1.6 목업 docs/reference/certificate-mockup-0.1.6.png).
// 남에게 보이는 증서라 순자산 숫자는 없다. 위쪽 줄의 내 문장, 랭킹의 이름을 누르면 열린다.
// 빈 카드 그림(assets/ui/certificate_card.jpg) 위에 테두리 줄(종이 등급마다 색), 얼굴과 문장, 상단 이름, 대표 칭호, 년차, 대표 인장 4개, 상인 번호.
// 0.1.7: 가운데에 내 얼굴(아바타 키트)과 문장(부품), 아래에 상인 번호. 얼굴과 문장은 언제든, 상단 이름은 시즌 사이에만 바꾼다.
// 내 증서는 대표 칭호, 앞면에 달 인장(4개까지)을 고르고, 이미지로 저장한다 (공유는 나중).
// 상단 이름은 로컬에서는 글자 수만 본다. 금칙어와 같은 시즌 중복은 서버 버전에서 (0.1.7 답 129).
import { canSendFeedback, openFeedbackSheet } from '../feedback';
import cardImg from '../../../assets/ui/certificate_card.jpg';
import type { CertificateView, Emblem } from '../../sim/ranking';
import type { Look } from '../../sim/looks';
import { badgeArt } from '../badgeArt';
import { drawEmblem, emblemSvg } from '../emblem';
import { ERROR_TEXT } from '../format';
import type { Game } from '../game';
import { openLivePage } from '../livePage';
import { openPage } from '../page';
import { portraitHtml } from '../portrait/portrait';
import { mountEmblemEditor } from './emblemEditor';
import { mountFaceEditor } from './faceEditor';

const PAPER = { worn: '낡은 종이', parchment: '양피지', gilded: '금테' } as const;
/** 종이 등급마다 테두리 줄 색 */
const LINE = { worn: '#8b6b4a', parchment: '#2f8f8a', gilded: '#c79a2e' } as const;
const TIER = { bronze: '동', silver: '은', gold: '금' } as const;
/** 인장 바탕색 (등급이 없는 인장은 청록) */
const TIER_COLOR = { bronze: '#8a5a3a', silver: '#8f99a3', gold: '#cf9f32', none: '#3f8f8a' } as const;
const KIND = { quest: '의뢰', ranking: '랭킹', achievement: '업적', memorial: '기념' } as Record<string, string>;
/** 앞면에 다는 인장 수 (src/sim/ranking MAX_PINNED) */
const MAX_PINNED = 4;

/** 상인 번호: 여섯 자리 (목업 "상인번호 001284") */
export const merchantNoText = (n: number | null): string | null => (n === null ? null : `상인번호 ${String(n).padStart(6, '0')}`);

/** 대표 인장 하나: 등급 색 칠각 메달에 이름 첫 글자, 아래에 이름. 빈 자리는 점선 */
function badgeToken(b: CertificateView['pinned'][number] | undefined): string {
  if (!b) return '<span class="cert-badge empty"><span class="cert-medal"></span><small>빈 자리</small></span>';
  const color = TIER_COLOR[b.tier ?? 'none'];
  // 그림이 있는 인장 (개척 상인, 0.2.1)
  const art = badgeArt(b.badge);
  if (art) return `<span class="cert-badge"><img class="cert-medal-art" src="${art}" alt="" /><small>${b.name}</small></span>`;
  return `<span class="cert-badge"><span class="cert-medal" style="--medal:${color}">${b.name.slice(0, 1)}</span><small>${b.name}${b.tier ? ` · ${TIER[b.tier]}` : ''}</small></span>`;
}

/** 증서 앞면 (대기 화면처럼 세계 밖에서도 쓴다) */
export function certificateCard(c: CertificateView & { bot?: boolean }): string {
  const slots = Array.from({ length: MAX_PINNED }, (_, i) => badgeToken(c.pinned[i])).join('');
  return `<section class="cert-card" style="--cert-line:${LINE[c.paper]};background-image:url('${cardImg}')" aria-label="상인 증서">
      <div class="cert-inner">
        <p class="cert-kicker"><span></span>상인 길드 공인<span></span></p>
        <h2 class="cert-title">상인증서</h2>
        <div class="cert-marks">${portraitHtml(c.face, 84, '상인 얼굴')}${emblemSvg(c.emblem, 96)}</div>
        <h3 class="cert-name">${c.name}</h3>
        ${c.bot ? '<p class="cert-wanderer">떠돌이 상단</p>' : ''}
        <p class="cert-honor">${c.title ?? '칭호 없음'}</p>
        <p class="cert-years">상인 ${c.seasonsCompleted + 1}년차${c.origin ? ` · ${c.origin} 출신` : ''}</p>
        <p class="cert-label">대표 인장</p>
        <div class="cert-badges">${slots}</div>
        ${merchantNoText(c.merchantNo) ? `<p class="cert-no">${merchantNoText(c.merchantNo)}</p>` : ''}
        <p class="cert-foot">${PAPER[c.paper]} · 모은 인장 ${c.badgeCount}${c.bestBigShotRank ? ` · 큰손 최고 ${c.bestBigShotRank}위` : ''}</p>
        <span class="cert-stamp" aria-hidden="true">길드<br />공인</span>
      </div>
    </section>`;
}

/** id가 없으면 내 증서 */
export function openCertificate(game: Game, id?: string): void {
  const mine = id === undefined || id === game.playerId;
  openLivePage(game, { back: '돌아가기', title: '상인 증서' }, (body, v, page) => {
    const c = mine ? v.certificate : v.certificates[id!];
    if (!c) {
      page.close();
      return;
    }
    if (!mine) {
      body.innerHTML = `${certificateCard(c)}<p class="ledger-note plain">남의 증서에는 순자산이 없어요. 인장첩은 그 상단만 봐요.</p>`;
      return;
    }
    const pinnedRows = new Set(v.certificate.pinned.map((p) => v.badgeBook.findIndex((b) => b.name === p.name && b.season === p.season)));
    const book =
      v.badgeBook
        .map(
          (b, i) => `<li><span>${b.name}${b.tier ? ` <span class="stamp right">${TIER[b.tier]}</span>` : ''}<small>${KIND[b.kind] ?? ''} · ${b.season}시즌</small></span>
            <label class="pin-toggle"><input type="checkbox" data-pin="${i}" ${pinnedRows.has(i) ? 'checked' : ''} ${!pinnedRows.has(i) && pinnedRows.size >= MAX_PINNED ? 'disabled' : ''} /> 앞면</label></li>`,
        )
        .join('') || '<li class="muted">원정과 장사에서 이야기가 되는 순간, 랭킹, 길드 의뢰, 시즌 완주로 인장이 모여요.</li>';
    body.innerHTML = `
      ${certificateCard(c)}
      <button type="button" class="shop-link" data-save-image>이미지로 저장 <span>›</span></button>
      <div class="cert-parts">
        <button type="button" class="shop-link" data-edit-face>얼굴 바꾸기 <span>›</span></button>
        <button type="button" class="shop-link" data-edit-emblem>문장 바꾸기 <span>›</span></button>
        ${canSendFeedback() ? '<button type="button" class="shop-link" data-feedback>의견 보내기 <span>›</span></button>' : ''}
      </div>
      <section class="shop-card cert-edit">
        <h3>상단 이름</h3>
        ${
          v.settlement
            ? `<input type="text" data-name maxlength="12" value="${c.name.replace(/"/g, '&quot;')}" aria-label="상단 이름" />
               <button type="button" class="rumor-note" data-company>이름 바꾸기</button>`
            : '<p class="ledger-note plain">상단 이름은 시즌이 끝난 뒤, 다음 시즌을 시작하기 전에 바꿀 수 있어요.</p>'
        }
        ${
          v.titles.length
            ? `<h3>대표 칭호</h3>
               <select data-title aria-label="대표 칭호"><option value="">칭호 없음</option>${v.titles
                 .map((t) => `<option ${t === c.title ? 'selected' : ''}>${t}</option>`)
                 .join('')}</select>`
            : ''
        }
      </section>
      <section class="shop-card cert-edit">
        <h3>인장첩 (${c.badgeCount}) <small>앞면에 ${MAX_PINNED}개까지</small></h3>
        <ul class="cert-book">${book}</ul>
      </section>`;
    body.querySelector('[data-company]')?.addEventListener('click', () =>
      page.send({ type: 'setCompany', name: body.querySelector<HTMLInputElement>('[data-name]')!.value }),
    );
    body.querySelector('[data-edit-face]')!.addEventListener('click', () => openPartsPage(game, 'face'));
    body.querySelector('[data-edit-emblem]')!.addEventListener('click', () => openPartsPage(game, 'emblem'));
    body.querySelector('[data-feedback]')?.addEventListener('click', () => openFeedbackSheet());
    body.querySelector<HTMLSelectElement>('[data-title]')?.addEventListener('change', (e) =>
      page.send({ type: 'setTitle', title: (e.target as HTMLSelectElement).value || null }),
    );
    body.querySelectorAll<HTMLInputElement>('[data-pin]').forEach((box) =>
      box.addEventListener('change', () => {
        const rows = [...body.querySelectorAll<HTMLInputElement>('[data-pin]')].filter((b) => b.checked).map((b) => Number(b.dataset.pin));
        page.send({ type: 'pinBadges', rows });
      }),
    );
    body.querySelector('[data-save-image]')!.addEventListener('click', () => void saveImage(c, body.querySelector<HTMLCanvasElement>('.cert-marks canvas.portrait')));
  });
}

/** 얼굴이나 문장을 고르는 페이지 (증서에서 언제든). 저장을 누르면 명령을 보낸다 */
function openPartsPage(game: Game, kind: 'face' | 'emblem'): void {
  const c = game.view().certificate;
  openLookPage(kind, c, async (look) => {
    const r = await game.dispatch(look.face ? { type: 'setFace', face: look.face } : { type: 'setEmblem', emblem: look.emblem! });
    return r.ok ? null : ERROR_TEXT[r.error];
  });
}

/**
 * 얼굴이나 문장을 고르는 페이지. save가 실패 문구를 돌려주면 페이지에 보이고, null이면 닫는다
 * (세계 안에서는 명령으로, 대기 화면에서는 계정 함수로 저장한다, 0.2.1)
 */
export function openLookPage(
  kind: 'face' | 'emblem',
  initial: { face: Look; emblem: Emblem },
  save: (look: { face?: Look; emblem?: Emblem }) => Promise<string | null>,
  back = '상인 증서',
): void {
  const page = openPage({ back, title: kind === 'face' ? '얼굴 바꾸기' : '문장 바꾸기' });
  page.body.innerHTML = `<div class="shop-card" data-editor></div>
    <button type="button" class="founding-btn" data-save>저장</button>
    <p class="error" data-error hidden></p>`;
  const holder = page.body.querySelector<HTMLElement>('[data-editor]')!;
  const get =
    kind === 'face'
      ? (() => {
          const ed = mountFaceEditor(holder, initial.face);
          return () => ({ face: ed.get() });
        })()
      : (() => {
          const ed = mountEmblemEditor(holder, initial.emblem);
          return () => ({ emblem: ed.get() });
        })();
  page.body.querySelector('[data-save]')!.addEventListener('click', async () => {
    const m = await save(get());
    if (m === null) page.close();
    else {
      const err = page.body.querySelector<HTMLElement>('[data-error]')!;
      err.textContent = m;
      err.hidden = false;
    }
  });
}

/** 증서를 그림으로 그려 내려받는다 (화면과 같은 빈 카드 위에, 공유는 나중 버전). photo: 화면에 이미 그린 얼굴 캔버스 */
async function saveImage(c: CertificateView, photo: HTMLCanvasElement | null): Promise<void> {
  const card = new Image();
  card.src = cardImg;
  await card.decode().catch(() => undefined);
  const W = 640;
  const H = 936;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return;
  await document.fonts?.ready;
  g.fillStyle = '#f5eee1';
  g.fillRect(0, 0, W, H);
  if (card.complete && card.naturalWidth) g.drawImage(card, 0, 0, W, H);
  const line = LINE[c.paper];
  g.strokeStyle = line;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(20, 20, W - 40, H - 40, 14);
  g.stroke();
  const serif = (px: number, w = 400) => `${w} ${px}px 'Nanum Myeongjo', serif`;
  const display = (px: number) => `${px}px 'Jua', sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = '#5b5148';
  g.font = serif(22);
  g.fillText('상인 길드 공인', W / 2, 92);
  g.fillStyle = '#3a312a';
  g.font = serif(64, 800);
  g.fillText('상인증서', W / 2, 172);
  // 얼굴과 문장 (0.1.7)
  if (photo) {
    g.save();
    g.beginPath();
    g.arc(W / 2 - 78, 268, 62, 0, Math.PI * 2);
    g.fillStyle = '#efe6d6';
    g.fill();
    g.clip();
    g.drawImage(photo, W / 2 - 140, 206, 124, 124);
    g.restore();
  }
  await drawEmblem(g, c.emblem, W / 2 + 18, 200, 124);
  g.fillStyle = '#1f3d45';
  g.font = display(52);
  g.fillText(c.name, W / 2, 408);
  g.fillStyle = '#5b5148';
  g.font = serif(30, 700);
  g.fillText(c.title ?? '칭호 없음', W / 2, 458);
  g.font = serif(22, 700);
  g.fillText(`상인 ${c.seasonsCompleted + 1}년차${c.origin ? ` · ${c.origin} 출신` : ''}`, W / 2, 500);
  g.strokeStyle = '#c9bfb1';
  g.setLineDash([]);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(110, 530);
  g.lineTo(W - 110, 530);
  g.stroke();
  g.font = serif(20, 700);
  g.fillText('대표 인장', W / 2, 568);
  // 그림이 있는 인장은 그림을 먼저 읽어 둔다
  const arts = await Promise.all(
    Array.from({ length: MAX_PINNED }, async (_, i) => {
      const src = c.pinned[i] ? badgeArt(c.pinned[i]!.badge) : null;
      if (!src) return null;
      const im = new Image();
      im.src = src;
      return im.decode().then(() => im, () => null);
    }),
  );
  for (let i = 0; i < MAX_PINNED; i++) {
    const b = c.pinned[i];
    const cx = W / 2 + (i - 1.5) * 116;
    const cy = 640;
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7;
      const x = cx + 44 * Math.cos(a);
      const y = cy + 44 * Math.sin(a);
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
    const art = b ? arts[i] : null;
    if (b && art) {
      g.drawImage(art, cx - 48, cy - 48, 96, 96);
      g.fillStyle = '#5b5148';
      g.font = serif(14, 700);
      g.fillText(b.name, cx, cy + 66);
    } else if (b) {
      g.fillStyle = TIER_COLOR[b.tier ?? 'none'];
      g.fill();
      g.fillStyle = '#fff';
      g.font = display(34);
      g.fillText(b.name.slice(0, 1), cx, cy + 12);
      g.fillStyle = '#5b5148';
      g.font = serif(14, 700);
      g.fillText(b.name, cx, cy + 66);
    } else {
      g.setLineDash([5, 4]);
      g.strokeStyle = '#c9bfb1';
      g.stroke();
      g.setLineDash([]);
    }
  }
  const no = merchantNoText(c.merchantNo);
  if (no) {
    g.fillStyle = '#4d5f63';
    g.font = serif(22, 700);
    g.fillText(no, W / 2, H - 124);
  }
  g.fillStyle = '#5b5148';
  g.font = serif(18, 700);
  g.fillText(`${PAPER[c.paper]} · 모은 인장 ${c.badgeCount}${c.bestBigShotRank ? ` · 큰손 최고 ${c.bestBigShotRank}위` : ''}`, W / 2, H - 92);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `상인증서-${c.name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }, 'image/png');
}
