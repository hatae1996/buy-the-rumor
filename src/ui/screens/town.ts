// 마을 (기본 화면): 이 마을 오늘 시세, 장날까지 남은 시간, 장날에 낼 신청.
import arrowDown from '../../../assets/ui/arrow_down.png';
import arrowUp from '../../../assets/ui/arrow_up.png';
import notePin from '../../../assets/ui/note_pin.png';
import village from '../../../assets/ui/village.png';
import { count, GOODS, type PlayerView } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { goodName } from '../format';
import type { Game } from '../game';

export interface TownScreenActions {
  openOrder: (good: (typeof GOODS)[number]) => void;
  cancelOrder: (orderId: number) => void;
  passDay: () => void;
  restAtInn: () => void;
  openMeal: () => void;
}

/** 피로 막대: 칸 10개 */
function fatigueBar(v: PlayerView): string {
  const cells = Array.from({ length: v.fatigueMax }, (_, i) => `<i class="${i < v.fatigue ? 'on' : ''}"></i>`).join('');
  const word = v.fatigue === 0 ? '쌩쌩해요' : v.tired ? '많이 지쳤어요' : v.fatigue >= 4 ? '조금 지쳤어요' : '괜찮아요';
  return `<div class="fatigue"><div class="fatigue-cells" aria-hidden="true">${cells}</div><span>${word}</span></div>`;
}

export function renderTown(el: HTMLElement, game: Game, v: PlayerView, act: TownScreenActions): void {
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
        <h2>오늘 시세</h2>
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
      ${v.location.kind === 'town' && game.map.towns[v.location.town]!.tier === 'city' ? '<span class="tier-badge">도시</span>' : ''}
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
    <section class="card">
      <h2>내 몸</h2>
      ${fatigueBar(v)}
      <p class="muted">밤마다 조금씩 나아요. 음식을 먹거나 여관에서 쉬면 빨리 나아요.</p>
      <div class="btn-row">
        <button type="button" class="secondary-btn" data-meal ${v.fatigue > 0 && v.mealsLeft > 0 ? '' : 'disabled'}>
          음식 먹기<small>오늘 ${v.mealsLeft}끼 더</small>
        </button>
        ${
          v.inn
            ? `<button type="button" class="secondary-btn" data-inn ${v.fatigue > 0 && !v.inn.rested && v.gold >= v.inn.fee ? '' : 'disabled'}>
                여관에서 쉬기<small>${v.inn.rested ? '오늘은 쉬었어요' : `여관비 ${v.inn.fee} · 피로 −${v.inn.recovery}`}</small>
              </button>`
            : ''
        }
      </div>
    </section>
    ${
      v.location.kind === 'town'
        ? `<section class="card">
            <header class="card-head"><h2>바깥 (원정)</h2>${
              v.canExpedition ? `<span class="badge">기회 ${v.expeditionChances} / 6</span>` : ''
            }</header>
            <p class="muted">${
              v.canExpedition
                ? '이 마을에 머무는 동안 하루에 한 번씩 원정 기회가 생겨요. 떠나면 사라져요.'
                : '이 마을 주변에는 원정을 나갈 자원지가 없어요.'
            }</p>
            ${v.canExpedition ? '<button type="button" class="secondary-btn" disabled>원정 나가기<small>곧 열려요</small></button>' : ''}
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
  el.querySelector('[data-inn]')?.addEventListener('click', act.restAtInn);
  el.querySelector('[data-meal]')?.addEventListener('click', act.openMeal);
}
