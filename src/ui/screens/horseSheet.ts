// 마구간(말 사고팔기)과 수레방(수레 바꾸기) 쪽지 (기획서 "말").
// 말은 장날이 아니라 그 자리에서 사고판다. 마구간 남은 수는 그 마을에 와야만 보인다.
import type { HorseKindInfo, HorseView, PlayerView } from '../../sim/economy';
import { HORSES } from '../../sim/constants';
import { eulReul } from '../../sim/josa';
import { ERROR_TEXT, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';

/** 이동 일수 배율을 말로 */
export function speedWord(speed: number): string {
  if (speed < 0.75) return '빠름';
  if (speed < 1) return '조금 빠름';
  return '사람 걸음';
}

function kindLine(k: HorseKindInfo): string {
  return `끄는 무게 ${k.pull} · ${speedWord(k.speed)} · 하루 곡물 ${k.feed}`;
}

/** 말 피로 막대 (플레이어 피로와 같은 모양) */
export function horseFatigue(h: HorseView): string {
  const cells = Array.from({ length: h.fatigueMax }, (_, i) => `<i class="${i < h.fatigue ? 'on' : ''}"></i>`).join('');
  const word = h.hungry ? `${h.hungry}일째 굶었어요` : h.fatigue >= h.fatigueMax ? '다 지쳤어요' : h.tired ? '많이 지쳤어요' : h.fatigue ? '괜찮아요' : '쌩쌩해요';
  return `<div class="fatigue"><div class="fatigue-cells" aria-hidden="true">${cells}</div><span${h.hungry ? ' class="warn"' : ''}>${word}</span></div>`;
}

export function openStableSheet(game: Game): void {
  const sheet = openSheet('마구간');
  let error = '';
  let done = '';

  const render = () => {
    const v: PlayerView = game.view();
    const stable = v.stable;
    if (!stable) {
      sheet.close();
      return;
    }
    const full = v.horses.length >= HORSES.maxPerOwner;
    const buy = stable.horses
      .map(
        (k) => `<li class="row">
          <span><b>${k.name}</b> <span class="muted">${k.stock ? `${k.stock}마리 남음` : '없음'}</span><br /><small class="muted">${kindLine(k)}</small></span>
          <button type="button" class="secondary-btn" data-buy="${k.kind}" ${k.price === null || full || v.gold < k.price ? 'disabled' : ''}>
            사기<small>${k.price === null ? '남은 말 없음' : money(k.price)}</small>
          </button>
        </li>`,
      )
      .join('');
    const mine = v.horses
      .map(
        (h) => `<li class="row">
          <span><b>${h.name}</b><br /><small class="muted">${kindLine(h)}</small></span>
          <button type="button" class="secondary-btn" data-sell="${h.id}" ${h.sellPrice === null ? 'disabled' : ''}>
            되팔기<small>${h.sellPrice === null ? '' : money(h.sellPrice)}</small>
          </button>
        </li>`,
      )
      .join('');
    sheet.body.innerHTML = `
      <p class="muted">말은 시즌마다 정해진 수만 목장에서 나와요. 남은 수가 적을수록 비싸요. 한 사람 두 필까지.</p>
      <ul class="list">${buy}</ul>
      ${mine ? `<h3>내 말</h3><ul class="list">${mine}</ul>` : ''}
      ${done ? `<p>${done}</p>` : ''}
      ${error ? `<p class="error">${error}</p>` : ''}`;
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const kind = b.dataset.buy as HorseKindInfo['kind'];
        const r = game.dispatch({ type: 'buyHorse', kind });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        done = r.ok ? `${eulReul(stable.horses.find((k) => k.kind === kind)!.name)} 샀어요. 밤마다 마구간에서 먹여요.` : '';
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = game.dispatch({ type: 'sellHorse', horseId: Number(b.dataset.sell) });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        done = r.ok ? '말을 마구간에 돌려주었어요.' : '';
        render();
      }),
    );
  };
  render();
}

export function openCartShopSheet(game: Game): void {
  const sheet = openSheet('수레방');
  let error = '';

  const render = () => {
    const v = game.view();
    const rows = v.carts
      .map((c) => {
        const cells = c.rows.join('').split('').filter((x) => x === '#').length;
        const pull = c.horses ? `말 ${c.horses}필이 끌어요` : `사람이 ${c.humanPull}까지 끌어요`;
        return `<li class="row">
          <span><b>${c.name}</b> <span class="muted">${cells}칸</span><br /><small class="muted">${pull}</small></span>
          ${
            c.cost === null
              ? '<span class="badge">쓰는 중</span>'
              : `<button type="button" class="secondary-btn" data-cart="${c.type}" ${v.gold < c.cost ? 'disabled' : ''}>바꾸기<small>${money(c.cost)}</small></button>`
          }
        </li>`;
      })
      .join('');
    sheet.body.innerHTML = `
      <p class="muted">쓰던 수레는 절반 값으로 쳐 줘요. 짐은 새 수레에 옮겨 실어요. 무게는 끄는 말이 정해요.</p>
      <ul class="list">${rows}</ul>
      ${error ? `<p class="error">${error}</p>` : ''}`;
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-cart]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = game.dispatch({ type: 'buyCart', cart: b.dataset.cart as (typeof v.carts)[number]['type'] });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        if (r.ok) sheet.close();
        else render();
      }),
    );
  };
  render();
}
