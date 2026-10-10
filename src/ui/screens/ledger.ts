// 장부 탭 (기획서 "화면 구성", 0.1.2 → 0.1.6 목업): 작은 탭 4개. 거래 예약(장날 신청·예약 주문) / 수입·지출(돈 내역과 손익) / 시세 기록 / 인력·말.
// 짐은 짐칸 탭으로 옮겼다. "돈과 약속은 어떻게 됐나". 크림 바탕에 장부 책 제목.
import bookImg from '../../../assets/ui/tab_ledger.png';
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import type { PlayerView } from '../../sim/economy';
import { money } from '../format';
import type { Game } from '../game';
import { horseFatigue, speedWord } from './horseSheet';
import { bindOrderGroups, ordersHtml } from './ledgerOrders';
import { accountsHtml, bindAccounts } from './ledgerAccounts';
import { bindPrices, pricesHtml } from './ledgerPrices';

export type LedgerSection = 'orders' | 'accounts' | 'prices' | 'people';

const SECTIONS: { id: LedgerSection; label: string }[] = [
  { id: 'orders', label: '거래 예약' },
  { id: 'accounts', label: '수입·지출' },
  { id: 'prices', label: '시세 기록' },
  { id: 'people', label: '인력·말' },
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

export function renderLedger(el: HTMLElement, game: Game, v: PlayerView): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  // 시세는 다른 마을에 처음 닿으면 열린다 (기획서 "견습 뒤에도 시스템은 하나씩 열린다")
  const open = SECTIONS.filter((s) => s.id !== 'prices' || v.unlocks.includes('memory'));
  if (!open.some((s) => s.id === section)) section = 'orders';

  // 사람과 말: 하루 유지비 합계가 맨 위
  const people = [
    ...v.hires.map((h) => `<li class="row"><span>${h.roleName} ${h.name} <small class="muted">${h.jobName} · ${townName(h.town)}</small></span><b>${money(h.wage)}/일${h.restWage !== null ? ` <small class="muted">쉬는 날 ${money(h.restWage)}</small>` : ''}</b></li>`),
    ...v.informants.map((t) => `<li class="row"><span>정보원 <small class="muted">${townName(t)}</small></span></li>`),
    ...v.horses.map((h) => `<li><b>${h.name}</b> <small class="muted">내 행렬 · 끄는 무게 ${h.pulling} · ${speedWord(h.speed)}</small>${horseFatigue(h)}</li>`),
    ...(v.caravan?.horses ?? []).map((h) => `<li><b>${h.name}</b> <small class="muted">두 번째 행렬</small>${horseFatigue(h)}</li>`),
  ].join('');

  const bodies: Record<LedgerSection, string> = {
    orders: ordersHtml(game, v),
    accounts: accountsHtml(game, v),
    prices: pricesHtml(game, v),
    people: `
      <section class="card">
        <header class="card-head"><h2>사람과 말</h2><span class="badge">하루 ${money(v.upkeep.total)}</span></header>
        <p class="muted">${v.upkeep.parts.map((x) => `${x.what} ${money(x.perDay)}`).join(' · ') || '유지비 없음'}</p>
        <ul class="list">${people || '<li class="muted">아직 함께하는 일꾼도 말도 없어요.</li>'}</ul>
      </section>`,
  };

  el.innerHTML = `
    <header class="ledger-head">
      <img class="town-sprig" src="${sprigL}" alt="" />
      <img class="ledger-book" src="${bookImg}" alt="" />
      <div><h2>장부</h2><small>상인의 기록</small></div>
      <img class="town-sprig" src="${sprigR}" alt="" />
    </header>
    <div class="seg ledger-tabs" role="tablist" aria-label="장부">
      ${open.map((s) => `<button type="button" role="tab" data-section="${s.id}" aria-pressed="${s.id === section}" aria-selected="${s.id === section}">${s.label}</button>`).join('')}
    </div>
    ${bodies[section]}`;

  el.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((b) =>
    b.addEventListener('click', () => {
      showLedgerSection(b.dataset.section as LedgerSection);
      renderLedger(el, game, v);
    }),
  );
  if (section === 'orders') bindOrderGroups(el, game, v);
  if (section === 'accounts') bindAccounts(el, () => renderLedger(el, game, v));
  if (section === 'prices') bindPrices(el, game, v, () => renderLedger(el, game, v));
}
