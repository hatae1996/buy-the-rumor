// 말 그림 자리와 이름 (0.1.7 답 130): 종류마다 몸 그림 하나, 털색과 무늬는 말마다 (시드).
// 그림(assets/horse/, npm run parts)이 있으면 몸 그림의 털·갈기 영역을 털색으로 바꾸고(초상과 같은 recolor) 무늬를 덮는다.
// 그림이 오기 전에는 점선 빈칸에 털색 점만 찍는다. 이름은 장부 "인력·말"과 마구간에서 지어 준다.
import './parts.css';
import { COATS, HORSE_NAME_LENGTH, MARKINGS, type CoatId, type MarkingId } from '../sim/horses';
import type { HorseKind } from '../sim/horses';
import type { PlayerView } from '../sim/economy';
import type { Rgb } from '../sim/looks';
import { ERROR_TEXT } from './format';
import type { Game } from './game';
import { recolor } from './portrait/recolor';

type HorseLike = Pick<PlayerView['horses'][number], 'id' | 'kind' | 'name' | 'coat' | 'marking' | 'horseName' | 'named'>;

const FILES = import.meta.glob<string>('../../assets/horse/*.png', { eager: true, query: '?url', import: 'default' });
const ART = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

/** 갈기·꼬리 색 (털색마다, 초안) */
const MANE: Record<CoatId, Rgb> = {
  chestnut: [92, 46, 26],
  bay: [36, 28, 24],
  black: [24, 21, 20],
  gray: [72, 72, 74],
  cream: [236, 226, 200],
};

const hexRgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** 그림 자리: 그림이 있으면 캔버스(bindHorses가 칠한다), 없으면 점선 빈칸에 털색 점 */
export function horsePicHtml(h: HorseLike): string {
  const label = `${COATS[h.coat].name} ${h.name}`;
  if (ART.has(`horse_${h.kind}`) && ART.has(`horse_${h.kind}_reg`)) {
    return `<span class="people-pic horse-pic" aria-label="${label}"><canvas class="horse-art" width="256" height="256" data-kind="${h.kind}" data-coat="${h.coat}" data-marking="${h.marking}"></canvas></span>`;
  }
  return `<span class="people-pic empty horse-pic" aria-label="${label}"><span class="horse-coat big" style="--coat:${COATS[h.coat].hex}"></span></span>`;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
function image(name: string): Promise<HTMLImageElement | null> {
  let p = images.get(name);
  if (!p) {
    const url = ART.get(name);
    p = url
      ? new Promise((done) => {
          const img = new Image();
          img.onload = () => done(img);
          img.onerror = () => done(null);
          img.src = url;
        })
      : Promise.resolve(null);
    images.set(name, p);
  }
  return p;
}

const painted = new Map<string, HTMLCanvasElement>();

/** 말 한 마리 그림: 몸 → 털·갈기 색 바꾸기 → 무늬 덮기 (256) */
async function paintHorse(kind: HorseKind, coat: CoatId, marking: MarkingId): Promise<HTMLCanvasElement | null> {
  const key = `${kind}|${coat}|${marking}`;
  const done = painted.get(key);
  if (done) return done;
  const [body, reg] = await Promise.all([image(`horse_${kind}`), image(`horse_${kind}_reg`)]);
  if (!body || !reg) return null;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  g.drawImage(reg, 0, 0, size, size);
  const regRgba = g.getImageData(0, 0, size, size).data;
  const regs = new Uint8Array(size * size);
  for (let i = 0; i < regs.length; i++) regs[i] = regRgba[i * 4]!;
  g.clearRect(0, 0, size, size);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(body, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size);
  recolor(px.data, regs, new Map([[1, hexRgb(COATS[coat].hex)], [2, MANE[coat]]]));
  g.putImageData(px, 0, 0);
  for (const m of marking === 'both' ? (['blaze', 'socks'] as const) : marking === 'none' ? [] : [marking]) {
    const layer = await image(`horse_${kind}_${m}`);
    if (layer) g.drawImage(layer, 0, 0, size, size);
  }
  painted.set(key, c);
  return c;
}

/** 붙은 말 캔버스를 칠한다 */
function paintAll(el: HTMLElement): void {
  el.querySelectorAll<HTMLCanvasElement>('canvas.horse-art:not([data-painted])').forEach((cv) => {
    cv.dataset.painted = '1';
    void paintHorse(cv.dataset.kind as HorseKind, cv.dataset.coat as CoatId, cv.dataset.marking as MarkingId).then((art) => {
      if (art) cv.getContext('2d')!.drawImage(art, 0, 0, cv.width, cv.height);
    });
  });
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

/** 말 그림을 칠하고, "이름 짓기"를 누르면 그 자리에 이름 칸을 연다. 빈칸으로 저장하면 기본 이름으로 돌아간다 */
export function bindHorses(el: HTMLElement, game: Game): void {
  paintAll(el);
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
      holder.querySelector('form')!.addEventListener('submit', (e) => {
        e.preventDefault();
        const r = game.dispatch({ type: 'nameHorse', horseId: id, name: input.value });
        if (!r.ok) holder.querySelector('.horse-name-note')!.textContent = ERROR_TEXT[r.error];
      });
    }),
  );
}
