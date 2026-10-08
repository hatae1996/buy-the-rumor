// 소식: 신문, 들은 이야기 수첩, 장날 결과 기록 (기획서 "화면 구성").
import sealSmall from '../../../assets/ui/seal_small.png';
import type { LedgerEntry, PlayerView } from '../../sim/economy';
import { agoText, ledgerLine } from '../format';
import type { Game } from '../game';

export function renderNews(el: HTMLElement, game: Game, v: PlayerView): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const items = [...v.news].reverse().slice(0, 30);
  const paper =
    items.map((n) => `<li><span class="day">${agoText(v.day, n.day)}</span> ${n.text}</li>`).join('') ||
    '<li class="muted">아직 큰 소식이 없어요.</li>';

  // 장날마다 내 신청이 어떻게 맞춰졌는지
  const byDay = new Map<number, LedgerEntry[]>();
  for (const e of v.ledger) {
    if (e.kind !== 'buy' && e.kind !== 'sell') continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  }
  const results =
    [...byDay]
      .reverse()
      .slice(0, 15)
      .map(
        ([day, es]) =>
          `<li><span class="day">${day}일째 장날</span> ${es.map((e) => ledgerLine(e, townName).text).join(', ')}</li>`,
      )
      .join('') || '<li class="muted">아직 맞춰진 신청이 없어요.</li>';

  el.innerHTML = `
    <section class="card newspaper">
      <img class="seal" src="${sealSmall}" alt="" />
      <h2>장터 신문</h2>
      <p class="muted">${v.day}일째 · 큰 사건을 사실만 실어요</p>
      <ul class="list news-list">${paper}</ul>
    </section>
    <section class="card">
      <h2>들은 이야기 수첩</h2>
      <p class="muted">아직 들은 이야기가 없어요. 원정을 나가거나 여관에 들르면 이야기를 듣게 돼요.</p>
    </section>
    <section class="card">
      <h2>장날 결과 기록</h2>
      <ul class="list">${results}</ul>
    </section>`;
}
