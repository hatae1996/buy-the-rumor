// 말 그림과 이름 (0.1.7 답 130, 0.2.1 말 키트): 종류 × 털색 × 무늬마다 미리 그린 그림 한 장
// (assets/horse/<종류>_<털색>_<무늬>.png, npm run horses가 기획자의 말 키트 assets-src/horse-kit/로 만든다).
// 종류는 늙은 조랑말·짐말·빠른 말이 각자 몸 그림이고, 털색과 무늬는 말마다 세계 시드로 정한다(coat.ts).
// 그림이 없으면 점선 빈칸에 털색 점만 찍는다. 이름은 장부 "인력·말"과 마구간에서 지어 준다.
import './parts.css';
import { COATS, HORSE_NAME_LENGTH, MARKINGS } from '../sim/horses';
import type { PlayerView } from '../sim/economy';
import { ERROR_TEXT } from './format';
import type { Game } from './game';

type HorseLike = Pick<PlayerView['horses'][number], 'id' | 'kind' | 'name' | 'coat' | 'marking' | 'horseName' | 'named'>;

const FILES = import.meta.glob<string>('../../assets/horse/*.png', { eager: true, query: '?url', import: 'default' });
const ART = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

/** 그림 자리: 그림이 있으면 그 말 그림, 없으면 점선 빈칸에 털색 점 */
export function horsePicHtml(h: HorseLike): string {
  const label = `${COATS[h.coat].name} ${h.name}`;
  const art = ART.get(`${h.kind}_${h.coat}_${h.marking}`);
  if (art) return `<span class="people-pic horse-pic" aria-label="${label}"><img class="horse-art" src="${art}" alt="" /></span>`;
  return `<span class="people-pic empty horse-pic" aria-label="${label}"><span class="horse-coat big" style="--coat:${COATS[h.coat].hex}"></span></span>`;
}

/** 이름 줄: 이름(누르면 짓기)과 종류 · 털색 · 무늬 */
export function horseNameHtml(h: HorseLike): string {
  const marks = h.marking === 'none' ? '' : ` · ${MARKINGS[h.marking]}`;
  return `<span class="horse-name" data-horse-name="${h.id}">
      <b>${h.horseName}</b>
      <button type="button" class="link-btn horse-rename" data-rename-horse="${h.id}">이름 짓기</button>
      <small><span class="horse-coat" style="--coat:${COATS[h.coat].hex}"></span> ${h.name} · ${COATS[h.coat].name}${marks}</small>
    </span>`;
}

/** "이름 짓기"를 누르면 그 자리에 이름 칸을 연다. 빈칸으로 저장하면 기본 이름으로 돌아간다 */
export function bindHorses(el: HTMLElement, game: Game): void {
  el.querySelectorAll<HTMLButtonElement>('[data-rename-horse]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = Number(b.dataset.renameHorse);
      const holder = el.querySelector<HTMLElement>(`[data-horse-name="${id}"]`)!;
      const now = holder.querySelector('b')!.textContent ?? '';
      holder.innerHTML = `<form class="horse-name-form">
          <input type="text" maxlength="${HORSE_NAME_LENGTH[1]}" value="${now.replace(/"/g, '&quot;')}" aria-label="말 이름" />
          <button type="submit" class="order-btn">저장</button>
        </form>
        <small class="horse-name-note">${HORSE_NAME_LENGTH[0]}~${HORSE_NAME_LENGTH[1]}글자. 비우면 처음 이름으로 돌아가요.</small>`;
      const input = holder.querySelector('input')!;
      input.focus();
      input.select();
      holder.querySelector('form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await game.dispatch({ type: 'nameHorse', horseId: id, name: input.value });
        if (!r.ok) holder.querySelector('.horse-name-note')!.textContent = ERROR_TEXT[r.error];
      });
    }),
  );
}
