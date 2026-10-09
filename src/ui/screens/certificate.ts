// 상인 증서 (기획서 "상인 증서 (ID카드)", 시안 prototypes/id-card.html).
// 남에게 보이는 증서라 순자산 숫자는 없다. 위쪽 줄의 내 문장, 랭킹의 이름을 누르면 열린다.
// 내 증서는 상단 이름·문장, 대표 칭호, 앞면에 달 인장(4개까지)을 고르고, 이미지로 저장한다 (공유는 나중).
// 상단 이름은 고르기만 한다. 금칙어 걸러 내기는 서버 버전에서 (handoff 0.1.0).
import type { CertificateView } from '../../sim/ranking';
import type { Game } from '../game';
import { openLiveSheet } from '../liveSheet';

const PAPER = { worn: '낡은 종이', parchment: '양피지', gilded: '금테' } as const;
const TIER = { bronze: '동', silver: '은', gold: '금' } as const;
const KIND = { quest: '의뢰', ranking: '랭킹', achievement: '업적', memorial: '기념' } as Record<string, string>;
/** 앞면에 다는 인장 수 (src/sim/ranking MAX_PINNED) */
const MAX_PINNED = 4;

function face(c: CertificateView, crests: Record<string, string>): string {
  const pinned = c.pinned.length
    ? c.pinned.map((b) => `<span class="badge">${b.name}${b.tier ? ` · ${TIER[b.tier]}` : ''}</span>`).join(' ')
    : '<span class="muted">달고 다니는 인장이 없어요.</span>';
  return `<section class="card certificate">
      <p class="muted">상인 길드 증서 · ${PAPER[c.paper]} · 문장 ${crests[c.crest] ?? c.crest}</p>
      <h2>${c.name}</h2>
      <p>${c.title ?? '칭호 없음'}${c.origin ? ` · ${c.origin} 출신` : ''} · 상인 ${c.seasonsCompleted + 1}년차</p>
      <h3>달고 다니는 인장</h3>
      <p>${pinned}</p>
      <p class="muted">모은 인장 ${c.badgeCount}${c.bestBigShotRank ? ` · 큰손 최고 ${c.bestBigShotRank}위` : ''}</p>
    </section>`;
}

/** id가 없으면 내 증서 */
export function openCertificate(game: Game, id?: string): void {
  const mine = id === undefined || id === game.playerId;
  openLiveSheet(game, '상인 증서', (body, v, sheet) => {
    const c = mine ? v.certificate : v.certificates[id!];
    if (!c) {
      sheet.close();
      return;
    }
    if (!mine) {
      body.innerHTML = `${face(c, v.crests)}<p class="muted">남의 증서에는 순자산이 없어요. 인장첩은 그 상단만 봐요.</p>`;
      return;
    }
    const pinnedRows = new Set(v.certificate.pinned.map((p) => v.badgeBook.findIndex((b) => b.name === p.name && b.season === p.season)));
    const book =
      v.badgeBook
        .map(
          (b, i) => `<li class="row"><span>${b.name}${b.tier ? ` <span class="stamp right">${TIER[b.tier]}</span>` : ''} <small class="muted">${KIND[b.kind] ?? ''} · ${b.season}시즌</small></span>
            <label class="pin-toggle"><input type="checkbox" data-pin="${i}" ${pinnedRows.has(i) ? 'checked' : ''} ${!pinnedRows.has(i) && pinnedRows.size >= MAX_PINNED ? 'disabled' : ''} /> 앞면</label></li>`,
        )
        .join('') || '<li class="muted">원정과 장사에서 이야기가 되는 순간, 랭킹, 길드 의뢰, 시즌 완주로 인장이 모여요.</li>';
    body.innerHTML = `
      ${face(c, v.crests)}
      <div class="btn-row"><button type="button" class="secondary-btn" data-save-image>이미지로 저장</button></div>
      <h3>상단 이름과 문장</h3>
      <div class="field-row">
        <input type="text" data-name maxlength="12" value="${c.name.replace(/"/g, '&quot;')}" aria-label="상단 이름" />
        <select data-crest aria-label="문장">${Object.entries(v.crests)
          .map(([k, name]) => `<option value="${k}" ${k === c.crest ? 'selected' : ''}>${name}</option>`)
          .join('')}</select>
        <button type="button" class="secondary-btn" data-company>바꾸기</button>
      </div>
      ${
        v.titles.length
          ? `<h3>대표 칭호</h3>
             <select data-title aria-label="대표 칭호"><option value="">칭호 없음</option>${v.titles
               .map((t) => `<option ${t === c.title ? 'selected' : ''}>${t}</option>`)
               .join('')}</select>`
          : ''
      }
      <h3>인장첩 (${c.badgeCount}) <small class="muted">앞면에 ${MAX_PINNED}개까지</small></h3>
      <ul class="list">${book}</ul>`;
    body.querySelector('[data-company]')!.addEventListener('click', () =>
      sheet.send({
        type: 'setCompany',
        name: body.querySelector<HTMLInputElement>('[data-name]')!.value,
        crest: body.querySelector<HTMLSelectElement>('[data-crest]')!.value,
      }),
    );
    body.querySelector<HTMLSelectElement>('[data-title]')?.addEventListener('change', (e) =>
      sheet.send({ type: 'setTitle', title: (e.target as HTMLSelectElement).value || null }),
    );
    body.querySelectorAll<HTMLInputElement>('[data-pin]').forEach((box) =>
      box.addEventListener('change', () => {
        const rows = [...body.querySelectorAll<HTMLInputElement>('[data-pin]')].filter((b) => b.checked).map((b) => Number(b.dataset.pin));
        sheet.send({ type: 'pinBadges', rows });
      }),
    );
    body.querySelector('[data-save-image]')!.addEventListener('click', () => saveImage(c, v.crests));
  });
}

/** 증서를 그림으로 그려 내려받는다 (공유는 나중 버전) */
function saveImage(c: CertificateView, crests: Record<string, string>): void {
  const W = 720;
  const H = 960;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return;
  const css = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const paper = c.paper === 'gilded' ? '#f3dfa2' : c.paper === 'parchment' ? '#efe0bd' : color('--paper', '#f1e2c6');
  const ink = color('--ink', '#3b2a1e');
  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = c.paper === 'gilded' ? '#c79a2e' : ink;
  g.lineWidth = 8;
  g.strokeRect(24, 24, W - 48, H - 48);
  g.fillStyle = ink;
  g.textAlign = 'center';
  const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px system-ui, sans-serif`;
  g.font = font(28);
  g.fillText(`상인 길드 증서 · ${PAPER[c.paper]}`, W / 2, 110);
  g.font = font(56, true);
  g.fillText(c.name, W / 2, 220);
  g.font = font(30);
  g.fillText(`문장: ${crests[c.crest] ?? c.crest}`, W / 2, 290);
  g.fillText(`${c.title ?? '칭호 없음'} · 상인 ${c.seasonsCompleted + 1}년차`, W / 2, 345);
  g.font = font(32, true);
  g.fillText('달고 다니는 인장', W / 2, 460);
  g.font = font(30);
  c.pinned.forEach((b, i) => g.fillText(`${b.name}${b.tier ? ` · ${TIER[b.tier]}` : ''}`, W / 2, 520 + i * 56));
  if (!c.pinned.length) g.fillText('아직 없음', W / 2, 520);
  g.font = font(26);
  g.fillText(`모은 인장 ${c.badgeCount}${c.bestBigShotRank ? ` · 큰손 최고 ${c.bestBigShotRank}위` : ''}`, W / 2, H - 90);
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
