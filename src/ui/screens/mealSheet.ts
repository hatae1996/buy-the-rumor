// 음식 먹기 쪽지: 짐에 있는 음식 중 하나를 골라 먹는다. 신선할수록 피로가 많이 준다.
import { ECONOMY } from '../../sim/constants';
import { count, FOODS, mealRecovery } from '../../sim/economy';
import { ERROR_TEXT, freshness, goodName } from '../format';
import type { Game } from '../game';
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
        return `<li class="row meal-row">
          <span>${goodName(g)} ${count(v.cargo, g)}개 <span class="chip ${f.level}">${f.text}</span></span>
          <button type="button" class="secondary-btn" data-eat="${g}">먹기<small>피로 −${mealRecovery(lot, rate)}</small></button>
        </li>`;
      })
      .join('');
    sheet.body.innerHTML = `
      <p class="muted">피로 ${v.fatigue} / ${v.fatigueMax} · 오늘 ${v.mealsLeft}끼 더 먹을 수 있어요.</p>
      <ul class="list">${rows || '<li class="muted">짐에 먹을 것이 없어요. 시장에서 사 두세요.</li>'}</ul>
      ${error ? `<p class="error">${error}</p>` : ''}`;
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
