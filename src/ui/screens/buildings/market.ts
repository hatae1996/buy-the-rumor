// 시장: 오늘 시세, 장날 신청(팔기, 사기), 이 마을에 낸 신청.
import arrowDown from '../../../../assets/ui/arrow_down.png';
import arrowUp from '../../../../assets/ui/arrow_up.png';
import { count, GOODS, type GoodId } from '../../../sim/economy';
import { goodName } from '../../format';
import type { Game } from '../../game';
import { openLiveSheet } from '../../liveSheet';
import { openOrderSheet } from '../orderSheet';

export function openMarket(game: Game): void {
  openLiveSheet(game, '시장', (body, v, sheet) => {
    const m = v.market;
    if (!m || v.location.kind !== 'town') {
      sheet.close();
      return;
    }
    const here = v.location.town;
    const rows = GOODS.map((g) => {
      const have = count(v.haul, g);
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
    const mine = v.orders.filter((o) => o.town === here);
    const orders =
      mine
        .map(
          (o) => `<li class="order-row">
            <span class="order-side ${o.side}">${o.side === 'sell' ? '팔기' : '사기'}</span>
            <span>${goodName(o.good)} ${o.qty}개${o.from === 'store' ? ' (창고)' : ''} · ${o.side === 'sell' ? `${o.limit} 이상` : `${o.limit} 이하`}</span>
            <button type="button" class="link-btn" data-cancel="${o.id}">취소</button>
          </li>`,
        )
        .join('') || '<li class="muted">아직 낸 신청이 없어요.</li>';
    body.innerHTML = `
      <p class="muted">사고팔 물건을 누르세요. 신청은 장날에 한꺼번에 맞춰서 값 하나로 정해져요.</p>
      <ul class="good-list">${rows}</ul>
      <h3>장날에 낼 신청</h3>
      <ul class="order-list">${orders}</ul>`;
    body.querySelectorAll<HTMLButtonElement>('[data-good]').forEach((b) =>
      b.addEventListener('click', () => openOrderSheet(game, b.dataset.good as GoodId)),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => sheet.send({ type: 'cancelOrder', orderId: Number(b.dataset.cancel) })),
    );
  });
}
