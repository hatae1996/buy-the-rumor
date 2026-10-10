// 소식 탭 "길드" (0.1.6 목업 docs/reference/news-guild-mockup-0.1.6.png): 시즌 테마 머리, 개인 의뢰, 함께하는 목표.
// 의뢰 카드: 그림, 이름, 개인·공동 칩, 지금 값 / 금 문턱, 설명, 동·은·금 문턱에 눈금이 있는 막대.
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import infoImg from '../../../assets/ui/icon_info.png';
import type { PlayerView } from '../../sim/economy';
import { money } from '../format';
import { itemArt } from '../itemArt';

// 테마 문장(theme_<테마>.png)과 의뢰 그림(quest_<의뢰>.png). 없으면 납품 물품 그림
const FILES = import.meta.glob<string>('../../../assets/ui/{theme,quest}_*.png', { eager: true, query: '?url', import: 'default' });
const ART = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

const TIER_NAME: Record<string, string> = { bronze: '동', silver: '은', gold: '금' };

type Quest = PlayerView['guild']['quests'][number];

function questCard(q: Quest): string {
  const max = q.tiers[q.tiers.length - 1]!;
  const fill = Math.min(1, q.value / max) * 100;
  const art = ART.get(`quest_${q.id}`) ?? (q.goods[0] ? itemArt(q.goods[0]) : null);
  const ticks = q.tiers
    .map((t) => `<span class="quest-tick${q.value >= t ? ' done' : ''}" style="left:${(t / max) * 100}%"><i></i>${money(t)}</span>`)
    .join('');
  return `<li class="quest-card ${q.scope}">
      <span class="quest-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
      <div class="quest-body">
        <div class="quest-head">
          <b>${q.name}</b>
          <span class="quest-chip">${q.scope === 'communal' ? '공동' : '개인'}</span>
          ${q.tier ? `<span class="stamp right">${TIER_NAME[q.tier]}</span>` : ''}
          <span class="quest-value">${money(q.value)} / ${money(max)}</span>
        </div>
        <small>${q.text}</small>
        <div class="quest-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${q.value}">
          <span class="quest-fill" style="width:${fill}%"></span>
        </div>
        <div class="quest-ticks">${ticks}</div>
      </div>
    </li>`;
}

export function guildTabHtml(v: PlayerView): string {
  const g = v.guild;
  if (!g.theme) return '<p class="ledger-note">이번 시즌 테마가 아직 없어요.</p>';
  const emblem = g.themeId ? ART.get(`theme_${g.themeId}`) : undefined;
  const personal = g.quests.filter((q) => q.scope === 'personal');
  const communal = g.quests.filter((q) => q.scope === 'communal');
  return `
    <section class="guild-card">
      <header class="guild-theme">
        <img class="town-sprig" src="${sprigL}" alt="" />
        ${emblem ? `<img class="guild-emblem" src="${emblem}" alt="" />` : ''}
        <div><h3>${g.theme}</h3><small>길드 의뢰</small></div>
        <img class="town-sprig" src="${sprigR}" alt="" />
      </header>
      ${personal.length ? `<h4 class="acct-day">개인 의뢰</h4><ul class="quest-list">${personal.map(questCard).join('')}</ul>` : ''}
      ${communal.length ? `<h4 class="acct-day">함께하는 목표</h4><ul class="quest-list">${communal.map(questCard).join('')}</ul>` : ''}
    </section>
    <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />동·은·금 문턱을 넘으면 인장이 찍혀요. 공동 목표는 지금은 내 몫만 세요.</p>`;
}
