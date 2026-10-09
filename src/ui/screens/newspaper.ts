// 신문 (0.1.2 "신문은 마을에서 산다"): 마을 탭의 신문팔이에게서 그날 신문을 사고, 소식 탭 신문함에서 한 부씩 읽는다.
import sealSmall from '../../../assets/ui/seal_small.png';
import type { PlayerView } from '../../sim/economy';
import { agoText, ERROR_TEXT, money } from '../format';
import type { Game } from '../game';
import { openLiveSheet } from '../liveSheet';
import { openSheet } from '../sheet';

/** 신문 날짜: "9일째 장날" (몇 날 전인지 함께) */
export function paperDate(v: PlayerView, day: number): string {
  return `${day}일째 장날 신문 <small class="muted">${agoText(v.day, day)}</small>`;
}

/** 신문팔이 쪽지: 오늘 신문 사기 */
export function openNewsboy(game: Game): void {
  openLiveSheet(game, '신문팔이', (body, v, sheet) => {
    const np = v.newspaper;
    const sale = np.onSale;
    body.innerHTML = `
      <p class="muted">도시 신문사에서 찍은 장터 신문이에요. 큰 사건을 사실만 실어요. 길 위에서는 살 수 없어요.${
        np.late ? ' 이 마을은 도시에서 멀어 하루 늦은 신문이 와요.' : ''
      }</p>
      ${
        sale === null
          ? '<p>오늘은 실을 만한 소식이 없어 신문이 나오지 않았어요.</p>'
          : sale.bought
            ? `<p>${paperDate(v, sale.day)}은 이미 샀어요.</p>
               <div class="btn-row"><button type="button" class="secondary-btn" data-read="${sale.day}">읽기</button></div>`
            : `<p>오늘 파는 신문: ${paperDate(v, sale.day)}</p>
               <div class="btn-row"><button type="button" class="primary-btn" data-buy ${v.gold < np.fee ? 'disabled' : ''}>신문 사기 · ${np.free ? '견습 동안 무료' : money(np.fee)}</button></div>`
      }`;
    body.querySelector('[data-buy]')?.addEventListener('click', () => {
      if (sheet.send({ type: 'buyNewspaper' }) && sale) openPaper(game, sale.day);
    });
    body.querySelector<HTMLButtonElement>('[data-read]')?.addEventListener('click', (e) => openPaper(game, Number((e.currentTarget as HTMLElement).dataset.read)));
  });
}

/** 산 신문 한 부를 처음부터 끝까지 (읽음으로 적는다) */
export function openPaper(game: Game, day: number): void {
  const r = game.dispatch({ type: 'readPaper', day });
  const v = game.view();
  const lines = v.news.filter((n) => n.day === day).map((n) => n.text);
  const sheet = openSheet(`${day}일째 장날 신문`);
  sheet.body.innerHTML = r.ok
    ? `<article class="newspaper paper-issue">
        <img class="seal" src="${sealSmall}" alt="" />
        <h2>장터 신문</h2>
        <p class="muted">${day}일째 장날까지의 소식 · ${agoText(v.day, day)}</p>
        ${lines.length ? `<h3>${lines[0]}</h3>` : ''}
        <ul class="list news-list">${lines.slice(1).map((t) => `<li>${t}</li>`).join('')}</ul>
      </article>`
    : `<p class="error">${ERROR_TEXT[r.error]}</p>`;
}

/** 소식 탭의 신문함: 산 신문을 날짜순으로, 안 읽은 신문에 표시 */
export function paperBoxHtml(v: PlayerView): string {
  const np = v.newspaper;
  const rows = np.papers
    .slice(0, 20)
    .map(
      (p) => `<li><button type="button" class="paper-row" data-paper="${p.day}">
        ${p.read ? '' : '<span class="unread" aria-label="안 읽음"></span>'}
        <span><b>${p.day}일째</b> <small class="muted">${agoText(v.day, p.day)}</small><br />${p.headline}</span>
      </button></li>`,
    )
    .join('');
  return rows
    ? `<ul class="list paper-box">${rows}</ul>`
    : `<p class="muted">아직 산 신문이 없어요. 마을의 신문팔이에게서 그날 신문을 살 수 있어요 (한 부 ${money(np.fee)}${np.free ? ', 견습 동안 무료' : ''}).</p>`;
}
