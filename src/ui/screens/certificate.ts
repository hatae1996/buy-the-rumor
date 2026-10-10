// 상인 증서 (기획서 "상인 증서 (ID카드)", 0.1.6 목업 docs/reference/certificate-mockup-0.1.6.png).
// 남에게 보이는 증서라 순자산 숫자는 없다. 위쪽 줄의 내 문장, 랭킹의 이름을 누르면 열린다.
// 빈 카드 그림(assets/ui/certificate_card.jpg) 위에 테두리 줄(종이 등급마다 색), 상단 이름, 대표 칭호, 년차, 대표 인장 4개.
// 가운데 문장(마크)은 틀·색·무늬를 나눠 고르는 부품이 오기 전까지 점선 방패 자리만 둔다.
// 내 증서는 상단 이름·문장, 대표 칭호, 앞면에 달 인장(4개까지)을 고르고, 이미지로 저장한다 (공유는 나중).
// 상단 이름은 고르기만 한다. 금칙어 걸러 내기는 서버 버전에서 (handoff 0.1.0).
import cardImg from '../../../assets/ui/certificate_card.jpg';
import type { CertificateView } from '../../sim/ranking';
import type { Game } from '../game';
import { openLivePage } from '../livePage';

const PAPER = { worn: '낡은 종이', parchment: '양피지', gilded: '금테' } as const;
/** 종이 등급마다 테두리 줄 색 */
const LINE = { worn: '#8b6b4a', parchment: '#2f8f8a', gilded: '#c79a2e' } as const;
const TIER = { bronze: '동', silver: '은', gold: '금' } as const;
/** 인장 바탕색 (등급이 없는 인장은 청록) */
const TIER_COLOR = { bronze: '#8a5a3a', silver: '#8f99a3', gold: '#cf9f32', none: '#3f8f8a' } as const;
const KIND = { quest: '의뢰', ranking: '랭킹', achievement: '업적', memorial: '기념' } as Record<string, string>;
/** 앞면에 다는 인장 수 (src/sim/ranking MAX_PINNED) */
const MAX_PINNED = 4;

/** 가운데 문장 자리: 부품이 오기 전까지 점선 방패와 문장 이름 */
const SHIELD = 'M50 4 L92 18 L92 52 C92 78 72 96 50 104 C28 96 8 78 8 52 L8 18 Z';
function crestSlot(name: string): string {
  return `<svg class="cert-crest" viewBox="0 0 100 108" role="img" aria-label="문장 ${name}">
    <path d="${SHIELD}" fill="rgba(60,50,40,0.04)" stroke="#b9ae9f" stroke-width="2" stroke-dasharray="6 5" />
    <text x="50" y="60" text-anchor="middle">${name}</text>
  </svg>`;
}

/** 대표 인장 하나: 등급 색 칠각 메달에 이름 첫 글자, 아래에 이름. 빈 자리는 점선 */
function badgeToken(b: CertificateView['pinned'][number] | undefined): string {
  if (!b) return '<span class="cert-badge empty"><span class="cert-medal"></span><small>빈 자리</small></span>';
  const color = TIER_COLOR[b.tier ?? 'none'];
  return `<span class="cert-badge"><span class="cert-medal" style="--medal:${color}">${b.name.slice(0, 1)}</span><small>${b.name}${b.tier ? ` · ${TIER[b.tier]}` : ''}</small></span>`;
}

function face(c: CertificateView, crests: Record<string, string>): string {
  const slots = Array.from({ length: MAX_PINNED }, (_, i) => badgeToken(c.pinned[i])).join('');
  return `<section class="cert-card" style="--cert-line:${LINE[c.paper]};background-image:url('${cardImg}')" aria-label="상인 증서">
      <div class="cert-inner">
        <p class="cert-kicker"><span></span>상인 길드 공인<span></span></p>
        <h2 class="cert-title">상인증서</h2>
        ${crestSlot(crests[c.crest] ?? c.crest)}
        <h3 class="cert-name">${c.name}</h3>
        <p class="cert-honor">${c.title ?? '칭호 없음'}</p>
        <p class="cert-years">상인 ${c.seasonsCompleted + 1}년차${c.origin ? ` · ${c.origin} 출신` : ''}</p>
        <p class="cert-label">대표 인장</p>
        <div class="cert-badges">${slots}</div>
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
      body.innerHTML = `${face(c, v.crests)}<p class="ledger-note plain">남의 증서에는 순자산이 없어요. 인장첩은 그 상단만 봐요.</p>`;
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
      ${face(c, v.crests)}
      <button type="button" class="shop-link" data-save-image>이미지로 저장 <span>›</span></button>
      <section class="shop-card cert-edit">
        <h3>상단 이름과 문장</h3>
        <input type="text" data-name maxlength="12" value="${c.name.replace(/"/g, '&quot;')}" aria-label="상단 이름" />
        <select data-crest aria-label="문장">${Object.entries(v.crests)
          .map(([k, name]) => `<option value="${k}" ${k === c.crest ? 'selected' : ''}>${name}</option>`)
          .join('')}</select>
        <button type="button" class="rumor-note" data-company>바꾸기</button>
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
    body.querySelector('[data-company]')!.addEventListener('click', () =>
      page.send({
        type: 'setCompany',
        name: body.querySelector<HTMLInputElement>('[data-name]')!.value,
        crest: body.querySelector<HTMLSelectElement>('[data-crest]')!.value,
      }),
    );
    body.querySelector<HTMLSelectElement>('[data-title]')?.addEventListener('change', (e) =>
      page.send({ type: 'setTitle', title: (e.target as HTMLSelectElement).value || null }),
    );
    body.querySelectorAll<HTMLInputElement>('[data-pin]').forEach((box) =>
      box.addEventListener('change', () => {
        const rows = [...body.querySelectorAll<HTMLInputElement>('[data-pin]')].filter((b) => b.checked).map((b) => Number(b.dataset.pin));
        page.send({ type: 'pinBadges', rows });
      }),
    );
    body.querySelector('[data-save-image]')!.addEventListener('click', () => void saveImage(c, v.crests));
  });
}

/** 증서를 그림으로 그려 내려받는다 (화면과 같은 빈 카드 위에, 공유는 나중 버전) */
async function saveImage(c: CertificateView, crests: Record<string, string>): Promise<void> {
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
  // 문장 자리
  g.save();
  g.translate(W / 2 - 60, 206);
  g.scale(1.2, 1.2);
  g.setLineDash([6, 5]);
  g.strokeStyle = '#b9ae9f';
  g.lineWidth = 2;
  g.stroke(new Path2D(SHIELD));
  g.restore();
  g.fillStyle = '#8a8076';
  g.font = serif(18, 700);
  g.fillText(crests[c.crest] ?? c.crest, W / 2, 280);
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
    if (b) {
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
