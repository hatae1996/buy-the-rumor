// 장부: 가진 돈, 짐과 신선도, 넣어 둔 신청, 내가 아는 시세(날짜 표시), 손익 (기획서 "화면 구성").
import coins from '../../../assets/ui/coins.png';
import { ECONOMY } from '../../sim/constants';
import { count, GOODS, type PlayerView } from '../../sim/economy';
import { agoText, freshness, goodName, ledgerLine, money } from '../format';
import type { Game } from '../game';

export function renderLedger(el: HTMLElement, game: Game, v: PlayerView, cancelOrder: (id: number) => void): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const rate = ECONOMY.spoilRate[v.season];

  // 아는 시세로 짐 값을 어림한다 (지금 마을 시세, 길 위면 떠난 마을에서 마지막으로 본 시세)
  const prices = v.market?.price ?? v.memory[v.location.kind === 'road' ? v.location.from : v.location.town]?.prices;
  const cargoValue = prices ? v.cargo.reduce((s, l) => s + l.qty * prices[l.good], 0) : null;

  // 물품마다 한 줄. 상하는 물건은 가장 먼저 상하는 묶음의 상태를 보여 준다
  const cargo =
    GOODS.filter((g) => count(v.cargo, g) > 0)
      .map((g) => {
        const lots = v.cargo.filter((l) => l.good === g);
        const oldest = lots.reduce((a, l) => (l.age > a.age ? l : a));
        const f = freshness(oldest, rate);
        return `<li class="row"><span>${goodName(g)} ${count(v.cargo, g)}개</span><span class="chip ${f.level}">${f.text}</span></li>`;
      })
      .join('') || '<li class="muted">짐칸이 비었어요.</li>';

  const orders =
    v.orders
      .map(
        (o) => `<li class="order-row">
          <span class="order-side ${o.side}">${o.side === 'sell' ? '팔기' : '사기'}</span>
          <span>${goodName(o.good)} ${o.qty}개 · ${o.side === 'sell' ? `${o.limit} 이상` : `${o.limit} 이하`}</span>
          <button type="button" class="link-btn" data-cancel="${o.id}">취소</button>
        </li>`,
      )
      .join('') || '<li class="muted">장날에 낼 신청이 없어요.</li>';

  const here = v.location.kind === 'town' ? v.location.town : null;
  const known = game.map.towns
    .map((t) => {
      const mem = v.memory[t.id];
      const badge = here === t.id ? '지금 여기' : mem ? `${agoText(v.day, mem.day)} 본 시세` : '가 본 적 없음';
      const head = `<header class="card-head"><h3>${t.name}</h3><span class="badge">${badge}</span></header>`;
      if (!mem) return `<div class="memory">${head}<p class="muted">직접 가 보거나 소문을 들어야 알 수 있어요.</p></div>`;
      const cells = GOODS.map((g) => `<span><span class="muted">${goodName(g)}</span> ${mem.prices[g]}</span>`).join('');
      return `<div class="memory">${head}<div class="memory-prices">${cells}</div></div>`;
    })
    .join('');

  const entries = [...v.ledger].reverse().slice(0, 40);
  const ledger =
    entries
      .map((e) => {
        const { text, amount } = ledgerLine(e, townName);
        const amt =
          amount === null ? '' : `<b class="${amount >= 0 ? 'plus' : 'minus'}">${amount >= 0 ? '+' : '−'}${money(Math.abs(amount))}</b>`;
        return `<li class="row"><span><span class="day">${e.day}일째</span> ${text}</span>${amt}</li>`;
      })
      .join('') || '<li class="muted">아직 적힌 게 없어요. 마을에서 물건을 사고팔아 보세요.</li>';

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
      <h2>넣어 둔 신청</h2>
      <ul class="order-list">${orders}</ul>
    </section>
    <section class="card">
      <h2>내가 아는 시세</h2>
      <p class="muted">다른 마을 시세는 마지막으로 본 날의 값이에요. 지금은 달라졌을 수 있어요.</p>
      ${known}
    </section>
    <section class="card">
      <h2>손익</h2>
      <ul class="list">${ledger}</ul>
    </section>`;

  el.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
    b.addEventListener('click', () => cancelOrder(Number(b.dataset.cancel))),
  );
}
