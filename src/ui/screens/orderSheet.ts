// 판매(구매) 신청 쪽지: 몇 개를, 얼마 이상(이하)으로. 장날에 정산된다.
import { count, type GoodId } from '../../sim/economy';
import { eulReul } from '../../sim/josa';
import { ERROR_TEXT, goodName, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';

export function openOrderSheet(game: Game, good: GoodId): void {
  const v = game.view();
  const m = v.market;
  if (!m) return;
  const have = count(v.cargo, good);
  const pendingBuys = v.orders.filter((o) => o.side === 'buy').reduce((s, o) => s + o.qty, 0);
  const room = Math.max(0, v.capacity - v.cargoCount - pendingBuys);

  let side: 'sell' | 'buy' = have > 0 ? 'sell' : 'buy';
  let qty = side === 'sell' ? have : Math.min(1, room);
  let price = defaultPrice(side);
  let error = '';

  function defaultPrice(s: 'sell' | 'buy'): number {
    // 팔 때는 시세보다 조금 낮게, 살 때는 조금 높게 불러야 장날에 맞춰질 가능성이 크다
    return Math.max(1, Math.round(m!.price[good] * (s === 'sell' ? 0.9 : 1.1)));
  }
  const maxQty = () => (side === 'sell' ? have : Math.min(room, Math.floor(v.gold / Math.max(1, price))));

  const sheet = openSheet(`${goodName(good)} 신청`);
  const render = () => {
    qty = Math.max(0, Math.min(qty, maxQty()));
    const y = m.yesterday[good];
    const yText = y.price !== null ? `어제 장날에 ${y.volume}개가 ${y.price}에 거래됐어요.` : '어제 장날에는 거래가 없었어요.';
    const total = qty * price;
    sheet.body.innerHTML = `
      <div class="seg" role="group" aria-label="팔기 또는 사기">
        <button type="button" data-side="sell" aria-pressed="${side === 'sell'}" ${have ? '' : 'disabled'}>팔기</button>
        <button type="button" data-side="buy" aria-pressed="${side === 'buy'}">사기</button>
      </div>
      <div class="price-note">
        <div>오늘 시세 <b>${m.price[good]}</b> · 내 짐 ${have}개</div>
        <div class="muted">${yText} 사려는 양 ${y.demand}개, 팔려는 양 ${y.supply}개.</div>
      </div>
      <div class="stepper-row">
        <span class="stepper-label">몇 개</span>
        <div class="stepper">
          <button type="button" data-q="-10">−10</button><button type="button" data-q="-1">−1</button>
          <output>${qty}</output>
          <button type="button" data-q="1">+1</button><button type="button" data-q="10">+10</button>
        </div>
      </div>
      <div class="stepper-row">
        <span class="stepper-label">${side === 'sell' ? '개당 이 값보다 싸게는 안 팔아요' : '개당 이 값보다 비싸게는 안 사요'}</span>
        <div class="stepper">
          <button type="button" data-p="-5">−5</button><button type="button" data-p="-1">−1</button>
          <output>${price}</output>
          <button type="button" data-p="1">+1</button><button type="button" data-p="5">+5</button>
        </div>
      </div>
      <p class="order-summary">${
        side === 'sell'
          ? `다 팔리면 적어도 <b>${money(total)}</b> 받아요. 장날 값이 더 높으면 더 받아요.`
          : `<b>${money(total)}</b> 맡겨 둬요. 장날 값이 더 낮거나 다 못 사면 남은 돈은 돌려받아요.`
      }</p>
      <p class="muted">장날에는 모든 신청을 한꺼번에 맞춰 물건마다 값 하나로 정해요. 먼저 낸다고 유리하지 않아요.</p>
      ${error ? `<p class="error">${error}</p>` : ''}
      <button type="button" class="primary-btn" data-submit ${qty > 0 ? '' : 'disabled'}>
        ${side === 'sell' ? `${eulReul(`${goodName(good)} ${qty}개`)} 팔게요` : `${eulReul(`${goodName(good)} ${qty}개`)} 살게요`}
      </button>`;

    sheet.body.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
      b.addEventListener('click', () => {
        side = b.dataset.side as 'sell' | 'buy';
        price = defaultPrice(side);
        qty = side === 'sell' ? have : Math.min(1, room);
        error = '';
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) =>
      b.addEventListener('click', () => {
        qty += Number(b.dataset.q);
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        price = Math.max(1, price + Number(b.dataset.p));
        render();
      }),
    );
    sheet.body.querySelector('[data-submit]')!.addEventListener('click', () => {
      const r =
        side === 'sell'
          ? game.dispatch({ type: 'placeSellOrder', good, qty, minPrice: price })
          : game.dispatch({ type: 'placeBuyOrder', good, qty, maxPrice: price });
      if (r.ok) sheet.close();
      else {
        error = ERROR_TEXT[r.error];
        render();
      }
    });
  };
  render();
}
