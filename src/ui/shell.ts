// 앱 틀 (기획서 "화면 구성", 0.1.2): 위쪽 줄(내 문장, 날짜·계절, 장날까지, 소지금, 피로), 가운데 화면, 아래 탭 5개.
// 탭마다 질문 하나: 마을 = 여기서 무엇을, 지도 = 어디로, 짐칸 = 무엇을 실었나, 장부 = 돈과 약속, 소식 = 들어오는 것.
// 아이콘은 0.1.6 로우폴리 그림판에서 잘랐다 (scripts/ui/cut_sheets.py)
import { TAB_EVENT } from './nav';
import { closeAllPages } from './page';
import coin from '../../assets/ui/coin.png';
import hourglass from '../../assets/ui/icon_hourglass.png';
import bread from '../../assets/ui/icon_bread.png';
import seal from '../../assets/ui/seal_small.png';
import tabCart from '../../assets/ui/tab_cart.png';
import tabLedger from '../../assets/ui/tab_ledger.png';
import tabMap from '../../assets/ui/tab_map.png';
import tabNews from '../../assets/ui/tab_news.png';
import tabTown from '../../assets/ui/tab_town.png';
import { clockText, dayText, money } from './format';
import type { AwaySummary, Game } from './game';
import type { MapScreen } from './mapScreen';
import { showAwaySummary } from './screens/away';
import { renderCart } from './screens/cart';
import { renderLedger } from './screens/ledger';
import { renderNews } from './screens/news';
import { openCertificate } from './screens/certificate';
import { renderTown } from './screens/town';
import { openSettlement } from './screens/settlement';

export type TabId = 'town' | 'map' | 'cart' | 'ledger' | 'news';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'town', label: '마을', icon: tabTown },
  { id: 'map', label: '지도', icon: tabMap },
  { id: 'cart', label: '짐칸', icon: tabCart },
  { id: 'ledger', label: '장부', icon: tabLedger },
  { id: 'news', label: '소식', icon: tabNews },
];

/** 장날이 지났는지 확인하는 간격 */
const CLOCK_MS = 30_000;

export function mountShell(root: HTMLElement, game: Game, now: () => number): void {
  root.innerHTML = `
    <div class="shell">
      <header class="status-bar">
        <button type="button" class="status-crest" data-crest aria-label="상인 증서"><img src="${seal}" alt="" /></button>
        <span class="status-day" data-day></span>
        <span class="status-market"><img src="${hourglass}" alt="" /><span data-market></span></span>
        <span class="status-fatigue" aria-label="피로"><img src="${bread}" alt="" /><span data-fatigue></span></span>
        <span class="status-gold"><img src="${coin}" alt="돈" /><b data-gold></b></span>
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

  // 시즌이 끝났으면 결산 화면. 다음 시즌을 시작하면 새 지도라 화면을 새로 연다
  const settle = () => {
    if (game.seasonOver) openSettlement(game, () => {
      game.startNextSeason(now());
      location.reload();
    });
  };
  const away = (s: AwaySummary | null) => {
    if (s) showAwaySummary(game, s, settle);
    else settle();
  };

  const render = () => {
    const v = game.view();
    $('[data-gold]').textContent = money(v.gold);
    $('[data-day]').textContent = dayText(v.day, v.season);
    // 견습 마을은 시간이 흐르지 않는다: "하루 보내기"로 넘긴다
    // 모래시계 옆은 장날까지 남은 시간 (견습과 결산은 글로)
    const market = $('[data-market]');
    market.textContent = v.settlement ? '시즌 결산' : v.apprentice ? '견습 중' : clockText(game.msUntilMarket(now()));
    market.parentElement!.setAttribute('aria-label', v.settlement || v.apprentice ? '' : '장날까지');
    $('[data-fatigue]').textContent = `${v.fatigue}/${v.fatigueMax}`;
    // 탭은 하나씩 열린다 (견습: 마을 → 짐칸 → 장부 → 소식 → 지도)
    buttons.forEach((b) => {
      const id = b.dataset.tab as TabId;
      b.hidden = id !== 'town' && !v.unlocks.includes(id);
    });
    if (current !== 'town' && !v.unlocks.includes(current)) return select('town');
    const el = screens[current];
    if (current === 'town') {
      renderTown(el, game, v, {
        now: now(),
        passDay: () => away(game.passDay(now())),
        passApprenticeDay: () => away(game.passApprenticeDay(now())),
        openSettlement: settle,
        openCart: () => select('cart'),
      });
    } else if (current === 'cart') {
      renderCart(el, game, v);
    } else if (current === 'ledger') {
      renderLedger(el, game, v);
    }
    else if (current === 'news') renderNews(el, game, v);
    else void map?.then((m) => m.render());
  };

  const v0unlocked = (id: TabId) => (game.view().unlocks as readonly string[]).includes(id);
  const select = (id: TabId) => {
    current = id;
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    for (const t of TABS) screens[t.id].hidden = t.id !== id;
    body.classList.toggle('is-map', id === 'map');
    body.scrollTop = 0;
    if (id === 'map' && !map) map = import('./mapScreen').then((m) => m.mountMapScreen(screens.map, game, now));
    // 소식 탭을 열면 오늘 신문을 읽은 것으로 친다 (견습의 첫 신문 장면)
    if (id === 'news' && game.view().newsReadDay !== game.view().day) game.dispatch({ type: 'readNews' });
    void map?.then((m) => m.setActive(id === 'map'));
    render();
  };

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab as TabId)));
  // 페이지 안에서 다른 탭으로 (여관 → 소식 등): 열린 페이지를 닫고 그 탭을 연다
  window.addEventListener(TAB_EVENT, (e) => {
    const id = (e as CustomEvent<TabId>).detail;
    closeAllPages();
    if (id === 'town' || v0unlocked(id)) select(id);
  });
  $('[data-crest]').addEventListener('click', () => openCertificate(game));
  game.subscribe(render);
  select('town');

  // 앱을 다시 열었을 때와 열어 둔 동안 장날이 지나면 그 사이 일을 보여 준다 (시즌이 끝났으면 결산)
  away(game.catchUp(now()));
  setInterval(() => {
    if (game.seasonOver) return render();
    const s = game.catchUp(now());
    if (s) away(s);
    else render();
  }, CLOCK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !game.seasonOver) away(game.catchUp(now()));
  });
}
