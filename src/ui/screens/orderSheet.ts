// 거래 예약 페이지 (0.1.6 목업 docs/reference/order-buy-mockup-0.1.6.png, order-sell-mockup-0.1.6.png):
// 구매·판매, 몇 개를, 개당 얼마 이하(이상)로. 장날에 정산된다. 시장 페이지 위에 쌓인다.
// 예약 주문이 열리면 "며칠 동안"을 고를 수 있다: 마감 날까지 날마다 이 마을 장날에 다시 들어간다 (0.1.0).
import crateImg from '../../../assets/ui/cargo_crate.png';
import coinsImg from '../../../assets/ui/coins_stack.png';
import houseImg from '../../../assets/ui/house_red.png';
import ledgerImg from '../../../assets/ui/tab_ledger.png';
import infoImg from '../../../assets/ui/icon_info.png';
import { ECONOMY } from '../../sim/constants';
import { count, sellableCount, type GoodId } from '../../sim/economy';
import { eulReul } from '../../sim/josa';
import { ERROR_TEXT, goodName, marketMood, money } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openPage } from '../page';
import { countdownHtml, tickCountdown } from './buildings/market';

const won = (n: number) => `${money(n)}골드`;

/** −10 −1 [값] +1 +10 */
function stepper(attr: string, steps: readonly number[], value: string): string {
  const btn = (d: number) => `<button type="button" ${attr}="${d}">${d < 0 ? '−' : '+'}${Math.abs(d)}</button>`;
  return `<div class="order-stepper">${steps.filter((d) => d < 0).map(btn).join('')}<output>${value}</output>${steps.filter((d) => d > 0).map(btn).join('')}</div>`;
}

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
  const name = goodName(good);
  const art = itemArt(good);
  const page = openPage({ back: '시장', title: `${game.map.towns[m.town]!.name} 시장`, icon: houseImg });
  page.onClose(tickCountdown(page.el, game));

  /** 아래 돈 상자: 한 번이면 예약금(사기)이나 최소 수령액(팔기), 여러 날이면 어떻게 내는지 */
  const summary = (total: number): { title: string; sub: string; amount: string; note: string } => {
    if (days > 1)
      return side === 'sell'
        ? {
            title: '날마다 내는 판매 예약',
            sub: `개당 ${won(price)} 이상`,
            amount: '',
            note: `다 팔릴 때까지 날마다 이 마을 장날에 내요. 짐은 이 마을 창고${stored ? `(${stored}개)` : ''}에서, 모자라면 여기 와 있는 수레에서 내요. 짐이 없는 날은 건너뛰어요.`,
          }
        : {
            title: '날마다 내는 구매 예약',
            sub: `개당 ${won(price)} 이하`,
            amount: '',
            note: `다 살 때까지 날마다 이 마을 장날에 사요. 그날 가진 돈만큼만 맡기고, 산 것은 ${store ? '이 마을 창고로' : '여기 와 있는 수레로 (떠나 있으면 건너뛰어요)'} 받아요.`,
          };
    return side === 'sell'
      ? { title: '전량 판매 시 최소 수령액', sub: `${qty}개 × 최소 ${won(price)}`, amount: won(total), note: '모두 팔렸을 때의 금액이에요. 체결 가격이 높으면 더 받아요.' }
      : { title: '구매 예약금', sub: `${qty}개 × 최대 ${won(price)}`, amount: won(total), note: '체결 가격이 낮거나 덜 사면 남은 금액은 돌려받아요.' };
  };

  const render = () => {
    qty = Math.max(0, Math.min(qty, maxQty()));
    const y = m.yesterday[good];
    const sum = summary(qty * price);
    const strip =
      side === 'buy'
        ? `<img src="${crateImg}" alt="" /><span><b>구매 가능 ${maxQty()}개</b><small>${porters ? '내 수레와 짐꾼 수레에' : '수레에'} ${room}개 더 들어가요. 예약하면 짐칸 공간을 미리 확보해요.</small></span>`
        : `${art ? `<img src="${art}" alt="" />` : ''}<span><b>판매 가능 ${maxQty()}개</b><small>${
            days > 1 && stored ? `수레 ${have}개와 이 마을 창고 ${stored}개를 장날에 판매해요.` : `보유한 ${eulReul(name)} 장날에 판매해요.`
          }</small>${spoiling ? `<small class="warn">곧 상할 ${spoiling}개는 장에 낼 수 없어요.</small>` : ''}</span>`;
    const priceBlock = canEditPrice
      ? `<h4>${side === 'sell' ? '개당 최저 판매가' : '개당 최대 구매가'}</h4>
         <small>${side === 'sell' ? '이 가격보다 싸면 팔지 않아요.' : '이 가격보다 비싸면 사지 않아요.'}</small>
         ${stepper('data-p', [-5, -1, 1, 5], won(price))}`
      : // 처음엔 추천 값으로 탭 한 번에. 첫 장날에 안 팔린 뒤로 값을 직접 고칠 수 있다
        `<h4>${side === 'sell' ? '개당 판매가' : '개당 구매가'} · ${won(price)}</h4><small>추천 값이에요. 첫 장날이 지나면 값을 직접 정할 수 있어요.</small>`;
    const daysBlock = canReserve
      ? `<h4>예약 유지 기간</h4>
         <div class="order-stepper days"><button type="button" data-d="-1" aria-label="하루 줄이기">−</button><output>장날 ${days}회</output><button type="button" data-d="1" aria-label="하루 늘리기">+</button></div>
         <small class="center">${days === 1 ? '이번 장날까지만 유지' : `${v.day + days - 1}일째 장날까지 날마다`}</small>`
      : '';

    page.body.innerHTML = `
      <section class="order-hero">
        ${art ? `<img src="${art}" alt="" />` : ''}
        <div><h3>${name} 거래 예약</h3><small>오늘 시세 ${won(m.price[good])} · 보유 ${count(v.haul, good)}개</small></div>
      </section>
      <div class="order-sides" role="group" aria-label="구매 또는 판매">
        <button type="button" data-side="buy" aria-pressed="${side === 'buy'}">구매</button>
        <button type="button" data-side="sell" aria-pressed="${side === 'sell'}" ${have || (canReserve && stored) ? '' : 'disabled'}>판매</button>
      </div>
      <div class="order-strip">${strip}</div>
      <section class="order-form">
        <h4>${side === 'sell' ? '판매' : '구매'} 수량</h4>
        ${stepper('data-q', [-10, -1, 1, 10], `${qty}개`)}
        ${priceBlock}
        ${daysBlock}
      </section>
      <section class="order-total">
        <img src="${coinsImg}" alt="" />
        <span><b>${sum.title}</b><small>${sum.sub}</small></span>
        ${sum.amount ? `<strong>${sum.amount}</strong>` : ''}
        <p>${sum.note}</p>
      </section>
      <details class="order-past">
        <summary><img src="${ledgerImg}" alt="" /><b>지난 장날 거래 정보</b><span>${y.price !== null ? `${won(y.price)}에 체결` : '체결된 거래 없음'}</span></summary>
        <p>${y.price !== null ? `어제 장날에는 ${won(y.price)}에 맞춰졌어요.` : '어제 장날에는 맞춰진 거래가 없었어요.'} ${marketMood(y.demand, y.supply)}</p>
      </details>
      <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />장날에 물품별로 하나의 가격이 정해져요.<br />먼저 예약해도 우선권은 없어요.</p>
      ${error ? `<p class="error">${error}</p>` : ''}
      <div class="order-submit">
        ${countdownHtml(game, v.apprentice !== null)}
        <button type="button" class="rumor-note" data-submit ${qty > 0 ? '' : 'disabled'}>${name} ${qty}개 ${side === 'sell' ? '판매' : '구매'} 예약${days > 1 ? ` · 장날 ${days}회` : ''}</button>
      </div>`;

    page.body.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
      b.addEventListener('click', () => {
        side = b.dataset.side as 'sell' | 'buy';
        price = defaultPrice(side);
        qty = side === 'sell' ? have : Math.min(1, room);
        error = '';
        render();
      }),
    );
    page.body.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) =>
      b.addEventListener('click', () => {
        qty += Number(b.dataset.q);
        render();
      }),
    );
    page.body.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        days = Math.max(1, Math.min(maxDays, days + Number(b.dataset.d)));
        render();
      }),
    );
    page.body.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        price = Math.max(1, price + Number(b.dataset.p));
        render();
      }),
    );
    page.body.querySelector('[data-submit]')!.addEventListener('click', async () => {
      const r = await (days > 1
          ? game.dispatch({ type: 'reserveOrder', town: m.town, good, side, qty, limit: price, until: v.day + days - 1 })
          : side === 'sell'
            ? game.dispatch({ type: 'placeSellOrder', good, qty, minPrice: price })
            : game.dispatch({ type: 'placeBuyOrder', good, qty, maxPrice: price }));
      if (r.ok) page.close();
      else {
        error = ERROR_TEXT[r.error];
        render();
      }
    });
  };
  render();
}
