// 마을 (기본 화면): 이 마을 오늘 시세, 장날까지 남은 시간, 장날에 낼 신청.
import arrowDown from '../../../assets/ui/arrow_down.png';
import arrowUp from '../../../assets/ui/arrow_up.png';
import notePin from '../../../assets/ui/note_pin.png';
import village from '../../../assets/ui/village.png';
import { count, GOODS, type PlayerView } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { durationText, goodName } from '../format';
import type { Game } from '../game';

export interface TownScreenActions {
  openOrder: (good: (typeof GOODS)[number]) => void;
  cancelOrder: (orderId: number) => void;
  passDay: () => void;
}

export function renderTown(el: HTMLElement, game: Game, v: PlayerView, now: number, act: TownScreenActions): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const place = v.location.kind === 'town' ? townName(v.location.town) : `${euro(townName(v.location.to))} 가는 길`;

  let body = '';
  if (v.location.kind === 'road') {
    const { from, to, daysLeft } = v.location;
    body = `
      <section class="card">
        <h2>길 위에 있어요</h2>
        <p>${townName(from)}에서 ${euro(townName(to))} 가는 중이에요. <b>${daysLeft}일</b> 뒤에 도착해요.</p>
        <p class="muted">길 위에서는 장에 신청할 수 없어요. 도착하면 그 마을 시세를 볼 수 있어요.</p>
      </section>`;
  } else if (v.market) {
    const m = v.market;
    const rows = GOODS.map((g) => {
      const have = count(v.cargo, g);
      const prev = m.previous?.[g];
      const trend =
        prev === undefined || prev === m.price[g]
          ? '<span class="trend"></span>'
          : `<img class="trend" src="${m.price[g] > prev ? arrowUp : arrowDown}" alt="${m.price[g] > prev ? '오름' : '내림'}" />`;
      return `<li><button type="button" class="good-row" data-good="${g}">
          <span class="good-name">${goodName(g)}</span>
          <span class="good-have">${have ? `짐 ${have}` : ''}</span>
          <span class="good-price">${trend}<b>${m.price[g]}</b></span>
        </button></li>`;
    }).join('');
    body = `
      <section class="card">
        <header class="card-head">
          <h2>오늘 시세</h2>
          <span class="badge">장날까지 ${durationText(game.msUntilMarket(now))}</span>
        </header>
        <p class="muted">사고팔 물건을 누르세요. 신청은 장날에 한꺼번에 맞춰서 값 하나로 정해져요.</p>
        <ul class="good-list">${rows}</ul>
      </section>`;
  }

  const orders = v.orders.length
    ? v.orders
        .map(
          (o) => `<li class="order-row">
            <span class="order-side ${o.side}">${o.side === 'sell' ? '팔기' : '사기'}</span>
            <span>${goodName(o.good)} ${o.qty}개 · ${o.side === 'sell' ? `${o.limit} 이상` : `${o.limit} 이하`}</span>
            <button type="button" class="link-btn" data-cancel="${o.id}">취소</button>
          </li>`,
        )
        .join('')
    : '<li class="muted">아직 낸 신청이 없어요.</li>';

  el.innerHTML = `
    <div class="town-banner">
      <img src="${village}" alt="" />
      <div class="ribbon"><span>${place}</span></div>
    </div>
    ${body}
    ${
      v.location.kind === 'town'
        ? `<section class="card pinned">
            <img class="pin" src="${notePin}" alt="" />
            <h2>장날에 낼 신청</h2>
            <ul class="order-list">${orders}</ul>
          </section>`
        : ''
    }
    <button type="button" class="test-btn" data-pass-day>시험용: 장날 바로 열기</button>
  `;

  el.querySelectorAll<HTMLButtonElement>('[data-good]').forEach((b) =>
    b.addEventListener('click', () => act.openOrder(b.dataset.good as (typeof GOODS)[number])),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
    b.addEventListener('click', () => act.cancelOrder(Number(b.dataset.cancel))),
  );
  el.querySelector('[data-pass-day]')!.addEventListener('click', act.passDay);
}
