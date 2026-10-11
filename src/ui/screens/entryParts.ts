// 들어가는 화면(앱 안 브라우저 안내, 로그인)이 함께 쓰는 조각 (0.2.1 목업 docs/reference/entry-mockup-0.2.1.png)
import '../entry.css';
import sprig from '../../../assets/ui/orn_sprig_l.png';

/** 상호와 양옆 잎. big이면 두 줄 큰 글자 */
export function entryBrand(big: boolean): string {
  const word = big ? 'Buy<br />the Rumor' : 'Buy the Rumor';
  return `<div class="entry-brand${big ? ' big' : ''}"><img src="${sprig}" alt="" /><h1 class="entry-wordmark">${word}</h1><img class="flip" src="${sprig}" alt="" /></div>`;
}

/** 작은 세로 상호 (Buy / the / Rumor)와 양옆 장식 줄 (대기 화면, 0.2.1 목업) */
export const entryBrandStack = (): string =>
  '<div class="entry-brand stack"><span class="entry-flourish"></span><h1 class="entry-wordmark"><span>Buy</span><small>the</small><span>Rumor</span></h1><span class="entry-flourish flip"></span></div>';

/** 잎 하나와 양옆 줄 */
export const entryLeaf = (): string => `<span class="entry-leaf"><img src="${sprig}" alt="" /></span>`;

/** 바깥 브라우저로 나가는 표시 */
export const ICON_EXTERNAL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

/** 편지 봉투 */
export const ICON_MAIL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="currentColor"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="var(--coral)" stroke-width="1.8" stroke-linejoin="round"/></svg>';

/** 모래시계 (선) */
export const ICON_HOURGLASS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/><path d="M9.5 18.5h5L12 16z" fill="currentColor"/></svg>';

/** 다시 확인 (둥근 화살표) */
export const ICON_REFRESH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>';

/** 사파리 나침반 */
export const ICON_SAFARI =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="#d2594b"/><path d="M8.5 15.5l2-5 3 3z" fill="currentColor"/></svg>';
