// 소식 탭 "신문" (0.1.6 목업 docs/reference/news-paper-mockup-0.1.6.png).
// 구입할 신문(이 마을 신문팔이의 오늘 신문)과 내 신문(산 신문, 전체·안 읽음, 최근순·오래된순).
import paperImg from '../../../assets/ui/tab_news.png';
import coinImg from '../../../assets/ui/coin.png';
import pinImg from '../../../assets/ui/icon_pin.png';
import infoImg from '../../../assets/ui/icon_info.png';
import type { PlayerView } from '../../sim/economy';
import { money } from '../format';
import type { Game } from '../game';
import { openNewsboy, openPaper } from './newspaper';

let unreadOnly = false;
let newestFirst = true;

export function paperHtml(game: Game, v: PlayerView): string {
  const np = v.newspaper;
  const here = v.location.kind === 'town' ? game.map.towns[v.location.town]!.name : null;
  const sale = np.onSale;
  const price = np.free ? '견습 동안 무료' : `${money(np.fee)}냥`;
  const buy = !here
    ? '<p class="paper-buy-note">길 위에서는 신문을 살 수 없어요. 마을에 닿으면 신문팔이에게 사요.</p>'
    : sale === null
      ? '<p class="paper-buy-note">이 마을에는 아직 오늘 신문이 오지 않았어요.</p>'
      : `<div class="paper-buy">
          <img src="${paperImg}" alt="" />
          <div>
            <span class="paper-chip ${sale.bought ? 'read' : ''}">${sale.bought ? '구입함' : '미구입'}</span>
            <h4>${sale.day}일째 신문${np.late ? ' <small>(하루 늦게 오는 마을)</small>' : ''}</h4>
            <span class="paper-price"><img src="${coinImg}" alt="" />${price}</span>
            <small>${sale.bought ? '내 신문에서 읽을 수 있어요.' : '구입한 뒤 내용을 읽을 수 있어요.'}</small>
          </div>
        </div>
        <button type="button" class="rumor-note paper-go" data-newsboy>신문팔이에게 가기</button>`;

  const all = np.papers;
  const unread = all.filter((p) => !p.read);
  const list = (unreadOnly ? unread : all).slice().sort((a, b) => (newestFirst ? b.day - a.day : a.day - b.day));
  const rows =
    list
      .map(
        (p) => `<li>
          <img src="${paperImg}" alt="" />
          <span class="paper-row-text">
            <b>${p.day}일째 신문</b>
            <small>${p.headline}</small>
            <span class="paper-chip ${p.read ? 'read' : 'unread'}">${p.read ? '읽음' : '안 읽음'}</span>
          </span>
          <button type="button" class="paper-read" data-paper="${p.day}">${p.read ? '다시 읽기' : '읽기'} ›</button>
        </li>`,
      )
      .join('') ||
    `<p class="rumor-empty">${all.length ? '안 읽은 신문이 없어요.' : '아직 산 신문이 없어요.'}</p>`;

  return `
    <section class="paper-card">
      <div class="paper-card-head"><h3>구입할 신문</h3>${here ? `<span class="paper-where"><img src="${pinImg}" alt="" />${here}</span>` : ''}</div>
      ${buy}
    </section>
    <section class="paper-card">
      <div class="paper-card-head"><h3>내 신문</h3><span>보관 중 ${all.length}부</span></div>
      <div class="paper-filters">
        <button type="button" data-paper-filter="all" aria-pressed="${!unreadOnly}">전체<span class="rumor-count">${all.length}</span></button>
        <button type="button" data-paper-filter="unread" aria-pressed="${unreadOnly}">안 읽음<span class="rumor-count">${unread.length}</span></button>
        <button type="button" class="paper-sort" data-paper-sort>${newestFirst ? '최근순' : '오래된순'} ⌄</button>
      </div>
      ${list.length ? `<ul class="paper-list">${rows}</ul>` : rows}
    </section>
    <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />구입한 신문은 언제든 다시 읽을 수 있어요. 지난 신문은 한 부 ${money(np.backFee)}냥이에요.</p>`;
}

export function bindPaper(el: HTMLElement, game: Game, rerender: () => void): void {
  el.querySelector('[data-newsboy]')?.addEventListener('click', () => openNewsboy(game));
  el.querySelectorAll<HTMLButtonElement>('[data-paper]').forEach((b) => b.addEventListener('click', () => openPaper(game, Number(b.dataset.paper))));
  el.querySelectorAll<HTMLButtonElement>('[data-paper-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      unreadOnly = b.dataset.paperFilter === 'unread';
      rerender();
    }),
  );
  el.querySelector('[data-paper-sort]')?.addEventListener('click', () => {
    newestFirst = !newestFirst;
    rerender();
  });
}
