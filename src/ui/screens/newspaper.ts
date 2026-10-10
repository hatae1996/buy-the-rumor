// 신문 (0.1.2 "신문은 마을에서 산다", 0.1.3 매일 신문): 마을 탭의 신문팔이에게서 그날 신문과 지난 신문을 사고,
// 소식 탭 신문함에서 한 부씩 읽는다. 한 부는 큰 소식, 도시 시세, 날씨 구역으로 나뉜다.
import sealSmall from '../../../assets/ui/seal_small.png';
import type { PlayerView } from '../../sim/economy';
import { agoText, ERROR_TEXT, money } from '../format';
import type { Game } from '../game';
import { openLiveSheet } from '../liveSheet';
import { openSheet } from '../sheet';

/** 신문 날짜: "9일째 장날" (몇 날 전인지 함께) */
export function paperDate(v: PlayerView, day: number): string {
  return `${day}일째 장날 신문 <small class="muted">${agoText(v.day, day)}</small>`;
}

/** 신문팔이 쪽지: 오늘 신문과 지난 신문 사기 */
export function openNewsboy(game: Game): void {
  openLiveSheet(game, '신문팔이', (body, v, sheet) => {
    const np = v.newspaper;
    const sale = np.onSale;
    const price = (fee: number) => (np.free ? '견습 동안 무료' : money(fee));
    const backRows = np.back
      .map(
        (b) => `<li class="paper-back">
          <span>${paperDate(v, b.day)}</span>
          ${
            b.bought
              ? `<button type="button" class="secondary-btn" data-read="${b.day}">읽기</button>`
              : `<button type="button" class="secondary-btn" data-buy="${b.day}" ${v.gold < b.fee ? 'disabled' : ''}>사기 · ${price(b.fee)}</button>`
          }
        </li>`,
      )
      .join('');
    body.innerHTML = `
      <p class="muted">도시 신문사에서 매일 찍는 장터 신문이에요. 큰 사건은 사실만, 도시 시세와 날씨도 실어요. 길 위에서는 살 수 없어요.${
        np.late ? ' 이 마을은 도시에서 멀어 하루 늦은 신문이 와요.' : ''
      }</p>
      ${
        sale === null
          ? '<p>아직 첫 장날이 지나지 않아 신문이 없어요.</p>'
          : sale.bought
            ? `<p>${paperDate(v, sale.day)}은 이미 샀어요.</p>
               <div class="btn-row"><button type="button" class="secondary-btn" data-read="${sale.day}">읽기</button></div>`
            : `<p>오늘 파는 신문: ${paperDate(v, sale.day)}</p>
               <div class="btn-row"><button type="button" class="primary-btn" data-buy="${sale.day}" ${v.gold < np.fee ? 'disabled' : ''}>신문 사기 · ${price(np.fee)}</button></div>`
      }
      ${backRows ? `<h3>지난 신문 <small class="muted">한 부 ${price(np.backFee)}</small></h3><ul class="list">${backRows}</ul>` : ''}`;
    body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const day = Number(b.dataset.buy);
        if (sheet.send({ type: 'buyNewspaper', day })) openPaper(game, day);
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-read]').forEach((b) => b.addEventListener('click', () => openPaper(game, Number(b.dataset.read))));
  });
}

/** 산 신문 한 부를 처음부터 끝까지 (읽음으로 적는다) */
export function openPaper(game: Game, day: number): void {
  const r = game.dispatch({ type: 'readPaper', day });
  const v = game.view();
  const items = v.news.filter((n) => n.day === day);
  const big = items.filter((n) => !n.section).map((n) => n.text);
  const prices = items.filter((n) => n.section === 'prices').map((n) => n.text);
  const weather = items.filter((n) => n.section === 'weather').map((n) => n.text);
  const sheet = openSheet(`${day}일째 장날 신문`);
  sheet.body.innerHTML = r.ok
    ? `<article class="newspaper paper-issue">
        <img class="seal" src="${sealSmall}" alt="" />
        <h2>장터 신문</h2>
        <p class="muted">${day}일째 장날까지의 소식 · ${agoText(v.day, day)}</p>
        ${big.length ? `<h3>${big[0]}</h3>` : '<p class="muted">큰 소식 없는 조용한 장날이었어요.</p>'}
        ${big.length > 1 ? `<ul class="list news-list">${big.slice(1).map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
        ${prices.length ? `<h4>도시 시세</h4><ul class="list news-list">${prices.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
        ${weather.length ? `<h4>날씨</h4><p>${weather.join(' ')}</p>` : ''}
      </article>`
    : `<p class="error">${ERROR_TEXT[r.error]}</p>`;
}
