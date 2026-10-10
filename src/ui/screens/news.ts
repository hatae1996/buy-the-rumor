// 소식 탭 (기획서 "화면 구성 - 소식 탭: 들어오는 것 전부", 0.0.5 → 0.1.6 목업): 작은 탭 4개.
// 소문(들은 이야기 수첩, newsRumors.ts) / 신문(신문함) / 활동(보고) / 길드(랭킹과 길드). 크림 바탕에 신문 제목.
import paperIcon from '../../../assets/ui/tab_news.png';
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import type { LedgerEntry, PlayerView, RankingCategoryView } from '../../sim/economy';
import { openCertificate } from './certificate';
import { ledgerLine } from '../format';
import type { Game } from '../game';
import { guildHtml } from './buildings/simple';
import { openPaper, paperBoxHtml } from './newspaper';
import { bindRumors, rumorsHtml } from './newsRumors';

type NewsTab = 'rumors' | 'paper' | 'reports' | 'guild';
const TABS: { id: NewsTab; label: string }[] = [
  { id: 'rumors', label: '소문' },
  { id: 'paper', label: '신문' },
  { id: 'reports', label: '활동' },
  { id: 'guild', label: '길드' },
];
/** 고른 작은 탭 (다시 그려도 남긴다) */
let tab: NewsTab = 'rumors';

export function renderNews(el: HTMLElement, game: Game, v: PlayerView): void {
  const townName = (id: number) => game.map.towns[id]!.name;

  // 보고: 장날 결과(내가, 창고 짐이, 두 번째 행렬이), 일꾼·마부·정보원. 날짜순 (기획서 "소식 탭")
  const reportKinds = new Set(['buy', 'sell', 'gathered', 'hire', 'caravan', 'warehouse']);
  const byDay = new Map<number, string[]>();
  for (const e of v.ledger) {
    if (!reportKinds.has(e.kind) || (e.kind === 'hire' && e.what === 'wage') || (e.kind === 'warehouse' && e.what === 'rent')) continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), ledgerLine(e as LedgerEntry, townName).text]);
  }
  // 소문이 아닌 것 (전서구, 정보원, 원정에서 직접 본 것)은 수첩이 아니라 보고에 저절로 남는다 (질문 97 기본안)
  for (const n of v.rumors) {
    if (n.via !== 'informant' && n.via !== 'pigeon' && n.via !== 'seen') continue;
    byDay.set(n.day, [...(byDay.get(n.day) ?? []), `${n.from}: ${n.text}`]);
  }
  const results =
    [...byDay]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 15)
      .map(([day, lines]) => `<li><span class="day">${day}일째</span> ${lines.join('<br />')}</li>`)
      .join('') || '<li class="muted">아직 보고가 없어요.</li>';

  const bodies: Record<NewsTab, () => string> = {
    rumors: () => rumorsHtml(game, v),
    paper: () => `<section class="card newspaper">
        <h2>신문함</h2>
        <p class="muted">산 신문이 날짜순으로 쌓여요. 누르면 한 부를 처음부터 끝까지 읽어요.</p>
        ${paperBoxHtml(v)}
      </section>`,
    reports: () => `<section class="card">
        <h2>보고</h2>
        <p class="muted">장날 결과, 채집꾼·마부·정보원 소식이 날짜순으로 쌓여요.</p>
        <ul class="list">${results}</ul>
      </section>`,
    guild: () => `<section class="card">
        <h2>랭킹</h2>
        ${rankingHtml(v)}
      </section>
      <section class="card">
        <h2>길드</h2>
        ${guildHtml(v)}
      </section>`,
  };

  el.innerHTML = `
    <header class="ledger-head">
      <img class="town-sprig" src="${sprigL}" alt="" />
      <img class="ledger-book" src="${paperIcon}" alt="" />
      <div><h2>소식</h2><small>상인의 정보 수첩</small></div>
      <img class="town-sprig" src="${sprigR}" alt="" />
    </header>
    <div class="seg ledger-tabs" role="tablist" aria-label="소식">
      ${TABS.map((t) => `<button type="button" role="tab" data-news-tab="${t.id}" aria-pressed="${t.id === tab}" aria-selected="${t.id === tab}">${t.label}</button>`).join('')}
    </div>
    ${bodies[tab]()}`;

  const rerender = () => renderNews(el, game, game.view());
  el.querySelectorAll<HTMLButtonElement>('[data-news-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.newsTab as NewsTab;
      rerender();
    }),
  );
  if (tab === 'rumors') bindRumors(el, game, rerender);
  el.querySelectorAll<HTMLButtonElement>('[data-cert-id]').forEach((b) =>
    b.addEventListener('click', () => openCertificate(game, b.dataset.certId)),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-paper]').forEach((b) => b.addEventListener('click', () => openPaper(game, Number(b.dataset.paper))));
}

/**
 * 대표 부문은 1~3위를, 물품왕은 1위만. 이름을 누르면 상인 증서(내 세계 상단만). 남의 순자산 숫자는 보이지 않는다.
 * 순위는 시즌 전체(같은 시즌의 모든 세계)이고, 내 세계 순위를 함께 적는다 (0.1.3)
 */
function rankingHtml(v: PlayerView): string {
  const r = v.ranking;
  if (r.day === null) return '<p class="muted">첫 장날이 지나면 순위가 매겨져요.</p>';
  const who = (t: RankingCategoryView['top'][number]) =>
    t.mine ? `<button type="button" class="link-btn" data-cert-id="${t.id}">${t.rank}위 ${t.name}</button>` : `<span>${t.rank}위 ${t.name}</span>`;
  const mine = (c: RankingCategoryView) =>
    c.mine
      ? `<small class="muted">나 ${c.mine.rank}위 · 상위 ${Math.max(1, Math.round(c.mine.topShare * 100))}%${c.world.mine ? ` · 내 세계 ${c.world.mine.rank}위` : ''}</small>`
      : '<small class="muted">나는 아직 기록 없음</small>';
  const main = r.categories
    .filter((c) => !c.id.startsWith('goodsKing:'))
    .map((c) => `<li><b>${c.name}</b> ${mine(c)}<br />${c.top.map(who).join(' ') || '<span class="muted">아직 없음</span>'}</li>`)
    .join('');
  const kings = r.categories
    .filter((c) => c.id.startsWith('goodsKing:') && c.top.length)
    .map((c) => `<li class="row"><span>${c.name}</span><span>${who(c.top[0]!)} ${c.mine ? `<small class="muted">나 ${c.mine.rank}위${c.world.mine ? ` · 내 세계 ${c.world.mine.rank}위` : ''}</small>` : ''}</span></li>`)
    .join('');
  return `<p class="muted">${r.day}일째 장날 기준 · 장날마다 바뀌어요. 시즌 전체 순위예요(같은 시즌에 열린 모든 세계). 순자산 숫자는 남에게 보이지 않아요.</p>
    <ul class="list">${main}</ul>
    ${kings ? `<h3>물품왕</h3><ul class="list">${kings}</ul>` : ''}`;
}
