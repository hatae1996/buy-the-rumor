// 신문 한 부 (0.1.6 목업 docs/reference/newspaper-mockup-0.1.6.png): 화면 전체를 덮는 종이 지면.
// 제호(수레바퀴와 잎), 호수·발행일, 오늘의 장터(큰 소식), 각지의 시세(도시 시세 표), 날씨와 길(삽화).
// 산 신문만 펼친다 (펼치면 읽음으로 적는다). 돌아가기나 Esc로 닫는다.
import paperBg from '../../../assets/ui/paper_bg.jpg';
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import roadSpring from '../../../assets/ui/road_spring.png';
import roadSummer from '../../../assets/ui/road_summer.png';
import roadAutumn from '../../../assets/ui/road_autumn.png';
import roadWinter from '../../../assets/ui/road_winter.png';
import wagonImg from '../../../assets/ui/travel_horse_wagon.png';
import type { GoodId, NewsItem } from '../../sim/economy';
import { SEASON_NAME } from '../../sim/season';
import { paperName, PRE_SEASON_PAPER_DAY } from '../../sim/news';
import { agoText, ERROR_TEXT, goodName } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';

const ROAD = [roadSpring, roadSummer, roadAutumn, roadWinter] as const;

/** 제호의 수레바퀴 (그림 대신 선으로) */
const WHEEL = `<svg class="paper-wheel" viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3.5" />
  <circle cx="24" cy="24" r="15.5" fill="none" stroke="currentColor" stroke-width="1.2" />
  <circle cx="24" cy="24" r="4" fill="currentColor" />
  ${Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return `<line x1="${24 + 4 * Math.cos(a)}" y1="${24 + 4 * Math.sin(a)}" x2="${24 + 15.5 * Math.cos(a)}" y2="${24 + 15.5 * Math.sin(a)}" stroke="currentColor" stroke-width="1.6" />`;
  }).join('')}
</svg>`;

/** 각지의 시세: 도시마다 실린 물품 한 줄씩 (예전 저장의 기사는 글 그대로) */
function priceRows(game: Game, items: readonly NewsItem[]): string {
  return items
    .map((n) => {
      if (n.town === undefined || !n.prices) return `<tr><td colspan="3">${n.text}</td></tr>`;
      const town = game.map.towns[n.town]!.name;
      const goods = Object.entries(n.prices) as [GoodId, number][];
      if (!goods.length) return `<tr><td>${town}</td><td colspan="2" class="paper-quiet">장이 한산했어요</td></tr>`;
      return goods
        .map(([g, price], i) => {
          const art = itemArt(g);
          return `<tr>
            <td>${i === 0 ? town : ''}</td>
            <td class="paper-good">${art ? `<img src="${art}" alt="" />` : ''}${goodName(g)}</td>
            <td class="paper-price-cell">${price}골드</td>
          </tr>`;
        })
        .join('');
    })
    .join('');
}

let open: { close: () => void } | null = null;

/** 산 신문 한 부를 처음부터 끝까지 (읽음으로 적는다) */
export function openPaper(game: Game, day: number): void {
  open?.close();
  const r = game.dispatch({ type: 'readPaper', day });
  const v = game.view();
  const items = v.news.filter((n) => n.day === day);
  const big = items.filter((n) => !n.section).map((n) => n.text);
  const prices = items.filter((n) => n.section === 'prices');
  const weather = items.filter((n) => n.section === 'weather').map((n) => n.text);
  const season = game.seasonOf(day);

  const page = document.createElement('div');
  page.className = 'paper-page';
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-modal', 'true');
  page.setAttribute('aria-label', paperName(day, '장터 '));
  page.style.backgroundImage = `url('${paperBg}')`;
  page.innerHTML = `
    <header class="paper-bar">
      <button type="button" class="paper-back" data-close>‹ 돌아가기</button>
      <span>${paperName(day)}</span>
    </header>
    ${
      r.ok
        ? `<article class="paper-sheet">
            <div class="paper-mast">
              <div class="paper-emblem"><span class="paper-rule"></span><img src="${sprigL}" alt="" />${WHEEL}<img src="${sprigR}" alt="" /><span class="paper-rule"></span></div>
              <h1>장터 신문</h1>
              <div class="paper-dateline"><span>제${day}호</span><span>${day === PRE_SEASON_PAPER_DAY ? '시즌 전날' : `${SEASON_NAME[season]} ${day}일째`} 발행</span><span>${agoText(v.day, day)} 소식</span></div>
            </div>
            <section class="paper-lead">
              <span class="paper-kicker">오늘의 장터</span>
              <h2>${big[0] ?? '큰 소식 없이 지나간 장날'}</h2>
              ${
                big.length > 1
                  ? big.slice(1).map((t) => `<p>${t}</p>`).join('')
                  : big.length
                    ? ''
                    : '<p>큰 소식 없는 조용한 장날이었어요. 상인들은 물건을 살피며 다음 장날을 준비했어요.</p>'
              }
            </section>
            ${
              prices.length
                ? `<section class="paper-section">
                    <h3>각지의 시세</h3>
                    <small>취재 당시 확인한 가격</small>
                    <table class="paper-table">
                      <thead><tr><th>마을</th><th>물품</th><th>가격</th></tr></thead>
                      <tbody>${priceRows(game, prices)}</tbody>
                    </table>
                    <small>지금 시세와 다를 수 있어요.</small>
                  </section>`
                : ''
            }
            ${
              weather.length
                ? `<section class="paper-section paper-weather">
                    <h3>날씨와 길</h3>
                    <p>${weather.join(' ')}</p>
                    <div class="paper-sketch" aria-hidden="true"><img src="${ROAD[season]}" alt="" /><img class="paper-sketch-wagon" src="${wagonImg}" alt="" /></div>
                  </section>`
                : ''
            }
            <footer class="paper-foot"><span>장터 신문</span><span>제${day}호</span></footer>
          </article>`
        : `<p class="error paper-error">${ERROR_TEXT[r.error]}</p>`
    }`;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    page.remove();
    document.removeEventListener('keydown', onKey);
    if (open === handle) open = null;
  };
  const handle = { close };
  open = handle;
  page.querySelector('[data-close]')!.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>('[data-close]')!.focus();
}
