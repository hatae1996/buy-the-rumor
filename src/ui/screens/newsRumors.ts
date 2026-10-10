// 소식 탭 "소문" (0.1.6 목업 docs/reference/news-rumors-mockup-0.1.6.png): 들은 이야기 수첩.
// 새로 들음(적을지 넘길지 고르는 중) / 기록 중(확인 기다림) / 확인 완료(맞았다·틀렸다·확인 못 함).
// 카드: 물품 그림, "마을 · 물품" 제목, 들은 문장, 언제·어디서·누구에게. 새로 들은 것은 수첩에 기록 / 넘기기.
import infoImg from '../../../assets/ui/icon_info.png';
import paperImg from '../../../assets/ui/tab_news.png';
import chevronImg from '../../../assets/ui/icon_chevron.png';
import { GOODS, type GoodId, type NoteView, type PlayerView } from '../../sim/economy';
import { agoText, goodName } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { stampHtml } from './noteItem';

export type RumorGroup = 'new' | 'noted' | 'done';
const GROUPS: { id: RumorGroup; label: string; title: string }[] = [
  { id: 'new', label: '새로 들음', title: '새로 들은 이야기' },
  { id: 'noted', label: '기록 중', title: '확인을 기다리는 이야기' },
  { id: 'done', label: '확인 완료', title: '확인이 끝난 이야기' },
];

/** 고른 칸과 물품 (다시 그려도 남긴다) */
let group: RumorGroup = 'new';
let goodFilter: GoodId | null = null;

/** 수첩(여관에서 듣고 적은 것)과 칸별 목록 */
function lists(v: PlayerView): Record<RumorGroup, NoteView[]> {
  const book = v.rumors.filter((n) => n.via === 'gossip' || n.via === 'inn');
  return {
    new: [...v.recentHeard].reverse(),
    noted: book.filter((n) => n.stamp === null).reverse(),
    done: book.filter((n) => n.stamp !== null).reverse(),
  };
}

function card(n: NoteView, v: PlayerView, townName: (id: number) => string, fresh: boolean): string {
  const art = n.good ? itemArt(n.good) : null;
  const title = [n.about !== null ? townName(n.about) : '', n.good ? goodName(n.good) : ''].filter(Boolean).join(' · ') || '소문';
  const foot = fresh
    ? `<div class="rumor-btns">
        <button type="button" class="rumor-note" data-note-rumor="${n.id}">수첩에 기록</button>
        ${n.dismissed ? '<span class="rumor-skipped">넘김</span>' : `<button type="button" class="rumor-skip" data-dismiss-rumor="${n.id}">넘기기</button>`}
      </div>`
    : '';
  return `<li class="rumor-card${n.dismissed ? ' dismissed' : ''}">
      <div class="rumor-main">
        <span class="rumor-pic"><img src="${art ?? paperImg}" alt="" /></span>
        <div class="rumor-text">
          <h4>${title}${fresh ? '' : stampHtml(n) || '<span class="rumor-wait">확인 기다림</span>'}</h4>
          <p>“${n.text.replace(/^["“]+|["”]+$/g, '')}”</p>
          <small>${agoText(v.day, n.day)} · ${townName(n.town)} · ${n.from}</small>
        </div>
      </div>
      ${foot}
    </li>`;
}

/** 소문꾼마다 받은 도장 수. 비율은 보여 주지 않고 도장만 센다 (기획서 "들은 이야기 수첩") */
function tellerStamps(notes: readonly NoteView[]): string {
  const by = new Map<string, { right: number; wrong: number }>();
  for (const n of notes) {
    // "확인 못 함"은 도장이 아니라 세지 않는다
    if (!n.stamp || n.stamp === 'unchecked' || n.via !== 'gossip') continue;
    const t = by.get(n.from) ?? { right: 0, wrong: 0 };
    t[n.stamp]++;
    by.set(n.from, t);
  }
  if (!by.size) return '';
  const rows = [...by]
    .map(
      ([name, t]) => `<li><span>${name}</span><span class="stamp-count">
        ${t.right ? `<span class="stamp right">맞았다 ${t.right}</span>` : ''}${t.wrong ? `<span class="stamp wrong">틀렸다 ${t.wrong}</span>` : ''}
      </span></li>`,
    )
    .join('');
  return `<section class="rumor-tellers"><h4>소문꾼 도장</h4><ul>${rows}</ul></section>`;
}

export function rumorsHtml(game: Game, v: PlayerView): string {
  const townName = (id: number) => game.map.towns[id]!.name;
  const all = lists(v);
  // 물품별 찾기 (기록 중·확인 완료)
  const goods = group === 'new' ? [] : GOODS.filter((g) => all[group].some((n) => n.good === g));
  if (goodFilter && !goods.includes(goodFilter)) goodFilter = null;
  const shown = all[group].filter((n) => group === 'new' || goodFilter === null || n.good === goodFilter).slice(0, 30);
  const empty = {
    new: '새로 들은 이야기가 없어요. 여관 소문꾼에게 들어 보세요.',
    noted: '확인을 기다리는 이야기가 없어요.',
    done: '아직 확인이 끝난 이야기가 없어요.',
  }[group];
  const unread = v.newspaper.papers.filter((p) => !p.read).length;
  const g = GROUPS.find((x) => x.id === group)!;

  return `
    <div class="rumor-groups" role="tablist" aria-label="소문">
      ${GROUPS.map(
        (x) => `<button type="button" role="tab" data-rumor-group="${x.id}" aria-pressed="${x.id === group}">${x.label}<span class="rumor-count">${all[x.id].length}</span></button>`,
      ).join('')}
    </div>
    <section class="rumor-list">
      <div class="rumor-list-head">
        <span>${g.title}</span>
        ${
          goods.length
            ? `<select data-rumor-good aria-label="물품으로 찾기"><option value="">모든 물품</option>${goods
                .map((x) => `<option value="${x}" ${x === goodFilter ? 'selected' : ''}>${goodName(x)}</option>`)
                .join('')}</select>`
            : ''
        }
      </div>
      ${shown.length ? `<ul>${shown.map((n) => card(n, v, townName, group === 'new')).join('')}</ul>` : `<p class="rumor-empty">${empty}</p>`}
    </section>
    ${group === 'done' ? tellerStamps(all.done) : ''}
    <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />${
      group === 'new' ? '적지 않은 이야기는 며칠 뒤 잊혀요. 기록한 소문은 신문이나 방문으로 확인해요.' : '기록한 소문은 신문이나 방문으로 확인해요.'
    }</p>
    ${
      unread
        ? `<button type="button" class="town-row price-others" data-news-tab="paper">
            <span class="town-row-pic"><img src="${paperImg}" alt="" /></span>
            <span class="town-row-text"><span class="town-row-name">읽지 않은 신문 ${unread}부</span></span>
            <img class="town-chevron" src="${chevronImg}" alt="" />
          </button>`
        : ''
    }`;
}

export function bindRumors(el: HTMLElement, game: Game, rerender: () => void): void {
  el.querySelectorAll<HTMLButtonElement>('[data-rumor-group]').forEach((b) =>
    b.addEventListener('click', () => {
      group = b.dataset.rumorGroup as RumorGroup;
      rerender();
    }),
  );
  el.querySelector<HTMLSelectElement>('[data-rumor-good]')?.addEventListener('change', (e) => {
    goodFilter = ((e.target as HTMLSelectElement).value || null) as GoodId | null;
    rerender();
  });
  el.querySelectorAll<HTMLButtonElement>('[data-note-rumor]').forEach((b) =>
    b.addEventListener('click', () => game.dispatch({ type: 'noteRumor', id: Number(b.dataset.noteRumor) })),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-dismiss-rumor]').forEach((b) =>
    b.addEventListener('click', () => game.dispatch({ type: 'dismissRumor', id: Number(b.dataset.dismissRumor) })),
  );
}
