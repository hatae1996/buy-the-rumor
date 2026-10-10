// 돈을 내고 듣는 소식: 여관에서 술 한 잔(소문 하나 더), 전서구(먼 마을 오늘 시세, 다음 날 도착).
// 0.1.6: 크림색 쪽지. 술 한 잔은 소식 탭과 같은 소문 카드(바로 수첩에 기록), 전서구는 마을마다 한 줄.
import innkeeper from '../../../assets/ui/innkeeper.png';
import pigeonImg from '../../../assets/ui/inn_pigeon.png';
import houseThere from '../../../assets/ui/house_blue.png';
import { euro } from '../../sim/josa';
import { ERROR_TEXT, agoText, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';
import { bindRumors, rumorCard } from './newsRumors';

/** 술 한 잔을 사고, 들은 이야기를 바로 보여 준다 (수첩에 기록하면 카드가 바뀐다) */
export function buyDrink(game: Game): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  // 들은 이야기는 먼저 "최근 들은 이야기"(적을지 고르는 중)에 들어오고, 수첩에 기록하면 수첩으로 옮겨 간다
  const all = () => {
    const v = game.view();
    return [...v.recentHeard.map((n) => ({ n, fresh: true })), ...v.rumors.map((n) => ({ n, fresh: false }))];
  };
  const before = new Set(all().map((x) => x.n.id));
  const r = game.dispatch({ type: 'buyDrink' });
  const heardIds = r.ok ? all().filter((x) => !before.has(x.n.id)).map((x) => x.n.id) : [];
  let unsub = () => {};
  const sheet = openSheet('술 한 잔', () => unsub());
  const render = () => {
    const v = game.view();
    const heard = all().filter((x) => heardIds.includes(x.n.id));
    sheet.body.innerHTML = `<div class="sk">
      <div class="sk-talk"><img src="${innkeeper}" alt="" /><p>${r.ok ? (heard.length ? '술 한 잔을 사자 옆자리 여행자가 입을 열었어요.' : '여행자가 이야기를 했지만 이미 아는 이야기였어요.') : '여관이 조용해요.'}</p></div>
      ${
        r.ok
          ? heard.length
            ? `<section class="rumor-list"><ul>${heard.map((x) => rumorCard(x.n, v, townName, x.fresh)).join('')}</ul></section>`
            : ''
          : `<p class="error">${ERROR_TEXT[r.error]}</p>`
      }
      <button type="button" class="cv-btn grey" data-ok>확인</button>
    </div>`;
    bindRumors(sheet.body, game, render);
    sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
  };
  unsub = game.subscribe(render);
  render();
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
        return `<li class="sk-row${flying ? ' on' : ''}">
          <div class="sk-row-main">
            <span class="sk-pic"><img src="${houseThere}" alt="" /></span>
            <span class="sk-text"><b>${t.name}</b><small>${seen ? `마지막으로 본 시세: ${agoText(v.day, seen.day)}` : '시세를 본 적이 없어요'}</small></span>
            ${
              flying
                ? '<span class="sk-chip teal">날아가는 중<br />내일 도착</span>'
                : `<button type="button" class="sk-btn" data-to="${t.id}" ${v.gold < v.pigeon.fee ? 'disabled' : ''}>보내기<small>${money(v.pigeon.fee)} G</small></button>`
            }
          </div>
        </li>`;
      })
      .join('');
    sheet.body.innerHTML = `<div class="sk">
      <p class="sk-strip"><img src="${pigeonImg}" alt="" /><span><b>먼 마을 하나의 오늘 시세</b><small>전서구가 적어 와요. 장날이 지나면 도착해요.</small></span></p>
      <ul class="sk-list">${rows}</ul>
      ${sent !== null ? `<p class="sk-done">${euro(game.map.towns[sent]!.name)} 전서구를 날려 보냈어요.</p>` : ''}
      ${error ? `<p class="error">${error}</p>` : ''}
    </div>`;
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
