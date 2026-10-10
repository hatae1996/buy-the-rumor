// 장부 탭 "수입·지출" (0.1.6 목업 docs/reference/ledger-accounts-mockup-0.1.6.png).
// 보유금과 짐의 추정 가치, 누적 수입·지출, 날과 마을로 묶은 입출금 내역(최신순·오래된순).
import infoImg from '../../../assets/ui/icon_info.png';
import purseImg from '../../../assets/ui/money_purse.png';
import crateImg from '../../../assets/ui/cargo_crate.png';
import incomeImg from '../../../assets/ui/coins_stack.png';
import spendImg from '../../../assets/ui/coins_sack.png';
import wagonImg from '../../../assets/ui/travel_wagon.png';
import type { LedgerEntry, PlayerView } from '../../sim/economy';
import { ECONOMY } from '../../sim/constants';
import { goodName, ledgerLine, money } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';

/** 내역에 보이는 줄 수 (오래된 것은 줄인다) */
const SHOWN = 40;

let newestFirst = true;

const won = (n: number) => `${money(n)}냥`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${won(Math.abs(n))}`;

/** 내역 한 줄: 그림, 제목, 자세히, 돈. 사고팔기와 식량, 장비, 길은 짧게, 나머지는 장부 문장 그대로 */
function rowOf(e: LedgerEntry, townName: (id: number) => string): { art: string | null; title: string; detail: string; amount: number | null } {
  const { text, amount } = ledgerLine(e, townName);
  const fallback = amount === null ? null : amount >= 0 ? incomeImg : spendImg;
  switch (e.kind) {
    case 'buy':
    case 'sell': {
      const how = [e.reserved ? '예약 주문' : '', e.by === 'store' ? '창고 짐' : e.by === 'caravan' ? '두 번째 행렬' : ''].filter(Boolean).join(' · ');
      return {
        art: itemArt(e.good),
        title: `${goodName(e.good)} ${e.kind === 'sell' ? '판매' : '구매'}`,
        detail: `${e.qty}개 × ${won(e.price)}${how ? ` · ${how}` : ''}`,
        amount,
      };
    }
    case 'rations':
      return { art: itemArt('rations'), title: '여행 식량 구매', detail: `${e.qty}개 × ${won(e.price)}`, amount };
    case 'travel':
      return { art: wagonImg, title: `${townName(e.to)} 출발`, detail: `${e.days}일 길 · 여비`, amount };
    case 'gear':
      return e.what === 'buy'
        ? { art: itemArt(e.gear), title: `${ECONOMY.expedition.gear[e.gear].name} 구매`, detail: '잡화점', amount }
        : { art: itemArt(e.gear), title: `${ECONOMY.expedition.gear[e.gear].name} 수리`, detail: '도구 하나', amount };
    default:
      return { art: fallback, title: text, detail: '', amount };
  }
}

/** 그 줄이 일어난 마을 (길 위면 null) */
function townOf(e: LedgerEntry): number | null {
  if (e.kind === 'travel') return e.from;
  return 'town' in e && typeof e.town === 'number' ? e.town : null;
}

export function accountsHtml(game: Game, v: PlayerView): string {
  const townName = (id: number) => game.map.towns[id]!.name;
  // 아는 시세로 짐 값을 어림한다 (지금 마을 시세, 길 위면 떠난 마을에서 마지막으로 본 시세)
  const prices = v.market?.price ?? v.memory[v.location.kind === 'road' ? v.location.from : v.location.town]?.prices;
  const cargoValue = prices ? v.cargo.reduce((s, l) => s + l.qty * prices[l.good], 0) : null;

  let income = 0;
  let spend = 0;
  for (const e of v.ledger) {
    const { amount } = ledgerLine(e, townName);
    if (amount === null) continue;
    if (amount >= 0) income += amount;
    else spend -= amount;
  }

  const extra = [
    v.reserved ? `신청에 맡긴 돈 ${won(v.reserved)}` : '',
    v.bank.deposit || v.bank.loan ? `예금 ${won(v.bank.deposit)} · 대출 ${won(v.bank.loan)}` : '',
  ].filter(Boolean);

  // 내역: 날과 마을이 같은 줄끼리 묶는다
  const recent = v.ledger.slice(-SHOWN);
  const entries = newestFirst ? [...recent].reverse() : recent;
  const blocks: { head: string; rows: string[] }[] = [];
  for (const e of entries) {
    const t = townOf(e);
    const head = `${e.day}일째 · ${t === null ? '길 위' : townName(t)}`;
    const r = rowOf(e, townName);
    const amt = r.amount === null ? '' : `<b class="${r.amount >= 0 ? 'plus' : 'minus'}">${signed(r.amount)}</b>`;
    const row = `<li>
        <span class="acct-pic">${r.art ? `<img src="${r.art}" alt="" />` : ''}</span>
        <span class="acct-text"><span class="acct-title">${r.title}</span>${r.detail ? `<small>${r.detail}</small>` : ''}</span>
        ${amt}
      </li>`;
    const last = blocks[blocks.length - 1];
    if (last && last.head === head) last.rows.push(row);
    else blocks.push({ head, rows: [row] });
  }

  return `
    <section class="acct-summary">
      <div class="acct-gold">
        <img src="${purseImg}" alt="" />
        <div>
          <span class="acct-label">보유금</span>
          <span class="acct-big">${won(v.gold)}</span>
          ${extra.map((x) => `<small>${x}</small>`).join('')}
        </div>
      </div>
      <div class="acct-cargo">
        <img src="${crateImg}" alt="" />
        <span><span class="acct-label">짐의 추정 가치</span><small>${cargoValue === null ? '시세를 몰라 어림하지 못해요' : '마지막으로 확인한 시세 기준'}</small></span>
        <b>${cargoValue === null ? '—' : won(cargoValue)}</b>
      </div>
    </section>
    <div class="acct-totals">
      <section class="acct-total in"><img src="${incomeImg}" alt="" /><span><span class="acct-label">누적 수입</span><b>${signed(income)}</b></span></section>
      <section class="acct-total out"><img src="${spendImg}" alt="" /><span><span class="acct-label">누적 지출</span><b>${signed(-spend)}</b></span></section>
    </div>
    <div class="acct-list-head">
      <h3 class="ledger-section-title">입출금 내역</h3>
      <button type="button" class="acct-order" data-acct-order aria-label="내역 차례 바꾸기">${newestFirst ? '최신순' : '오래된순'} <span aria-hidden="true">⌄</span></button>
    </div>
    ${
      blocks.length
        ? `<section class="acct-list">${blocks
            .map((b) => `<h4 class="acct-day">${b.head}</h4><ul>${b.rows.join('')}</ul>`)
            .join('')}</section>`
        : '<p class="ledger-note">아직 적힌 게 없어요. 마을에서 물건을 사고팔아 보세요.</p>'
    }
    <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />물품을 얻은 것(원정, 채집)은 수입에 들어가지 않아요.</p>`;
}

export function bindAccounts(el: HTMLElement, rerender: () => void): void {
  el.querySelector('[data-acct-order]')?.addEventListener('click', () => {
    newestFirst = !newestFirst;
    rerender();
  });
}
