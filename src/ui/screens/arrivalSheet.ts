// 도착하면 팔기 (예약 주문, 0.1.0): 길 위에서 걸어 두면 도착한 뒤 첫 장날에 수레 짐을 낸다.
// 가는 마을의 오늘 시세는 모른다: 기억하는 시세가 있으면 그 0.9배, 없으면 기준 값의 0.8배를 처음 값으로 둔다.
// 0.1.6: 크림색 쪽지. 짐마다 그림, 이름, 기억하는 값, 아래 줄에 최소 값 고르기(− 값 +)와 전부 팔기.
import pinImg from '../../../assets/ui/icon_pin.png';
import infoImg from '../../../assets/ui/icon_info.png';
import { basePrice, count, GOODS, type GoodId } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { ERROR_TEXT, goodName, money } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openSheet } from '../sheet';

export function openArrivalSheet(game: Game): void {
  const sheet = openSheet('도착하면 팔기');
  const prices = new Map<GoodId, number>();
  let error = '';

  const render = () => {
    const v = game.view();
    if (v.location.kind !== 'road') {
      sheet.close();
      return;
    }
    const to = v.location.to;
    const mem = v.memory[to];
    const priceOf = (g: GoodId) => prices.get(g) ?? Math.max(1, Math.round(mem ? mem.prices[g] * 0.9 : basePrice(g) * 0.8));
    const goods = GOODS.filter((g) => count(v.haul, g) > 0);
    const rows =
      goods
        .map((g) => {
          const set = v.reservations.find((r) => r.kind === 'onArrival' && r.good === g);
          const p = priceOf(g);
          const art = itemArt(g);
          return `<li class="sk-row${set ? ' on' : ''}">
            <div class="sk-row-main">
              <span class="sk-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
              <span class="sk-text"><b>${goodName(g)} <em>${count(v.haul, g)}개</em></b><small>${mem ? `${mem.day}일째에 본 값 ${money(mem.prices[g])} G` : '이 마을 값은 몰라요'}</small></span>
              ${set ? `<span class="sk-chip teal">전부 · ${money(set.kind === 'onArrival' ? set.minPrice : p)} G 이상</span>` : ''}
            </div>
            ${
              set
                ? `<div class="sk-row-act"><button type="button" class="sk-btn" data-unset="${set.id}">걸어 둔 것 지우기</button></div>`
                : `<div class="sk-row-act">
                    <span class="sk-step">
                      <button type="button" data-p="${g}" data-dp="-1" aria-label="${goodName(g)} 값 내리기">−</button>
                      <b>${money(p)} G</b>
                      <button type="button" data-p="${g}" data-dp="1" aria-label="${goodName(g)} 값 올리기">+</button>
                    </span>
                    <button type="button" class="sk-btn coral" data-set="${g}">전부 팔기<small>${money(p)} G 이상</small></button>
                  </div>`
            }
          </li>`;
        })
        .join('') || '<li class="sk-empty">수레에 팔 짐이 없어요.</li>';
    sheet.body.innerHTML = `<div class="sk">
      <p class="sk-strip"><img src="${pinImg}" alt="" /><span><b>${euro(game.map.towns[to]!.name)} 가는 길</b><small>도착하면 첫 장날에 걸어 둔 짐을 내요.</small></span></p>
      <ul class="sk-list">${rows}</ul>
      <p class="sk-note"><img src="${infoImg}" alt="" />그 마을 오늘 값은 가 봐야 알아요. 이 값보다 싸게는 팔지 않고, 팔리면 알려 드려요.</p>
      ${error ? `<p class="error">${error}</p>` : ''}
    </div>`;
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        const g = b.dataset.p as GoodId;
        prices.set(g, Math.max(1, priceOf(g) + Number(b.dataset.dp)));
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) =>
      b.addEventListener('click', () => {
        const g = b.dataset.set as GoodId;
        const r = game.dispatch({ type: 'reserveOnArrival', good: g, qty: 'all', minPrice: priceOf(g) });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-unset]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = game.dispatch({ type: 'cancelReservation', reservationId: Number(b.dataset.unset) });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        render();
      }),
    );
  };
  render();
}
