// 신문 (0.1.2 "신문은 마을에서 산다", 0.1.3 매일 신문): 마을 탭의 신문팔이에게서 그날 신문과 지난 신문을 사고,
// 소식 탭 신문함에서 한 부씩 읽는다 (지면은 paperPage.ts). 한 부는 큰 소식, 도시 시세, 날씨 구역으로 나뉜다.
// 신문팔이 페이지 (0.1.6 목업 docs/reference/newsboy-sale-mockup-0.1.6.png, newsboy-wait-mockup-0.1.6.png).
import standImg from '../../../assets/ui/newsstand.png';
import emptyStandImg from '../../../assets/ui/newsstand_empty.png';
import paperImg from '../../../assets/ui/tab_news.png';
import wagonImg from '../../../assets/ui/travel_wagon.png';
import pinImg from '../../../assets/ui/icon_pin.png';
import infoImg from '../../../assets/ui/icon_info.png';
import coinImg from '../../../assets/ui/coin.png';
import chevronImg from '../../../assets/ui/icon_chevron.png';
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import { agoText, money } from '../format';
import type { Game } from '../game';
import { openLivePage } from '../livePage';
import { goToTab } from '../nav';
import { showNewsTab } from './news';
import { openPaper } from './paperPage';

export { openPaper };

/** 신문팔이 페이지: 오늘 도착한 신문과 지난 신문 사기, 신문이 오는 길 */
export function openNewsboy(game: Game): void {
  const v0 = game.view();
  if (v0.location.kind !== 'town') return;
  const here = v0.location.town;
  openLivePage(game, { back: '마을', title: '신문팔이' }, (body, v, page) => {
    if (v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    const np = v.newspaper;
    const sale = np.onSale;
    const price = (fee: number) => (np.free ? '견습 동안 무료' : `${money(fee)}냥`);
    const card =
      sale === null
        ? `<section class="stand-card">
            <div class="stand-main">
              <img src="${emptyStandImg}" alt="" />
              <div>
                <span class="paper-chip">아직 도착 전</span>
                <h4>아직 판매할 신문이 없어요</h4>
                <small>첫 장날 신문이 도착하면 구입할 수 있어요.</small>
              </div>
            </div>
            <button type="button" class="rumor-note" disabled>신문 도착 대기</button>
          </section>`
        : `<section class="stand-card">
            <div class="stand-main">
              <img src="${paperImg}" alt="" />
              <div>
                <span class="paper-chip ${sale.bought ? 'read' : 'now'}">${sale.bought ? '구입함' : '판매 중'}</span>
                <h4>${sale.day}일째 장날 신문</h4>
                <small>${agoText(v.day, sale.day)} 발행</small>
                <span class="stand-price"><span>가격</span><img src="${coinImg}" alt="" />${price(np.fee)}</span>
                <small>${sale.bought ? '내 신문 보관함에서 다시 읽을 수 있어요.' : '구입한 뒤 내용을 읽을 수 있어요.'}</small>
              </div>
            </div>
            ${
              sale.bought
                ? `<button type="button" class="rumor-note" data-read="${sale.day}">읽기</button>`
                : `<button type="button" class="rumor-note" data-buy="${sale.day}" ${v.gold < np.fee ? 'disabled' : ''}>${price(np.fee)} · 신문 구입</button>`
            }
          </section>`;
    const back = np.back
      .map(
        (b) => `<li>
          <img src="${paperImg}" alt="" />
          <span class="paper-row-text"><b>${b.day}일째 장날 신문</b><small>${agoText(v.day, b.day)} 발행</small></span>
          ${
            b.bought
              ? `<button type="button" class="paper-read" data-read="${b.day}">읽기 ›</button>`
              : `<button type="button" class="paper-read" data-buy="${b.day}" ${v.gold < b.fee ? 'disabled' : ''}>${price(b.fee)}</button>`
          }
        </li>`,
      )
      .join('');
    const arrived = sale ? v.day - sale.day : null;
    body.innerHTML = `
      <section class="stand-hero">
        <img src="${standImg}" alt="" />
        <span class="paper-where"><img src="${pinImg}" alt="" />${game.map.towns[here]!.name}</span>
      </section>
      <h3 class="stand-title"><img src="${sprigL}" alt="" />${sale ? '오늘 도착한 신문' : '신문을 기다리는 중'}<img src="${sprigR}" alt="" /></h3>
      ${card}
      ${back ? `<section class="paper-card"><div class="paper-card-head"><h3>지난 신문</h3><span>한 부 ${price(np.backFee)}</span></div><ul class="paper-list">${back}</ul></section>` : ''}
      <section class="paper-card stand-route">
        <h3>신문이 오는 길</h3>
        <div class="stand-route-main">
          <img src="${wagonImg}" alt="" />
          <ul>
            <li>도시 신문사에서 매일 찍은 신문이 마을로 배달돼요.</li>
            <li>마을에 따라 도착하는 날이 달라요.${np.late ? ' 이 마을은 도시에서 멀어 하루 늦게 와요.' : ''}</li>
          </ul>
        </div>
        ${arrived !== null ? `<p class="stand-note"><img src="${infoImg}" alt="" /><span>이 마을에는 <b>${arrived === 0 ? '오늘' : `${arrived}일 전`}</b> 신문이 도착했어요.</span></p>` : ''}
        <small>이동 중에는 신문을 구입할 수 없어요.</small>
      </section>
      ${
        v.unlocks.includes('news')
          ? `<button type="button" class="town-row inn-link" data-box>
              <span class="town-row-pic"><img src="${paperImg}" alt="" /></span>
              <span class="town-row-text"><span class="town-row-name">내 신문 보관함</span><small>산 신문 ${np.papers.length}부</small></span>
              <img class="town-chevron" src="${chevronImg}" alt="" />
            </button>`
          : ''
      }`;
    body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const day = Number(b.dataset.buy);
        if (page.send({ type: 'buyNewspaper', day })) openPaper(game, day);
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-read]').forEach((b) => b.addEventListener('click', () => openPaper(game, Number(b.dataset.read))));
    body.querySelector('[data-box]')?.addEventListener('click', () => {
      showNewsTab('paper');
      goToTab('news');
    });
  });
}
