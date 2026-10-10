// 소식 탭 (기획서 "화면 구성 - 소식 탭: 들어오는 것 전부", 0.0.5 → 0.1.6 목업): 작은 탭 4개.
// 소문(들은 이야기 수첩, newsRumors.ts) / 신문(사기와 내 신문, newsBox.ts) / 활동(보고와 순위, newsActivity.ts) / 길드(의뢰, newsGuild.ts).
// 크림 바탕에 신문 제목.
import paperIcon from '../../../assets/ui/tab_news.png';
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import type { PlayerView } from '../../sim/economy';
import type { Game } from '../game';
import { activityHtml, bindActivity } from './newsActivity';
import { bindPaper, paperHtml } from './newsBox';
import { guildTabHtml } from './newsGuild';
import { bindRumors, rumorsHtml } from './newsRumors';

type NewsTab = 'rumors' | 'paper' | 'reports' | 'guild';
const TABS: { id: NewsTab; label: string }[] = [
  { id: 'rumors', label: '소문' },
  { id: 'paper', label: '신문' },
  { id: 'reports', label: '활동' },
  { id: 'guild', label: '길드' },
];
/** 고른 작은 탭 (다시 그려도 남긴다) */
let tab: NewsTab = 'rumors';

export function renderNews(el: HTMLElement, game: Game, v: PlayerView): void {
  const bodies: Record<NewsTab, () => string> = {
    rumors: () => rumorsHtml(game, v),
    paper: () => paperHtml(game, v),
    reports: () => activityHtml(game, v),
    guild: () => guildTabHtml(v),
  };

  el.innerHTML = `
    <header class="ledger-head">
      <img class="town-sprig" src="${sprigL}" alt="" />
      <img class="ledger-book" src="${paperIcon}" alt="" />
      <div><h2>소식</h2><small>상인의 정보 수첩</small></div>
      <img class="town-sprig" src="${sprigR}" alt="" />
    </header>
    <div class="seg ledger-tabs" role="tablist" aria-label="소식">
      ${TABS.map((t) => `<button type="button" role="tab" data-news-tab="${t.id}" aria-pressed="${t.id === tab}" aria-selected="${t.id === tab}">${t.label}</button>`).join('')}
    </div>
    ${bodies[tab]()}`;

  const rerender = () => renderNews(el, game, game.view());
  el.querySelectorAll<HTMLButtonElement>('[data-news-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.newsTab as NewsTab;
      rerender();
    }),
  );
  if (tab === 'rumors') bindRumors(el, game, rerender);
  if (tab === 'paper') bindPaper(el, game, rerender);
  if (tab === 'reports') bindActivity(el, game, rerender);
}
