// 장부 탭 "거래 예약" (0.1.6 목업 docs/reference/ledger-orders-mockup-0.1.6.png).
// 장날 신청과 예약 주문을 마을과 때(다음 장날, 마감 날까지, 도착 후 첫 장날)로 묶어 카드 하나씩.
// 카드마다 물품 그림과 개수, 팔기·사기 칩, 예약 수정(그 자리에서 고칠 수 있을 때만)과 예약 취소.
import lettersImg from '../../../assets/ui/ledger_letters.png';
import houseHere from '../../../assets/ui/house_red.png';
import houseThere from '../../../assets/ui/house_blue.png';
import type { GoodId, PlayerView } from '../../sim/economy';
import { goodName } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openArrivalSheet } from './arrivalSheet';
import { openMarket } from './buildings/market';

interface OrderGroup {
  town: number;
  /** 언제 장에 들어가나 */
  when: string;
  side: 'sell' | 'buy';
  items: { good: GoodId; qty: string; cond: string }[];
  orders: number[];
  reservations: number[];
  /** 고치는 곳: 그 마을 시장(그 마을에 있을 때), 도착하면 팔기 쪽지(그 마을로 가는 길일 때) */
  edit: 'market' | 'arrival' | null;
}

function groupsOf(v: PlayerView): OrderGroup[] {
  const here = v.location.kind === 'town' ? v.location.town : null;
  const goingTo = v.location.kind === 'road' ? v.location.to : null;
  const groups = new Map<string, OrderGroup>();
  const group = (key: string, make: () => Omit<OrderGroup, 'items' | 'orders' | 'reservations'>) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { ...make(), items: [], orders: [], reservations: [] }));
    return g;
  };
  const cond = (side: 'sell' | 'buy', limit: number) => `개당 ${limit}냥 ${side === 'sell' ? '이상' : '이하'}`;

  for (const r of v.reservations) {
    if (r.kind !== 'onArrival') continue;
    const g = group(`a:${r.town}`, () => ({ town: r.town, when: '도착 후 첫 장날', side: 'sell', edit: goingTo === r.town ? 'arrival' : null }));
    g.items.push({ good: r.good, qty: r.qty === 'all' ? '전부' : `${r.qty}개`, cond: cond('sell', r.minPrice) });
    g.reservations.push(r.id);
  }
  for (const o of v.orders) {
    const g = group(`o:${o.town}:${o.side}`, () => ({ town: o.town, when: '다음 장날', side: o.side, edit: here === o.town ? 'market' : null }));
    g.items.push({ good: o.good, qty: `${o.qty}개`, cond: `${cond(o.side, o.limit)}${o.from === 'store' ? ' · 창고' : ''}` });
    g.orders.push(o.id);
  }
  for (const r of v.reservations) {
    if (r.kind !== 'standing') continue;
    const g = group(`s:${r.town}:${r.side}:${r.until}`, () => ({
      town: r.town,
      when: `${r.until}일째까지 장날마다`,
      side: r.side,
      edit: here === r.town ? 'market' : null,
    }));
    g.items.push({ good: r.good, qty: `${r.qty}개 남음`, cond: cond(r.side, r.limit) });
    g.reservations.push(r.id);
  }
  return [...groups.values()];
}

/** 거래 예약 화면 (요약 카드, 진행 중 카드들, 안내). 단추는 bindOrderGroups로 묶는다 */
export function ordersHtml(game: Game, v: PlayerView): string {
  const groups = groupsOf(v);
  const here = v.location.kind === 'town' ? v.location.town : null;
  const buys = groups.some((g) => g.side === 'buy');
  const summary = `<section class="ledger-summary">
      <img src="${lettersImg}" alt="" />
      <div>
        <span class="ledger-summary-label">예약한 거래</span>
        <span class="ledger-summary-count">${groups.length}건</span>
        <small>${
          groups.length ? (buys ? '장날에 사고팔 물건을 확인하세요.' : '장날에 판매할 물건을 확인하세요.') : '시장에서 팔기·사기를 신청하면 여기에 모여요.'
        }</small>
      </div>
    </section>`;
  const cards = groups
    .map(
      (g, i) => `<section class="order-group">
        <header class="order-group-head">
          <img src="${g.town === here ? houseHere : houseThere}" alt="" />
          <div><h3>${game.map.towns[g.town]!.name}</h3><small>${g.when}</small></div>
          <span class="order-chip ${g.side}">${g.side === 'sell' ? '판매 대기' : '구매 대기'}</span>
        </header>
        <ul class="order-items">${g.items
          .map((it) => {
            const art = itemArt(it.good);
            return `<li>
              <span class="order-item-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
              <span class="order-item-name">${goodName(it.good)}<small>${it.cond}</small></span>
              <b>${it.qty}</b>
            </li>`;
          })
          .join('')}</ul>
        <div class="order-group-btns">
          ${g.edit ? `<button type="button" class="order-btn edit" data-group-edit="${g.edit}">예약 수정</button>` : ''}
          <button type="button" class="order-btn" data-group-cancel="${i}">예약 취소</button>
        </div>
      </section>`,
    )
    .join('');
  return `${summary}
    ${groups.length ? `<h3 class="ledger-section-title">진행 중</h3>${cards}` : ''}
    <p class="ledger-note"><span class="ledger-note-i" aria-hidden="true">i</span>예약은 판매 완료가 아니에요.<br />판매 결과는 수입·지출에서 확인하세요.</p>`;
}

export function bindOrderGroups(el: HTMLElement, game: Game, v: PlayerView): void {
  const groups = groupsOf(v);
  el.querySelectorAll<HTMLButtonElement>('[data-group-edit]').forEach((b) =>
    b.addEventListener('click', () => (b.dataset.groupEdit === 'arrival' ? openArrivalSheet(game) : openMarket(game))),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-group-cancel]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = groups[Number(b.dataset.groupCancel)];
      if (!g) return;
      for (const id of g.orders) game.dispatch({ type: 'cancelOrder', orderId: id });
      for (const id of g.reservations) game.dispatch({ type: 'cancelReservation', reservationId: id });
    }),
  );
}
