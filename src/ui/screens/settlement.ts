// 시즌 결산 페이지 (기획서 "시즌 흐름 3", 0.1.6 목업 docs/reference/settlement-mockup-0.1.6.png): 시즌 마지막 장날 뒤.
// 이번 시즌의 보상(새 칭호와 인장) → 내 순위 → 시즌 리포트(최고 거래, 믿었던 소문꾼, 맞힌 소문, 다닌 길, 순자산) → 다음 시즌에는.
// "다음 시즌 시작"을 누르면 새 시드로 새 세계가 열린다 (질문 89 답). 증서, 인장, 칭호, 연차만 남는다.
import villageImg from '../../../assets/ui/village.png';
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import sealImg from '../../../assets/ui/settle_seal.png';
import trophyImg from '../../../assets/ui/rank_trophy.png';
import coinsImg from '../../../assets/ui/coins_stack.png';
import talkImg from '../../../assets/ui/icon_talk.png';
import scrollImg from '../../../assets/ui/plan_scroll.png';
import signImg from '../../../assets/ui/icon_signpost.png';
import sackImg from '../../../assets/ui/coins_sack.png';
import mapImg from '../../../assets/ui/tab_map.png';
import type { RankingCategoryView, SettlementView } from '../../sim/economy';
import { goodName, money } from '../format';
import type { Game } from '../game';
import { openPage } from '../page';
import { openCertificate } from './certificate';
import { emblemSvg } from '../emblem';
import { portraitHtml } from '../portrait/portrait';

const ICON = {
  chart: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 20v-6h3v6zM10.5 20V9h3v11zM17 20V4h3v16z" fill="currentColor"/></svg>`,
  sprout: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 21v-8M12 13c0-5-4-8-9-8 0 5 4 8 9 8zM12 11c0-4 3-7 9-7 0 4-3 7-9 7z" fill="#3e8f6a" stroke="#2d6e51" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  keep: `<svg viewBox="0 0 32 20" width="34" height="22" aria-hidden="true"><path d="M16 10c-3-4-5.5-6-8.5-6a6 6 0 0 0 0 12c3 0 5.5-2 8.5-6s5.5-6 8.5-6a6 6 0 0 1 0 12c-3 0-5.5-2-8.5-6z" fill="none" stroke="currentColor" stroke-width="3.2"/></svg>`,
  renew: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M19 8a8 8 0 0 0-14 1M5 16a8 8 0 0 0 14-1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M20 3v6h-6M4 21v-6h6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cert: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 3h12v14H6zM4 17h16v4H4z" fill="currentColor"/><path d="M9 7h6M9 10h6M9 13h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  play: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>`,
};

const share = (s: number) => `상위 ${Math.max(1, Math.round(s * 100))}%`;

/** 이번 시즌의 보상: 새 칭호(첫째는 크게)와 새 인장 */
function rewardHtml(st: SettlementView): string {
  const [main, ...more] = st.titles;
  const chips = [...more, ...st.badges].map((t) => `<span class="settle-chip">${t}</span>`).join('');
  if (!main && !st.badges.length)
    return `<div class="settle-reward none"><img src="${sealImg}" alt="" /><div><b>새로 받은 것이 없어요</b><small>다음 시즌에 순위에 오르면 인장과 칭호를 받아요.</small></div></div>`;
  return `<div class="settle-reward"><img src="${sealImg}" alt="" /><div>
      <small>${main ? '새 칭호' : '새 인장'}</small>
      ${main ? `<b>${main}</b>` : ''}
      ${chips ? `<p class="settle-chips">${chips}</p>` : ''}
    </div></div>`;
}

/** 내 순위: 가장 높이 오른 부문을 크게, 나머지는 줄로 */
function rankHtml(categories: readonly RankingCategoryView[]): string {
  const mine = categories.filter((c) => c.mine).sort((a, b) => a.mine!.rank - b.mine!.rank || a.mine!.topShare - b.mine!.topShare);
  const [top, ...rest] = mine;
  if (!top) return `<div class="settle-rank none"><img src="${trophyImg}" alt="" /><div><b>순위에 오른 부문이 없어요</b><small>사고팔아 이익을 남기면 순위에 올라요.</small></div></div>`;
  return `<div class="settle-rank"><img src="${trophyImg}" alt="" /><div>
      <b>${top.name} ${top.mine!.rank}위</b>
      <span>전체 ${top.count}명 중 · ${share(top.mine!.topShare)}</span>
      ${top.world.mine ? `<em>${ICON.globe}내 세계 ${top.world.mine.rank}위 / ${top.world.count}명</em>` : ''}
    </div></div>
    ${
      rest.length
        ? `<ul class="settle-more">${rest
            .map((c) => `<li><span>${c.name}</span><b>${c.mine!.rank}위</b><small>${c.count}명 중 · ${share(c.mine!.topShare)}</small></li>`)
            .join('')}</ul>`
        : ''
    }`;
}

function reportHtml(game: Game, st: SettlementView): string {
  const r = st.report;
  if (!r) return '<p class="cv-muted">이번 시즌 리포트가 없어요.</p>';
  const town = (id: number) => game.map.towns[id]!.name;
  const best = r.bestTrade
    ? `${r.bestTrade.day}일째 ${town(r.bestTrade.town)}에서 ${goodName(r.bestTrade.good)} ${r.bestTrade.qty}개를 개당 ${money(r.bestTrade.price)}골드에 팔아 <b class="plus">+${money(r.bestTrade.profit)}골드</b>`
    : '이익을 남긴 거래가 없어요.';
  const row = (img: string, title: string, text: string) => `<li><img src="${img}" alt="" /><div><h4>${title}</h4><p>${text}</p></div></li>`;
  return `<ul class="settle-report">
    ${row(coinsImg, '내 최고 거래', best)}
    ${row(talkImg, '가장 믿었던 소문꾼', r.trustedGossip ? `${r.trustedGossip.name} · 맞았다 ${r.trustedGossip.right}번` : '아직 기록이 없어요.')}
    ${row(scrollImg, '맞힌 소문', `확인된 소문 ${r.rumorsRight}개`)}
    ${row(signImg, '다닌 길', `<span class="settle-trip"><span>방문 마을 ${r.towns}곳</span><span>출발 ${r.trips}번</span><span>이동 ${r.roadDays}일</span></span>`)}
    <li class="worth"><img src="${sackImg}" alt="" /><div><h4>시즌 끝 순자산</h4><p class="settle-worth"><b>${money(r.worth)}골드</b><small>${ICON.lock}나에게만 보여요</small></p></div></li>
  </ul>`;
}

export function openSettlement(game: Game, onNextSeason: () => void): void {
  const st = game.view().settlement;
  if (!st) return;
  const me = game.view().certificate;
  const page = openPage({ back: '마을', title: `${st.season}시즌 결산` });
  page.el.classList.add('settle-page');
  page.body.innerHTML = `
    <header class="settle-hero" style="--village: url(${villageImg})">
      <img src="${sprigL}" alt="" />
      <div><h2>${st.season}시즌 결산</h2><small>이번 장사를 돌아볼 시간</small></div>
      <img src="${sprigR}" alt="" />
      <button type="button" class="settle-close" data-close aria-label="닫기">✕</button>
    </header>
    <section class="cv-card settle-card">
      <h3 class="settle-h">${ICON.sprout}이번 시즌의 보상</h3>
      ${rewardHtml(st)}
    </section>
    <section class="cv-card settle-card">
      <h3 class="settle-h"><img src="${trophyImg}" alt="" />내 순위<small>같은 시즌의 모든 세계 기준</small></h3>
      <div class="settle-me">${portraitHtml(me.face, 56, '내 얼굴')}${emblemSvg(me.emblem, 44)}<b>${me.name}</b></div>
      ${rankHtml(st.categories)}
      <p class="cv-muted">시즌 전체 순위로 인장과 칭호를 받아요.</p>
    </section>
    <section class="cv-card settle-card">
      <h3 class="settle-h"><span class="settle-h-svg">${ICON.chart}</span>시즌 리포트</h3>
      ${reportHtml(game, st)}
    </section>
    <section class="cv-card settle-card">
      <h3 class="settle-h">${ICON.sprout}다음 시즌에는</h3>
      <div class="settle-next">
        <ul>
          <li><span>${ICON.keep}</span><div><b>그대로 이어져요</b><small>상단 이름 · 상인 번호 · 얼굴 · 문장 · 인장 · 칭호 · 연차</small></div></li>
          <li><span>${ICON.renew}</span><div><b>새로 시작해요</b><small>지도 · 시작 마을 · 골드 · 짐 · 말 · 일꾼 · 창고 · 시세 · 소문</small></div></li>
        </ul>
        <img src="${mapImg}" alt="" />
      </div>
      <p class="cv-muted">새 지도와 새 마을에서 다시 출발해요. 상단 이름은 지금, 다음 시즌을 시작하기 전에 상인 증서에서 바꿀 수 있어요.</p>
      <div class="settle-btns">
        <button type="button" class="settle-cert" data-cert>${ICON.cert}상인 증서</button>
        <button type="button" class="cv-btn coral" data-next>${ICON.play}다음 시즌 시작</button>
      </div>
    </section>`;
  page.body.querySelector('[data-close]')!.addEventListener('click', () => page.close());
  page.body.querySelector('[data-cert]')!.addEventListener('click', () => openCertificate(game));
  page.body.querySelector('[data-next]')!.addEventListener('click', () => {
    page.close();
    onNextSeason();
  });
}
