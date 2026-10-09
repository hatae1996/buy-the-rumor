// 장부 탭 (기획서 "화면 구성", 0.1.2): 작은 탭 4개. 신청(장날·예약) / 가계부(돈 내역과 손익) / 시세 / 사람과 말.
// 짐은 짐칸 탭으로 옮겼다. "돈과 약속은 어떻게 됐나".
import coins from '../../../assets/ui/coins.png';
import { GOODS, type PlayerView } from '../../sim/economy';
import { agoText, goodName, ledgerLine, money } from '../format';
import type { Game } from '../game';
import { horseFatigue, speedWord } from './horseSheet';

export type LedgerSection = 'orders' | 'accounts' | 'prices' | 'people';

const SECTIONS: { id: LedgerSection; label: string }[] = [
  { id: 'orders', label: '신청' },
  { id: 'accounts', label: '가계부' },
  { id: 'prices', label: '시세' },
  { id: 'people', label: '사람과 말' },
];

const SECTION_KEY = 'buy-the-rumor/ledger-section';
let section: LedgerSection = loadSection();

function loadSection(): LedgerSection {
  try {
    const s = localStorage.getItem(SECTION_KEY);
    return SECTIONS.some((x) => x.id === s) ? (s as LedgerSection) : 'orders';
  } catch {
    return 'orders';
  }
}

/** 알림을 눌러 들어올 때 그 작은 탭을 연다 */
export function showLedgerSection(id: LedgerSection): void {
  section = id;
  try {
    localStorage.setItem(SECTION_KEY, id);
  } catch {
    // 저장하지 못해도 이번에는 그 탭을 연다
  }
}

export function renderLedger(el: HTMLElement, game: Game, v: PlayerView, cancelOrder: (id: number) => void): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  // 시세는 다른 마을에 처음 닿으면 열린다 (기획서 "견습 뒤에도 시스템은 하나씩 열린다")
  const open = SECTIONS.filter((s) => s.id !== 'prices' || v.unlocks.includes('memory'));
  if (!open.some((s) => s.id === section)) section = 'orders';

  // 아는 시세로 짐 값을 어림한다 (지금 마을 시세, 길 위면 떠난 마을에서 마지막으로 본 시세)
  const prices = v.market?.price ?? v.memory[v.location.kind === 'road' ? v.location.from : v.location.town]?.prices;
  const cargoValue = prices ? v.cargo.reduce((s, l) => s + l.qty * prices[l.good], 0) : null;

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

  // 예약 주문: 마감 날까지 날마다 그 마을 장날에 들어가는 신청, 도착하면 팔기
  const reservations = v.reservations
    .map((r) => {
      const what =
        r.kind === 'standing'
          ? `${townName(r.town)} · ${goodName(r.good)} ${r.qty}개 남음 · ${r.side === 'sell' ? `${r.limit} 이상` : `${r.limit} 이하`} · ${r.until}일째까지`
          : `${townName(r.town)}에 도착하면 · ${goodName(r.good)} ${r.qty === 'all' ? '전부' : `${r.qty}개`} · ${r.minPrice} 이상`;
      const side = r.kind === 'standing' ? r.side : 'sell';
      return `<li class="order-row">
          <span class="order-side ${side}">예약 ${side === 'sell' ? '팔기' : '사기'}</span>
          <span>${what}</span>
          <button type="button" class="link-btn" data-unreserve="${r.id}">지우기</button>
        </li>`;
    })
    .join('');

  // 사람과 말: 하루 유지비 합계가 맨 위
  const people = [
    ...v.hires.map((h) => `<li class="row"><span>${h.roleName} ${h.name} <small class="muted">${h.jobName} · ${townName(h.town)}</small></span><b>${money(h.wage)}/일${h.restWage !== null ? ` <small class="muted">쉬는 날 ${money(h.restWage)}</small>` : ''}</b></li>`),
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

  const bodies: Record<LedgerSection, string> = {
    orders: `
      <section class="card">
        <h2>장날 신청</h2>
        <ul class="order-list">${orders}</ul>
      </section>
      ${
        reservations
          ? `<section class="card">
              <h2>예약 주문</h2>
              <p class="muted">마감 날까지 날마다 그 마을 장날에 다시 들어가요. 체결되면 알려 드려요.</p>
              <ul class="order-list">${reservations}</ul>
            </section>`
          : ''
      }`,
    accounts: `
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
        <h2>들어오고 나간 돈</h2>
        <ul class="list">${ledger}</ul>
      </section>`,
    prices: `
      <section class="card">
        <h2>내가 아는 시세</h2>
        <p class="muted">다른 마을 시세는 마지막으로 본 날의 값이에요. 지금은 달라졌을 수 있어요.</p>
        ${known}
      </section>`,
    people: `
      <section class="card">
        <header class="card-head"><h2>사람과 말</h2><span class="badge">하루 ${money(v.upkeep.total)}</span></header>
        <p class="muted">${v.upkeep.parts.map((x) => `${x.what} ${money(x.perDay)}`).join(' · ') || '유지비 없음'}</p>
        <ul class="list">${people || '<li class="muted">아직 함께하는 일꾼도 말도 없어요.</li>'}</ul>
      </section>`,
  };

  el.innerHTML = `
    <div class="seg ledger-tabs" role="tablist" aria-label="장부">
      ${open.map((s) => `<button type="button" role="tab" data-section="${s.id}" aria-pressed="${s.id === section}" aria-selected="${s.id === section}">${s.label}</button>`).join('')}
    </div>
    ${bodies[section]}`;

  el.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((b) =>
    b.addEventListener('click', () => {
      showLedgerSection(b.dataset.section as LedgerSection);
      renderLedger(el, game, v, cancelOrder);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
    b.addEventListener('click', () => cancelOrder(Number(b.dataset.cancel))),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-unreserve]').forEach((b) =>
    b.addEventListener('click', () => game.dispatch({ type: 'cancelReservation', reservationId: Number(b.dataset.unreserve) })),
  );
}
