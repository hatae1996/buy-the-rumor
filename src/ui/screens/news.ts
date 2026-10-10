// 소식 탭 (기획서 "화면 구성 - 소식 탭: 들어오는 것 전부", 0.0.5): 신문, 소문 수첩, 보고, 길드.
import sealSmall from '../../../assets/ui/seal_small.png';
import { GOODS, type GoodId, type LedgerEntry, type NoteView, type PlayerView, type RankingCategoryView } from '../../sim/economy';
import { openCertificate } from './certificate';
import { goodName, ledgerLine } from '../format';
import type { Game } from '../game';
import { heardCard, noteItem, wireHeard } from './noteItem';
import { guildHtml } from './buildings/simple';
import { openPaper, paperBoxHtml } from './newspaper';

/** 수첩에 한 번에 보여 주는 줄 */
const NOTEBOOK_ROWS = 30;

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

  // 소문 수첩 (0.1.2): 여관에서 듣고 내가 적은 것만. 확인 기다림 / 맞음 / 틀림, 물품별로 찾기
  const book = v.rumors.filter((n) => n.via === 'gossip' || n.via === 'inn');
  const inGroup = (n: NoteView) => (group === 'right' ? n.stamp === 'right' : group === 'wrong' ? n.stamp === 'wrong' : n.stamp === null || n.stamp === 'unchecked');
  const goods = GOODS.filter((g) => book.some((n) => n.good === g));
  if (goodFilter && !goods.includes(goodFilter)) goodFilter = null;
  const shown = book.filter((n) => inGroup(n) && (goodFilter === null || n.good === goodFilter));
  const notes =
    [...shown]
      .reverse()
      .slice(0, NOTEBOOK_ROWS)
      .map((n) => noteItem(n, v.day, townName))
      .join('') ||
    `<li class="muted">${book.length ? '여기에 해당하는 이야기가 없어요.' : '아직 적은 이야기가 없어요. 여관 소문꾼에게 듣고 수첩에 적어 보세요.'}</li>`;
  const count = (g: NoteGroup) => book.filter((n) => (g === 'right' ? n.stamp === 'right' : g === 'wrong' ? n.stamp === 'wrong' : n.stamp === null || n.stamp === 'unchecked')).length;
  const recent = v.recentHeard.length
    ? `<section class="card">
        <h2>최근 들은 이야기</h2>
        <p class="muted">적지 않은 이야기는 며칠 뒤 잊혀요. 수첩에 적은 것만 맞았는지 도장이 찍혀요.</p>
        <ul class="list">${[...v.recentHeard].reverse().map((n) => heardCard(n, v.day, townName)).join('')}</ul>
      </section>`
    : '';

  el.innerHTML = `
    <section class="card newspaper">
      <img class="seal" src="${sealSmall}" alt="" />
      <h2>신문함</h2>
      <p class="muted">산 신문이 날짜순으로 쌓여요. 누르면 한 부를 처음부터 끝까지 읽어요.</p>
      ${paperBoxHtml(v)}
    </section>
    ${recent}
    <section class="card">
      <h2>소문 수첩</h2>
      <p class="muted">오가며 들은 이야기라 가끔 틀려요. 신문이나 직접 본 것으로 확인되면 도장이 찍혀요.</p>
      ${tellerStamps(book)}
      <div class="seg note-groups" role="tablist" aria-label="수첩">
        ${NOTE_GROUPS.map((g) => `<button type="button" role="tab" data-group="${g.id}" aria-pressed="${g.id === group}">${g.label} ${count(g.id)}</button>`).join('')}
      </div>
      ${
        goods.length
          ? `<label class="note-filter">물품 <select data-good-filter><option value="">모두</option>${goods
              .map((g) => `<option value="${g}" ${g === goodFilter ? 'selected' : ''}>${goodName(g)}</option>`)
              .join('')}</select></label>`
          : ''
      }
      <ul class="list">${notes}</ul>
    </section>
    <section class="card">
      <h2>보고</h2>
      <p class="muted">장날 결과, 채집꾼·마부·정보원 소식이 날짜순으로 쌓여요.</p>
      <ul class="list">${results}</ul>
    </section>
    <section class="card">
      <h2>랭킹</h2>
      ${rankingHtml(v)}
    </section>
    <section class="card">
      <h2>길드</h2>
      ${guildHtml(v)}
    </section>`;

  el.querySelectorAll<HTMLButtonElement>('[data-cert-id]').forEach((b) =>
    b.addEventListener('click', () => openCertificate(game, b.dataset.certId)),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-paper]').forEach((b) => b.addEventListener('click', () => openPaper(game, Number(b.dataset.paper))));
  el.querySelectorAll<HTMLButtonElement>('[data-group]').forEach((b) =>
    b.addEventListener('click', () => {
      group = b.dataset.group as NoteGroup;
      renderNews(el, game, game.view());
    }),
  );
  el.querySelector<HTMLSelectElement>('[data-good-filter]')?.addEventListener('change', (e) => {
    goodFilter = ((e.target as HTMLSelectElement).value || null) as GoodId | null;
    renderNews(el, game, game.view());
  });
  wireHeard(el, (cmd) => game.dispatch(cmd));
}

type NoteGroup = 'waiting' | 'right' | 'wrong';
const NOTE_GROUPS: { id: NoteGroup; label: string }[] = [
  { id: 'waiting', label: '확인 기다림' },
  { id: 'right', label: '맞음' },
  { id: 'wrong', label: '틀림' },
];
/** 수첩에서 고른 칸과 물품 (다시 그려도 남긴다) */
let group: NoteGroup = 'waiting';
let goodFilter: GoodId | null = null;

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

/** 소문꾼마다 받은 도장 수. 비율은 보여 주지 않고 도장만 센다 (기획서 "들은 이야기 수첩") */
function tellerStamps(notes: readonly NoteView[]): string {
  const by = new Map<string, { right: number; wrong: number }>();
  for (const n of notes) {
    // "확인 못 함"은 도장이 아니라 세지 않는다
    if (!n.stamp || n.stamp === 'unchecked' || n.via !== 'gossip') continue;
    const t = by.get(n.from) ?? { right: 0, wrong: 0 };
    t[n.stamp]++;
    by.set(n.from, t);
  }
  if (!by.size) return '';
  const rows = [...by]
    .map(
      ([name, t]) => `<li class="row"><span>${name}</span><span class="stamp-count">
        ${t.right ? `<span class="stamp right">맞았다 ${t.right}</span>` : ''}${t.wrong ? `<span class="stamp wrong">틀렸다 ${t.wrong}</span>` : ''}
      </span></li>`,
    )
    .join('');
  return `<h3>소문꾼 도장</h3><ul class="list teller-list">${rows}</ul><h3>최근 들은 이야기</h3>`;
}
