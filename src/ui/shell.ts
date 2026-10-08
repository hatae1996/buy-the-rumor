// 앱 틀: 위 상태줄(돈, 날짜, 짐), 가운데 화면, 아래 탭 4개 (마을, 지도, 장부, 소식).
import coin from '../../assets/ui/coin.png';
import tabLedger from '../../assets/ui/tab_ledger.png';
import tabMap from '../../assets/ui/tab_map.png';
import tabNews from '../../assets/ui/tab_news.png';
import tabTown from '../../assets/ui/tab_town.png';
import { dayText, durationText, money } from './format';
import type { AwaySummary, Game } from './game';
import type { MapScreen } from './mapScreen';
import { showAwaySummary } from './screens/away';
import { renderLedger } from './screens/ledger';
import { renderNews } from './screens/news';
import { openExpeditionSheet } from './screens/expeditionSheet';
import { openMealSheet } from './screens/mealSheet';
import { openOrderSheet } from './screens/orderSheet';
import { buyDrink, openPigeonSheet } from './screens/rumorSheet';
import { openCartShopSheet, openStableSheet } from './screens/horseSheet';
import { renderTown } from './screens/town';

export type TabId = 'town' | 'map' | 'ledger' | 'news';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'town', label: '마을', icon: tabTown },
  { id: 'map', label: '지도', icon: tabMap },
  { id: 'ledger', label: '장부', icon: tabLedger },
  { id: 'news', label: '소식', icon: tabNews },
];

/** 장날이 지났는지 확인하는 간격 */
const CLOCK_MS = 30_000;

export function mountShell(root: HTMLElement, game: Game, now: () => number): void {
  root.innerHTML = `
    <div class="shell">
      <header class="status-bar">
        <span class="status-gold"><img src="${coin}" alt="돈" /><b data-gold></b></span>
        <span class="status-day" data-day></span>
        <span class="status-market" data-market></span>
      </header>
      <main class="shell-body">
        ${TABS.filter((t) => t.id !== 'map')
          .map((t) => `<div class="screen" data-screen="${t.id}" hidden></div>`)
          .join('')}
        <div class="shell-map" data-screen="map" hidden></div>
      </main>
      <nav class="tabs" role="tablist" aria-label="화면">
        ${TABS.map(
          (t) => `<button type="button" role="tab" data-tab="${t.id}" aria-selected="false">
            <img src="${t.icon}" alt="" draggable="false" /><span>${t.label}</span>
          </button>`,
        ).join('')}
      </nav>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const body = $('.shell-body');
  const screens = Object.fromEntries(TABS.map((t) => [t.id, $(`[data-screen="${t.id}"]`)])) as Record<TabId, HTMLElement>;
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-tab]');
  let current: TabId = 'town';
  // 지도는 처음 열 때 불러오고, 다른 탭에 있는 동안은 그리기를 멈춘다
  let map: Promise<MapScreen> | null = null;

  const away = (s: AwaySummary | null) => {
    if (s) showAwaySummary(game, s);
  };

  const render = () => {
    const v = game.view();
    $('[data-gold]').textContent = money(v.gold);
    $('[data-day]').textContent = dayText(v.day, v.season);
    $('[data-market]').textContent = `장날까지 ${durationText(game.msUntilMarket(now()))}`;
    const el = screens[current];
    if (current === 'town') {
      renderTown(el, game, v, {
        openOrder: (good) => openOrderSheet(game, good),
        cancelOrder: (id) => game.dispatch({ type: 'cancelOrder', orderId: id }),
        passDay: () => away(game.passDay(now())),
        restAtInn: () => game.dispatch({ type: 'restAtInn' }),
        openMeal: () => openMealSheet(game),
        startExpedition: () => {
          const r = game.dispatch({ type: 'startExpedition' });
          if (r.ok) openExpeditionSheet(game);
        },
        resumeExpedition: () => openExpeditionSheet(game),
        buyDrink: () => buyDrink(game),
        openPigeon: () => openPigeonSheet(game),
        restHorses: () => game.dispatch({ type: 'restHorses' }),
        openStable: () => openStableSheet(game),
        openCartShop: () => openCartShopSheet(game),
      });
    } else if (current === 'ledger') {
      renderLedger(el, game, v, (id) => game.dispatch({ type: 'cancelOrder', orderId: id }));
    }
    else if (current === 'news') renderNews(el, game, v);
    else void map?.then((m) => m.render());
  };

  const select = (id: TabId) => {
    current = id;
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    for (const t of TABS) screens[t.id].hidden = t.id !== id;
    body.classList.toggle('is-map', id === 'map');
    body.scrollTop = 0;
    if (id === 'map' && !map) map = import('./mapScreen').then((m) => m.mountMapScreen(screens.map, game));
    void map?.then((m) => m.setActive(id === 'map'));
    render();
  };

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab as TabId)));
  game.subscribe(render);
  select('town');

  // 앱을 다시 열었을 때와 열어 둔 동안 장날이 지나면 그 사이 일을 보여 준다
  away(game.catchUp(now()));
  setInterval(() => {
    const s = game.catchUp(now());
    if (s) away(s);
    else render();
  }, CLOCK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) away(game.catchUp(now()));
  });
}
