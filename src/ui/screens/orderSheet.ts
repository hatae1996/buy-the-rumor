// 판매(구매) 신청 쪽지: 몇 개를, 얼마 이상(이하)으로. 장날에 정산된다.
// 예약 주문이 열리면 "며칠 동안"을 고를 수 있다: 마감 날까지 날마다 이 마을 장날에 다시 들어간다 (0.1.0).
import { ECONOMY } from '../../sim/constants';
import { count, sellableCount, type GoodId } from '../../sim/economy';
import { eulReul, numEuro } from '../../sim/josa';
import { ERROR_TEXT, goodName, marketMood, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';

export function openOrderSheet(game: Game, good: GoodId): void {
  const v = game.view();
  const m = v.market;
  if (!m) return;
  // 내일이면 상할 묶음은 장에 낼 수 없다. 짐꾼 수레 짐도 낸다
  const have = sellableCount(v.haul, good, ECONOMY.spoilRate[v.season]);
  const spoiling = count(v.haul, good) - have;
  // 살 물건이 수레(짐꾼 수레 포함)에 몇 개 더 들어가나 (신청하면 그 자리를 미리 잡는다)
  const room = v.buyRoom[good];
  const porters = v.hires.some((h) => h.board);

  // 예약: 이 마을 창고 짐도 팔 수 있고, 산 것은 창고로(없으면 와 있는 수레로) 받는다
  const canReserve = v.unlocks.includes('reservation');
  const store = v.warehouses.find((w) => w.town === m.town);
  const stored = store ? store.pieces.filter((p) => p.good === good).reduce((s, p) => s + p.qty, 0) : 0;
  let days = 1;
  const maxDays = Math.max(1, (v.seasonInfo ? v.seasonInfo.length - v.seasonInfo.day : 0) + 1);

  let side: 'sell' | 'buy' = have > 0 ? 'sell' : 'buy';
  let qty = side === 'sell' ? have : Math.min(1, room);
  let price = defaultPrice(side);
  let error = '';

  function defaultPrice(s: 'sell' | 'buy'): number {
    // 팔 때는 시세보다 조금 낮게, 살 때는 조금 높게 불러야 장날에 맞춰질 가능성이 크다
    return Math.max(1, Math.round(m!.price[good] * (s === 'sell' ? 0.9 : 1.1)));
  }
  const maxQty = () => {
    if (days > 1) return side === 'sell' ? have + stored : 99;
    return side === 'sell' ? have : Math.min(room, Math.floor(v.gold / Math.max(1, price)));
  };

  const canEditPrice = v.unlocks.includes('editPrice');
  const sheet = openSheet(`${goodName(good)} 신청`);
  const render = () => {
    qty = Math.max(0, Math.min(qty, maxQty()));
    const y = m.yesterday[good];
    const yText = y.price !== null ? `어제 장날에는 ${y.price}에 맞춰졌어요.` : '어제 장날에는 맞춰진 거래가 없었어요.';
    const total = qty * price;
    sheet.body.innerHTML = `
      <div class="seg" role="group" aria-label="팔기 또는 사기">
        <button type="button" data-side="sell" aria-pressed="${side === 'sell'}" ${have || (days > 1 && stored) ? '' : 'disabled'}>팔기</button>
        <button type="button" data-side="buy" aria-pressed="${side === 'buy'}">사기</button>
      </div>
      <div class="price-note">
        <div>오늘 시세 <b>${m.price[good]}</b> · 낼 수 있는 짐 ${have}개</div>
        ${spoiling ? `<div class="warn">곧 상할 ${spoiling}개는 장에 낼 수 없어요.</div>` : ''}
        ${side === 'buy' ? `<div class="muted">${porters ? '내 수레와 짐꾼 수레에' : '수레에'} ${room}개 더 들어가요. 신청하면 그 자리를 미리 잡아 둬요.</div>` : ''}
        <div class="muted">${yText} ${marketMood(y.demand, y.supply)}</div>
      </div>
      <div class="stepper-row">
        <span class="stepper-label">몇 개</span>
        <div class="stepper">
          <button type="button" data-q="-10">−10</button><button type="button" data-q="-1">−1</button>
          <output>${qty}</output>
          <button type="button" data-q="1">+1</button><button type="button" data-q="10">+10</button>
        </div>
      </div>
      ${
        // 처음엔 추천 값으로 탭 한 번에. 첫 장날에 안 팔린 뒤로 값을 직접 고칠 수 있다
        canEditPrice
          ? `<div class="stepper-row">
              <span class="stepper-label">${side === 'sell' ? '개당 이 값보다 싸게는 안 팔아요' : '개당 이 값보다 비싸게는 안 사요'}</span>
              <div class="stepper">
                <button type="button" data-p="-5">−5</button><button type="button" data-p="-1">−1</button>
                <output>${price}</output>
                <button type="button" data-p="1">+1</button><button type="button" data-p="5">+5</button>
              </div>
            </div>`
          : `<p class="muted">추천 값 <b>${numEuro(price)}</b> ${side === 'sell' ? '팔아요' : '사요'}.</p>`
      }
      ${
        canReserve
          ? `<div class="stepper-row">
              <span class="stepper-label">${days === 1 ? '오늘 장날만' : `${days}일 동안 날마다 (예약, ${v.day + days - 1}일째까지)`}</span>
              <div class="stepper">
                <button type="button" data-d="-1">−1</button>
                <output>${days}일</output>
                <button type="button" data-d="1">+1</button>
              </div>
            </div>`
          : ''
      }
      <p class="order-summary">${
        days > 1
          ? side === 'sell'
            ? `다 팔릴 때까지 날마다 이 마을 장날에 내요. 짐은 이 마을 창고${stored ? `(${stored}개)` : ''}에서, 모자라면 여기 와 있는 수레에서 내요. 짐이 없는 날은 건너뛰어요.`
            : `다 살 때까지 날마다 이 마을 장날에 사요. 그날 가진 돈만큼만 맡기고, 산 것은 ${store ? '이 마을 창고로' : '여기 와 있는 수레로 (떠나 있으면 건너뛰어요)'} 받아요.`
          : side === 'sell'
          ? `다 팔리면 적어도 <b>${money(total)}</b> 받아요. 장날 값이 더 높으면 더 받아요.`
          : `<b>${money(total)}</b> 맡겨 둬요. 장날 값이 더 낮거나 다 못 사면 남은 돈은 돌려받아요.`
      }</p>
      <p class="muted">장날에는 모든 신청을 한꺼번에 맞춰 물건마다 값 하나로 정해요. 먼저 낸다고 유리하지 않아요.</p>
      ${error ? `<p class="error">${error}</p>` : ''}
      <button type="button" class="primary-btn" data-submit ${qty > 0 ? '' : 'disabled'}>
        ${days > 1 ? '예약으로 넣기' : side === 'sell' ? `${eulReul(`${goodName(good)} ${qty}개`)} 팔게요` : `${eulReul(`${goodName(good)} ${qty}개`)} 살게요`}
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
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        days = Math.max(1, Math.min(maxDays, days + Number(b.dataset.d)));
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
        days > 1
          ? game.dispatch({ type: 'reserveOrder', town: m.town, good, side, qty, limit: price, until: v.day + days - 1 })
          : side === 'sell'
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
