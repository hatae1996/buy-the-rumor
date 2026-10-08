// 상인 증서 (기획서 "상인 증서 (ID카드)", 시안 prototypes/id-card.html). 위쪽 줄의 내 문장을 누르면 열린다.
// 남에게 보이는 증서라 순자산 숫자는 없다. 인장 바꾸기와 이미지로 저장은 랭킹 화면 버전에서.
import type { Game } from '../game';
import { openLiveSheet } from '../liveSheet';

const PAPER = { worn: '낡은 종이', parchment: '양피지', gilded: '금테' } as const;
const TIER = { bronze: '동', silver: '은', gold: '금' } as const;
const KIND = { quest: '의뢰', ranking: '랭킹', achievement: '업적', memorial: '기념' } as Record<string, string>;

export function openCertificate(game: Game): void {
  openLiveSheet(game, '상인 증서', (body, v) => {
    const c = v.certificate;
    const pinned = c.pinned.length
      ? c.pinned.map((b) => `<span class="badge">${b.name}${b.tier ? ` · ${TIER[b.tier]}` : ''}</span>`).join(' ')
      : '<span class="muted">아직 달고 다니는 인장이 없어요.</span>';
    const book =
      v.badgeBook
        .map((b) => `<li class="row"><span>${b.name} <small class="muted">${KIND[b.kind] ?? ''} · ${b.season}시즌</small></span>${b.tier ? `<span class="stamp right">${TIER[b.tier]}</span>` : ''}</li>`)
        .join('') || '<li class="muted">원정과 장사에서 이야기가 되는 순간, 길드 의뢰, 시즌 완주로 인장이 모여요.</li>';
    body.innerHTML = `
      <section class="card certificate">
        <p class="muted">상인 길드 증서 · ${PAPER[c.paper]}</p>
        <h2>${c.name}</h2>
        <p>${c.title ?? '칭호 없음'}${c.origin ? ` · ${c.origin} 출신` : ''} · 상인 ${c.seasonsCompleted + 1}년차</p>
        <h3>달고 다니는 인장</h3>
        <p>${pinned}</p>
      </section>
      <h3>인장첩 (${c.badgeCount})</h3>
      <ul class="list">${book}</ul>`;
  });
}
