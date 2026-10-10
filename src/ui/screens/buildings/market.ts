// 시장 (0.1.6 목업 docs/reference/market-mockup-0.1.6.png): 오늘 시세 표, 큰 주문, 이번 장날 예약(이 마을에 낸 신청).
// 위 줄 아래를 덮는 페이지. 물품을 누르면 거래 예약 페이지가 위에 쌓인다.
import arrowDown from '../../../../assets/ui/arrow_down.png';
import arrowUp from '../../../../assets/ui/arrow_up.png';
import marketImg from '../../../../assets/ui/bld_market.png';
import sprigL from '../../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../../assets/ui/orn_sprig_r.png';
import hourglassImg from '../../../../assets/ui/icon_hourglass.png';
import chevronImg from '../../../../assets/ui/icon_chevron.png';
import infoImg from '../../../../assets/ui/icon_info.png';
import lettersImg from '../../../../assets/ui/ledger_letters.png';
import { count, GOODS, type GoodId } from '../../../sim/economy';
import { clockText, ERROR_TEXT, goodName } from '../../format';
import type { Game } from '../../game';
import { itemArt } from '../../itemArt';
import { openPage } from '../../page';
import { openOrderSheet } from '../orderSheet';
import { openCaravanSheet } from '../caravanSheet';

/** 장날까지 남은 시간 칩 (견습은 하루 보내기로 넘기니 없다). 페이지가 열린 동안 data-countdown을 고쳐 쓴다 */
export function countdownHtml(game: Game, apprentice: boolean): string {
  if (apprentice) return '';
  return `<span class="market-clock"><img src="${hourglassImg}" alt="" />장날까지 <b data-countdown>${clockText(game.msUntilMarket(Date.now()))}</b></span>`;
}

export function tickCountdown(el: HTMLElement, game: Game): () => void {
  const id = setInterval(() => {
    const t = clockText(game.msUntilMarket(Date.now()));
    el.querySelectorAll('[data-countdown]').forEach((s) => (s.textContent = t));
  }, 10_000);
  return () => clearInterval(id);
}

export function openMarket(game: Game): void {
  const v0 = game.view();
  if (!v0.market || v0.location.kind !== 'town') return;
  const town = v0.location.town;
  const page = openPage({ back: '마을', title: `${game.map.towns[town]!.name} 시장` });
  let error = '';

  const draw = () => {
    const v = game.view();
    const m = v.market;
    if (!m || v.location.kind !== 'town' || v.location.town !== town) {
      page.close();
      return;
    }
    const rows = GOODS.map((g) => {
      const have = count(v.haul, g);
      const prev = m.previous?.[g];
      const trend =
        prev === undefined || prev === m.price[g]
          ? ''
          : `<img class="market-trend" src="${m.price[g] > prev ? arrowUp : arrowDown}" alt="${m.price[g] > prev ? '오름' : '내림'}" />`;
      const art = itemArt(g);
      return `<li><button type="button" class="market-row" data-good="${g}">
          <span class="acct-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
          <span class="market-name">${goodName(g)}${have ? `<small>보유 ${have}개</small>` : ''}</span>
          <span class="market-price">${trend}${m.price[g]}냥</span>
          <img class="town-chevron" src="${chevronImg}" alt="" />
        </button></li>`;
    }).join('');

    const mine = v.orders.filter((o) => o.town === town);
    const orders = mine.length
      ? `<ul class="market-orders">${mine
          .map((o) => {
            const art = itemArt(o.good);
            return `<li>
              <span class="acct-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
              <span class="market-name">${goodName(o.good)} ${o.qty}개${o.from === 'store' ? ' (창고)' : ''}<small>개당 ${o.limit}냥 ${o.side === 'sell' ? '이상' : '이하'}</small></span>
              <span class="order-chip ${o.side}">${o.side === 'sell' ? '판매' : '구매'}</span>
              <button type="button" class="order-btn" data-cancel="${o.id}">취소</button>
            </li>`;
          })
          .join('')}</ul>`
      : `<div class="market-empty"><img src="${lettersImg}" alt="" /><p>아직 예약한 거래가 없어요.</p></div>`;

    // 큰 주문 (0.0.7): 사건이 기간 동안 한 물품을 많이 비싸게 사들인다
    // 두 번째 행렬이 있으면 이 주문에 행렬을 보낸다 (0.0.8: 한 번 가서 팔기를 채워 연다)
    const canSend = v.caravan?.carter != null;
    const big = v.bigOrders
      .map(
        (o) => `<li><span class="market-name">${o.event} · ${goodName(o.good)} ${o.left}개 남음<small>${o.price}냥 이하로 내면 팔려요 · ${o.until - v.day + 1}일 남음</small></span>${
          canSend ? `<button type="button" class="order-btn edit" data-send-caravan="${o.good}" data-price="${Math.max(1, Math.round(o.price * 0.9))}">행렬 보내기</button>` : ''
        }</li>`,
      )
      .join('');

    page.body.innerHTML = `
      <section class="market-hero">
        <img src="${marketImg}" alt="" />
        <div>
          <div class="market-title"><img class="town-sprig" src="${sprigL}" alt="" /><h3>오늘의 시장</h3><img class="town-sprig" src="${sprigR}" alt="" /></div>
          ${countdownHtml(game, v.apprentice !== null)}
          <small>예약한 거래는 장날에 한꺼번에 체결돼요.</small>
        </div>
      </section>
      ${big ? `<section class="market-card"><h4 class="acct-day">큰 주문</h4><ul class="market-orders">${big}</ul></section>` : ''}
      <section class="market-card">
        <div class="price-table-head"><span>물품</span><span>오늘 시세</span></div>
        <ul class="market-goods">${rows}</ul>
      </section>
      <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />물품을 눌러 구매·판매를 예약하세요.</p>
      <section class="market-card">
        <h4 class="acct-day">이번 장날 예약</h4>
        ${orders}
      </section>
      ${error ? `<p class="error">${error}</p>` : ''}`;

    page.body.querySelectorAll<HTMLButtonElement>('[data-good]').forEach((b) =>
      b.addEventListener('click', () => openOrderSheet(game, b.dataset.good as GoodId)),
    );
    page.body.querySelectorAll<HTMLButtonElement>('[data-send-caravan]').forEach((b) =>
      b.addEventListener('click', () => openCaravanSheet(game, { town, good: b.dataset.sendCaravan as GoodId, minPrice: Number(b.dataset.price) })),
    );
    page.body.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = game.dispatch({ type: 'cancelOrder', orderId: Number(b.dataset.cancel) });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        if (!r.ok) draw();
      }),
    );
  };

  const unsub = game.subscribe(() => {
    error = '';
    draw();
  });
  page.onClose(unsub);
  page.onClose(tickCountdown(page.el, game));
  draw();
}
