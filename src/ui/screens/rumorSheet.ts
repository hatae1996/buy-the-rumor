// 돈을 내고 듣는 소식: 여관에서 술 한 잔(소문 하나 더), 전서구(먼 마을 오늘 시세, 다음 날 도착).
import innkeeper from '../../../assets/ui/innkeeper.png';
import { euro } from '../../sim/josa';
import { ERROR_TEXT, agoText, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';
import { noteItem } from './noteItem';

/** 술 한 잔을 사고, 들은 이야기를 바로 보여 준다 */
export function buyDrink(game: Game): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const before = game.view().rumors.length;
  const r = game.dispatch({ type: 'buyDrink' });
  const v = game.view();
  const sheet = openSheet('여관');
  const heard = r.ok ? v.rumors.slice(before) : [];
  sheet.body.innerHTML = `
    <div class="away-head">
      <img src="${innkeeper}" alt="" />
      <p>${r.ok ? '술 한 잔을 사자 옆자리 여행자가 입을 열었어요.' : '여관이 조용해요.'}</p>
    </div>
    ${r.ok ? `<ul class="list">${heard.map((n) => noteItem(n, v.day, townName)).join('')}</ul>` : `<p class="error">${ERROR_TEXT[r.error]}</p>`}
    <button type="button" class="primary-btn" data-ok>확인</button>`;
  sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
}

export function openPigeonSheet(game: Game): void {
  const sheet = openSheet('전서구 보내기');
  let error = '';
  let sent: number | null = null;

  const render = () => {
    const v = game.view();
    if (v.location.kind !== 'town') {
      sheet.close();
      return;
    }
    const here = v.location.town;
    const rows = game.map.towns
      .filter((t) => t.id !== here)
      .map((t) => {
        const seen = v.memory[t.id];
        const flying = v.pigeon.pending.includes(t.id);
        return `<li class="row">
          <span>${t.name}<br /><small class="muted">${seen ? `마지막으로 본 시세: ${agoText(v.day, seen.day)}` : '시세를 본 적이 없어요'}</small></span>
          <button type="button" class="secondary-btn" data-to="${t.id}" ${flying || v.gold < v.pigeon.fee ? 'disabled' : ''}>
            ${flying ? '날아가는 중' : '보내기'}<small>${flying ? '내일 도착' : `${money(v.pigeon.fee)}`}</small>
          </button>
        </li>`;
      })
      .join('');
    sheet.body.innerHTML = `
      <p class="muted">먼 마을 하나의 오늘 시세를 적어 와요. 장날이 지나면 도착해요.</p>
      <ul class="list">${rows}</ul>
      ${sent !== null ? `<p>${euro(game.map.towns[sent]!.name)} 전서구를 날려 보냈어요.</p>` : ''}
      ${error ? `<p class="error">${error}</p>` : ''}`;
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-to]').forEach((b) =>
      b.addEventListener('click', () => {
        const to = Number(b.dataset.to);
        const r = game.dispatch({ type: 'sendPigeon', to });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        sent = r.ok ? to : null;
        render();
      }),
    );
  };
  render();
}
