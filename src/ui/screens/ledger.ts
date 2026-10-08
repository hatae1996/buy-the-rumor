// 장부: 가진 돈, 짐(상하는 날), 지난 거래.
import coins from '../../../assets/ui/coins.png';
import { count, GOODS, shelfLife, type PlayerView } from '../../sim/economy';
import { freshness, goodName, ledgerLine, money } from '../format';
import type { Game } from '../game';

export function renderLedger(el: HTMLElement, game: Game, v: PlayerView): void {
  const townName = (id: number) => game.map.towns[id]!.name;

  // 아는 시세로 짐 값을 어림한다 (지금 마을 시세, 길 위면 마지막으로 본 시세)
  const prices = v.market?.price ?? v.memory[v.location.kind === 'road' ? v.location.from : v.location.town]?.prices;
  const cargoValue = prices ? v.cargo.reduce((s, l) => s + l.qty * prices[l.good], 0) : null;

  // 물품마다 한 줄. 상하는 물건은 가장 먼저 상하는 묶음을 알려 준다
  const cargo = GOODS.filter((g) => count(v.cargo, g) > 0)
    .map((g) => {
      const total = count(v.cargo, g);
      const lots = v.cargo.filter((l) => l.good === g);
      const oldest = lots.reduce((a, l) => (l.age > a.age ? l : a));
      const soon = lots.filter((l) => l.age === oldest.age).reduce((s, l) => s + l.qty, 0);
      const f = freshness(oldest);
      const text = shelfLife(g) === null || soon === total ? f.text : `${soon}개는 ${f.text}`;
      return `<li class="row"><span>${goodName(g)} ${total}개</span><span class="${f.urgent ? 'warn' : 'muted'}">${text}</span></li>`;
    })
    .join('') || '<li class="muted">짐칸이 비었어요.</li>';

  const entries = [...v.ledger].reverse().slice(0, 40);
  const ledger = entries.length
    ? entries
        .map((e) => {
          const { text, amount } = ledgerLine(e, townName);
          const amt = amount === null ? '' : `<b class="${amount >= 0 ? 'plus' : 'minus'}">${amount >= 0 ? '+' : '−'}${money(Math.abs(amount))}</b>`;
          return `<li class="row"><span><span class="day">${e.day}일째</span> ${text}</span>${amt}</li>`;
        })
        .join('')
    : '<li class="muted">아직 적힌 게 없어요. 마을에서 물건을 사고팔아 보세요.</li>';

  el.innerHTML = `
    <section class="card money-card">
      <img src="${coins}" alt="" />
      <div>
        <div class="muted">가진 돈</div>
        <div class="big-number">${money(v.gold)}</div>
        ${v.reserved ? `<div class="muted">신청에 맡긴 돈 ${money(v.reserved)}</div>` : ''}
        ${cargoValue !== null ? `<div class="muted">짐을 아는 시세로 치면 ${money(cargoValue)}</div>` : ''}
      </div>
    </section>
    <section class="card">
      <header class="card-head"><h2>짐</h2><span class="badge">${v.cargoCount} / ${v.capacity}</span></header>
      <ul class="list">${cargo}</ul>
    </section>
    <section class="card">
      <h2>지난 거래</h2>
      <ul class="list">${ledger}</ul>
    </section>`;
}
