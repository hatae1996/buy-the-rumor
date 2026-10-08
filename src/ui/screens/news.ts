// 소식 탭 (기획서 "화면 구성 - 소식 탭: 들어오는 것 전부", 0.0.5): 신문, 소문 수첩, 보고, 길드.
import sealSmall from '../../../assets/ui/seal_small.png';
import type { LedgerEntry, NoteView, PlayerView } from '../../sim/economy';
import { agoText, ledgerLine } from '../format';
import type { Game } from '../game';
import { noteItem } from './noteItem';
import { guildHtml } from './buildings/simple';

/** 수첩에 한 번에 보여 주는 줄 */
const NOTEBOOK_ROWS = 30;

export function renderNews(el: HTMLElement, game: Game, v: PlayerView): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const items = [...v.news].reverse().slice(0, 30);
  const paper =
    items.map((n) => `<li><span class="day">${agoText(v.day, n.day)}</span> ${n.text}</li>`).join('') ||
    '<li class="muted">아직 큰 소식이 없어요.</li>';

  // 보고: 장날 결과(내가, 창고 짐이, 두 번째 행렬이), 일꾼·마부·정보원. 날짜순 (기획서 "소식 탭")
  const reportKinds = new Set(['buy', 'sell', 'gathered', 'hire', 'caravan', 'warehouse']);
  const byDay = new Map<number, string[]>();
  for (const e of v.ledger) {
    if (!reportKinds.has(e.kind) || (e.kind === 'hire' && e.what === 'wage') || (e.kind === 'warehouse' && e.what === 'rent')) continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), ledgerLine(e as LedgerEntry, townName).text]);
  }
  for (const n of v.rumors) {
    if (n.via !== 'informant' && n.via !== 'pigeon') continue;
    byDay.set(n.day, [...(byDay.get(n.day) ?? []), `${n.from}: ${n.text}`]);
  }
  const results =
    [...byDay]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 15)
      .map(([day, lines]) => `<li><span class="day">${day}일째</span> ${lines.join('<br />')}</li>`)
      .join('') || '<li class="muted">아직 보고가 없어요.</li>';

  const notes =
    [...v.rumors]
      .reverse()
      .slice(0, NOTEBOOK_ROWS)
      .map((n) => noteItem(n, v.day, townName))
      .join('') ||
    '<li class="muted">아직 들은 이야기가 없어요. 마을에 머물면 소문꾼들이 이야기를 들려줘요.</li>';

  el.innerHTML = `
    <section class="card newspaper">
      <img class="seal" src="${sealSmall}" alt="" />
      <h2>장터 신문</h2>
      <p class="muted">${v.day}일째 · 큰 사건을 사실만 실어요</p>
      <ul class="list news-list">${paper}</ul>
    </section>
    <section class="card">
      <h2>소문 수첩</h2>
      <p class="muted">오가며 들은 이야기라 가끔 틀려요. 신문이나 직접 본 것으로 확인되면 도장이 찍혀요.</p>
      ${tellerStamps(v.rumors)}
      <ul class="list">${notes}</ul>
    </section>
    <section class="card">
      <h2>보고</h2>
      <p class="muted">장날 결과, 채집꾼·마부·정보원 소식이 날짜순으로 쌓여요.</p>
      <ul class="list">${results}</ul>
    </section>
    <section class="card">
      <h2>길드</h2>
      ${guildHtml(v)}
      <p class="muted">랭킹은 여럿이 함께하는 버전에서 열려요.</p>
    </section>`;
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
