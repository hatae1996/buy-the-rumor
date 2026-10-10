// 장부 탭 "시세 기록" (0.1.6 목업 docs/reference/ledger-prices-mockup-0.1.6.png).
// 마을 하나를 골라 물품 9개 값을 본다. 지금 있는 마을은 오늘 시세, 다른 마을은 마지막으로 본 날의 값(기억).
// 다른 마을은 이름이나 "다른 마을 시세 보기"를 눌러 쪽지에서 고른다. 가 본 적 없는 마을은 고를 수 없다.
import houseHere from '../../../assets/ui/house_red.png';
import houseThere from '../../../assets/ui/house_blue.png';
import clockImg from '../../../assets/ui/icon_clock.png';
import infoImg from '../../../assets/ui/icon_info.png';
import mapImg from '../../../assets/ui/tab_map.png';
import chevronImg from '../../../assets/ui/icon_chevron.png';
import { GOODS, type PlayerView } from '../../sim/economy';
import { agoText, goodName, money } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openSheet } from '../sheet';

/** 고른 마을 (null이면 지금 마을, 길 위면 떠난 마을) */
let picked: number | null = null;

function shownTown(v: PlayerView): number {
  const here = v.location.kind === 'town' ? v.location.town : v.location.from;
  return picked !== null && (picked === here || v.memory[picked]) ? picked : here;
}

export function pricesHtml(game: Game, v: PlayerView): string {
  const town = shownTown(v);
  const here = v.location.kind === 'town' && v.location.town === town;
  const mem = v.memory[town];
  const prices = here ? v.market?.price : mem?.prices;
  const status = here
    ? `<span class="price-when">오늘 장 · ${v.day}일째</span><span class="price-chip now"><img src="${clockImg}" alt="" />오늘 시세</span>`
    : mem
      ? `<span class="price-when">마지막 확인 · ${mem.day}일째</span><span class="price-chip old"><img src="${clockImg}" alt="" />${agoText(v.day, mem.day)} 기록</span>`
      : `<span class="price-when">가 본 적 없음</span>`;
  const rows = prices
    ? GOODS.map((g) => {
        const art = itemArt(g);
        return `<li>
          <span class="acct-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
          <span class="price-name">${goodName(g)}</span>
          <b>${money(prices[g])}골드</b>
        </li>`;
      }).join('')
    : '<li class="muted">직접 가 보거나 소문을 들어야 알 수 있어요.</li>';
  const others = game.map.towns.filter((t) => t.id !== town && (v.memory[t.id] || (v.location.kind === 'town' && v.location.town === t.id))).length;

  return `
    <section class="price-town">
      <img src="${here ? houseHere : houseThere}" alt="" />
      <div class="price-town-name">
        <button type="button" class="price-pick" data-price-pick>${game.map.towns[town]!.name} <span aria-hidden="true">⌄</span></button>
        ${here ? '<span class="price-chip here">현재 위치</span>' : ''}
      </div>
      <div class="price-town-when">${status}</div>
    </section>
    <section class="price-table">
      <div class="price-table-head"><span>물품</span><span>${here ? '오늘 가격' : '기록 가격'}</span></div>
      <ul>${rows}</ul>
    </section>
    <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />${
      here ? '오늘 장의 시세예요. 장날에 신청이 맞춰지면 바뀌어요.' : '마지막으로 확인한 가격이에요.<br />실제 시세와 다를 수 있어요.'
    }</p>
    ${
      others
        ? `<button type="button" class="town-row price-others" data-price-pick>
            <span class="town-row-pic"><img src="${mapImg}" alt="" /></span>
            <span class="town-row-text"><span class="town-row-name">다른 마을 시세 보기</span><small>기억하는 마을 ${others}곳</small></span>
            <img class="town-chevron" src="${chevronImg}" alt="" />
          </button>`
        : ''
    }`;
}

/** 마을 고르기 쪽지: 지금 마을과 기억하는 마을만 고를 수 있다 */
function openTownPicker(game: Game, v: PlayerView, rerender: () => void): void {
  const sheet = openSheet('어느 마을 시세를 볼까요');
  const hereId = v.location.kind === 'town' ? v.location.town : null;
  const current = shownTown(v);
  sheet.body.innerHTML = `<ul class="price-pick-list">${game.map.towns
    .map((t) => {
      const mem = v.memory[t.id];
      const isHere = hereId === t.id;
      const note = isHere ? '지금 여기 · 오늘 시세' : mem ? `${mem.day}일째에 본 시세 (${agoText(v.day, mem.day)})` : '가 본 적 없음';
      return `<li><button type="button" class="town-row" data-town="${t.id}" ${isHere || mem ? '' : 'disabled'} aria-current="${t.id === current}">
          <span class="town-row-pic"><img src="${isHere ? houseHere : houseThere}" alt="" /></span>
          <span class="town-row-text"><span class="town-row-name">${t.name}</span><small>${note}</small></span>
        </button></li>`;
    })
    .join('')}</ul>`;
  sheet.body.querySelectorAll<HTMLButtonElement>('[data-town]').forEach((b) =>
    b.addEventListener('click', () => {
      picked = Number(b.dataset.town);
      sheet.close();
      rerender();
    }),
  );
}

export function bindPrices(el: HTMLElement, game: Game, v: PlayerView, rerender: () => void): void {
  el.querySelectorAll('[data-price-pick]').forEach((b) => b.addEventListener('click', () => openTownPicker(game, v, rerender)));
}
