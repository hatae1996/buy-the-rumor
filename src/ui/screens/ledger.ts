// 장부 탭 (기획서 "화면 구성 - 장부 탭: 내 것 전부", 0.0.5): 짐, 신청, 사람과 말, 시세, 돈.
import coins from '../../../assets/ui/coins.png';
import { ECONOMY } from '../../sim/constants';
import { count, GOODS, type CartPieceView, type PlayerView } from '../../sim/economy';
import { agoText, freshness, goodName, ledgerLine, money } from '../format';
import { mountCartBoard } from '../cartBoard';
import type { Game } from '../game';
import { horseFatigue, speedWord } from './horseSheet';
import { euro } from '../../sim/josa';

/** 판 위 짐 요약: "소금 6 · 목재 2" */
function piecesSummary(pieces: readonly CartPieceView[]): string {
  const by = new Map<string, number>();
  for (const p of pieces) if (p.qty) by.set(p.good, (by.get(p.good) ?? 0) + p.qty);
  return [...by].map(([g, n]) => `${goodName(g as (typeof GOODS)[number])} ${n}`).join(' · ') || '빈 판';
}

export function renderLedger(el: HTMLElement, game: Game, v: PlayerView, cancelOrder: (id: number) => void): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const rate = ECONOMY.spoilRate[v.season];

  // 아는 시세로 짐 값을 어림한다 (지금 마을 시세, 길 위면 떠난 마을에서 마지막으로 본 시세)
  const prices = v.market?.price ?? v.memory[v.location.kind === 'road' ? v.location.from : v.location.town]?.prices;
  const cargoValue = prices ? v.cargo.reduce((s, l) => s + l.qty * prices[l.good], 0) : null;

  // 내 수레: 물품마다 한 줄. 상하는 물건은 가장 먼저 상하는 묶음의 상태
  const cargo =
    GOODS.filter((g) => count(v.cargo, g) > 0)
      .map((g) => {
        const lots = v.cargo.filter((l) => l.good === g);
        const oldest = lots.reduce((a, l) => (l.age > a.age ? l : a));
        const f = freshness(oldest, rate);
        return `<li class="row"><span>${goodName(g)} ${count(v.cargo, g)}개</span><span class="chip ${f.level}">${f.text}</span></li>`;
      })
      .join('') || '<li class="muted">짐칸이 비었어요.</li>';

  // 다른 판들: 짐꾼 손수레, 두 번째 행렬 수레, 창고
  const others = [
    ...v.hires
      .filter((h) => h.board)
      .map((h) => `<li class="row"><span><b>짐꾼 ${h.name}</b> 손수레 <small class="muted">${h.board!.weight}/${h.board!.maxWeight}</small><br /><small>${piecesSummary(h.board!.pieces)}</small></span></li>`),
    ...(v.caravan
      ? [
          `<li class="row"><span><b>두 번째 행렬</b> ${v.caravan.cart.name} <small class="muted">${v.caravan.travel ? `${euro(townName(v.caravan.travel.to))} 가는 중` : townName(v.caravan.town)}</small><br /><small>${piecesSummary(v.caravan.cart.pieces)}</small></span></li>`,
        ]
      : []),
    ...v.warehouses.map(
      (w) => `<li class="row"><span><b>${townName(w.town)} 창고</b> <small class="muted">짐 ${w.count}개 · 보관료 하루 ${money(w.fee)}${w.owed ? ` · 밀린 보관료 ${money(w.owed)}` : ''}</small><br /><small>${piecesSummary(w.pieces)}</small></span></li>`,
    ),
  ].join('');

  // 신청: 마을마다 (수레 짐, 창고 짐)
  const orders =
    v.orders
      .map(
        (o) => `<li class="order-row">
          <span class="order-side ${o.side}">${o.side === 'sell' ? '팔기' : '사기'}</span>
          <span>${townName(o.town)} · ${goodName(o.good)} ${o.qty}개${o.from === 'store' ? ' (창고)' : ''} · ${o.side === 'sell' ? `${o.limit} 이상` : `${o.limit} 이하`}</span>
          <button type="button" class="link-btn" data-cancel="${o.id}">취소</button>
        </li>`,
      )
      .join('') || '<li class="muted">장날에 낼 신청이 없어요.</li>';

  // 사람과 말: 하루 유지비 합계가 맨 위
  const people = [
    ...v.hires.map((h) => `<li class="row"><span>${h.roleName} ${h.name} <small class="muted">${h.jobName} · ${townName(h.town)}</small></span><b>${money(h.wage)}/일</b></li>`),
    ...v.informants.map((t) => `<li class="row"><span>정보원 <small class="muted">${townName(t)}</small></span></li>`),
    ...v.horses.map((h) => `<li><b>${h.name}</b> <small class="muted">내 행렬 · 끄는 무게 ${h.pulling} · ${speedWord(h.speed)}</small>${horseFatigue(h)}</li>`),
    ...(v.caravan?.horses ?? []).map((h) => `<li><b>${h.name}</b> <small class="muted">두 번째 행렬</small>${horseFatigue(h)}</li>`),
  ].join('');

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
    <section class="card">
      <h2>짐</h2>
      <div data-cart></div>
      <ul class="list">${cargo}</ul>
      ${others ? `<h3>다른 짐칸</h3><ul class="list">${others}</ul>` : ''}
    </section>
    <section class="card">
      <h2>신청</h2>
      <ul class="order-list">${orders}</ul>
    </section>
    ${
      people || v.upkeep.total
        ? `<section class="card">
            <header class="card-head"><h2>사람과 말</h2><span class="badge">하루 ${money(v.upkeep.total)}</span></header>
            <p class="muted">${v.upkeep.parts.map((x) => `${x.what} ${money(x.perDay)}`).join(' · ') || '유지비 없음'}</p>
            <ul class="list">${people}</ul>
          </section>`
        : ''
    }
    ${
      // 다른 마을에 처음 닿으면 열린다 (기획서 "견습 뒤에도 시스템은 하나씩 열린다")
      v.unlocks.includes('memory')
        ? `<section class="card">
            <h2>시세</h2>
            <p class="muted">다른 마을 시세는 마지막으로 본 날의 값이에요. 지금은 달라졌을 수 있어요.</p>
            ${known}
          </section>`
        : ''
    }
    <section class="card money-card">
      <img src="${coins}" alt="" />
      <div>
        <div class="muted">가진 돈</div>
        <div class="big-number">${money(v.gold)}</div>
        ${v.reserved ? `<div class="muted">신청에 맡긴 돈 ${money(v.reserved)}</div>` : ''}
        ${cargoValue !== null ? `<div class="muted">수레 짐을 아는 시세로 치면 ${money(cargoValue)}</div>` : ''}
        ${v.bank.deposit || v.bank.loan ? `<div class="muted">예금 ${money(v.bank.deposit)} · 대출 ${money(v.bank.loan)}</div>` : ''}
      </div>
    </section>
    <section class="card">
      <h2>돈 (손익)</h2>
      <ul class="list">${ledger}</ul>
    </section>`;

  mountCartBoard(el.querySelector<HTMLElement>('[data-cart]')!, game);

  el.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
    b.addEventListener('click', () => cancelOrder(Number(b.dataset.cancel))),
  );
}
