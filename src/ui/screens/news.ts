// 소식: 신문(큰 사건, 사실만)과 다른 마을 시세 기억(본 날짜와 함께).
import sealSmall from '../../../assets/ui/seal_small.png';
import { GOODS, type PlayerView } from '../../sim/economy';
import { agoText, goodName } from '../format';
import type { Game } from '../game';

export function renderNews(el: HTMLElement, game: Game, v: PlayerView): void {
  const today = v.day;
  const items = [...v.news].reverse().slice(0, 30);
  const paper = items.length
    ? items.map((n) => `<li><span class="day">${agoText(today, n.day)}</span> ${n.text}</li>`).join('')
    : '<li class="muted">아직 큰 소식이 없어요.</li>';

  const here = v.location.kind === 'town' ? v.location.town : null;
  const towns = game.map.towns
    .map((t) => {
      const mem = v.memory[t.id];
      const head = `<header class="card-head"><h3>${t.name}</h3><span class="badge">${
        here === t.id ? '지금 여기' : mem ? `${agoText(today, mem.day)} 본 시세` : '가 본 적 없음'
      }</span></header>`;
      if (!mem) return `<div class="memory">${head}<p class="muted">직접 가 보거나 소문을 들어야 알 수 있어요.</p></div>`;
      const cells = GOODS.map((g) => `<span><span class="muted">${goodName(g)}</span> ${mem.prices[g]}</span>`).join('');
      return `<div class="memory">${head}<div class="memory-prices">${cells}</div></div>`;
    })
    .join('');

  el.innerHTML = `
    <section class="card newspaper">
      <img class="seal" src="${sealSmall}" alt="" />
      <h2>장터 신문</h2>
      <p class="muted">${today}일째 · 사실만 실어요</p>
      <ul class="list news-list">${paper}</ul>
    </section>
    <section class="card">
      <h2>내가 아는 시세</h2>
      <p class="muted">다른 마을 시세는 마지막으로 본 날의 값이에요. 지금은 달라졌을 수 있어요.</p>
      ${towns}
    </section>`;
}
