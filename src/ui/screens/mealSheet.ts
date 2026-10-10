// 음식 먹기 쪽지: 짐에 있는 음식 중 하나를 골라 먹는다. 신선할수록 피로가 많이 준다.
// 0.1.6: 크림색 쪽지. 위에 피로 막대와 남은 끼니, 음식마다 그림과 신선도, 먹기 단추.
import breadImg from '../../../assets/ui/icon_bread.png';
import { ECONOMY } from '../../sim/constants';
import { count, FOODS, mealRecovery } from '../../sim/economy';
import { ERROR_TEXT, freshness, goodName } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openSheet } from '../sheet';

export function openMealSheet(game: Game): void {
  const sheet = openSheet('음식 먹기');
  let error = '';

  const render = () => {
    const v = game.view();
    const rate = ECONOMY.spoilRate[v.season];
    const foods = FOODS.filter((g) => count(v.cargo, g) > 0);
    const rows = foods
      .map((g) => {
        // 가장 먼저 상할 것부터 먹는다
        const lot = v.cargo.filter((l) => l.good === g).reduce((a, l) => (l.age > a.age ? l : a));
        const f = freshness(lot, rate);
        const art = itemArt(g);
        return `<li class="sk-row">
          <div class="sk-row-main">
            <span class="sk-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
            <span class="sk-text"><b>${goodName(g)} <em>${count(v.cargo, g)}개</em></b><span class="sk-chip fresh-${f.level}">${f.text}</span></span>
            <button type="button" class="sk-btn coral" data-eat="${g}" ${v.mealsLeft > 0 ? '' : 'disabled'}>먹기<small>피로 −${mealRecovery(lot, rate)}</small></button>
          </div>
        </li>`;
      })
      .join('');
    const share = v.fatigueMax ? Math.round((v.fatigue / v.fatigueMax) * 100) : 0;
    sheet.body.innerHTML = `<div class="sk">
      <div class="sk-gauge">
        <img src="${breadImg}" alt="" />
        <span><small>피로</small><i class="sk-bar"><i style="width:${share}%"></i></i></span>
        <b>${v.fatigue} / ${v.fatigueMax}</b>
        <span class="sk-chip">오늘 ${v.mealsLeft}끼 더</span>
      </div>
      <ul class="sk-list">${rows || '<li class="sk-empty">짐에 먹을 것이 없어요. 시장에서 사 두세요.</li>'}</ul>
      <p class="sk-note">신선한 음식일수록 피로가 많이 풀려요. 먼저 상할 것부터 먹어요.</p>
      ${error ? `<p class="error">${error}</p>` : ''}
    </div>`;
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-eat]').forEach((b) =>
      b.addEventListener('click', () => {
        const good = b.dataset.eat as (typeof FOODS)[number];
        const r = game.dispatch({ type: 'eat', good });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        if (r.ok && (game.view().fatigue === 0 || game.view().mealsLeft === 0)) {
          sheet.close();
          return;
        }
        render();
      }),
    );
  };
  render();
}
