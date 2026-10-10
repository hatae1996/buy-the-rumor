// NPC 초상 그리기 (기획서 "NPC 외모", 0.1.6 아바타 키트): 베이스 한 장에 파츠마다 색 바꾸기 → 그림자 곱하기 → 덮기 (layers.ts).
// 그림은 assets/portrait/ (npm run portraits가 키트에서 512로 만든다). 자리표시 그림은 쓰지 않는다.
// 화면은 portraitHtml()로 캔버스 자리만 넣고, watchPortraits()가 문서에 붙는 캔버스를 찾아 칠한다.
// 사파리 메모리: 겹치기는 작업 크기(작은 초상은 256)에서 하고, 다 그린 초상은 외모·크기마다 하나만 남긴다.
// 원본 그림은 픽셀을 꺼낸 뒤 놓아 준다.
import './portrait.css';
import { lookKey, PORTRAIT_GAME, type Look } from '../../sim/looks';
import { baseName, composeLook, lookParts, type PartPixels } from './layers';

const FILES = import.meta.glob<string>('../../../assets/portrait/**/*.png', { eager: true, query: '?url', import: 'default' });

/** 그림 이름(파일 이름에서 .png를 뺀 것: base_light, top_03, top_03_mul …) → 주소 */
const URL_OF = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

/** 작은 초상(시장 카드 등)은 256에서 겹친다. 그보다 크면 512 그대로 */
const SMALL_WORK = 256;
const workSize = (px: number): number => (px <= SMALL_WORK ? SMALL_WORK : PORTRAIT_GAME);

/** 다 그린 초상을 몇 개까지 남기나 (넘으면 오래된 것부터 버린다) */
const MAX_PAINTED = 400;

const loading = new Map<string, HTMLImageElement>();
/** 꺼낸 픽셀: "이름@작업 크기" → RGBA, 영역 지도는 픽셀마다 한 칸 */
const pixelCache = new Map<string, Uint8ClampedArray | Uint8Array>();
const painted = new Map<string, HTMLCanvasElement>();

function canvas(px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  return c;
}

let scratch: HTMLCanvasElement | null = null;

/** 그림 하나를 작업 크기 픽셀로. 아직 불러오는 중이면 null (다 불러오면 onLoad) */
function pixels(name: string, size: number, isRegion: boolean, onLoad: () => void): Uint8ClampedArray | Uint8Array | null {
  const key = `${name}@${size}`;
  const done = pixelCache.get(key);
  if (done) return done;
  let img = loading.get(name);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = URL_OF.get(name)!;
    loading.set(name, img);
  }
  if (!img.complete || img.naturalWidth === 0) {
    img.addEventListener('load', onLoad, { once: true });
    return null;
  }
  if (!scratch || scratch.width !== size) scratch = canvas(size);
  const g = scratch.getContext('2d', { willReadFrequently: true })!;
  g.clearRect(0, 0, size, size);
  // 영역 번호는 섞이면 안 되니 가장 가까운 픽셀로 줄인다
  g.imageSmoothingEnabled = !isRegion;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, size, size);
  const rgba = g.getImageData(0, 0, size, size).data;
  let out: Uint8ClampedArray | Uint8Array = rgba;
  if (isRegion) {
    out = new Uint8Array(size * size);
    for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4]!;
  }
  pixelCache.set(key, out);
  loading.delete(name);
  return out;
}

/** 큰 캔버스를 반씩 줄여 가며 px로 (한 번에 많이 줄이면 사파리에서 거칠어진다) */
function shrink(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  let cur = src;
  while (cur.width / 2 >= px) {
    const half = canvas(cur.width / 2);
    const g = half.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = canvas(px);
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, px, px);
  return out;
}

/** 외모 하나를 px 크기로 다 그린 캔버스. 아직 못 불러온 그림이 있으면 null (불러오면 repaint) */
function compose(look: Look, px: number, repaint: () => void): HTMLCanvasElement | null {
  const key = `${lookKey(look)}@${px}`;
  const done = painted.get(key);
  if (done) return done;
  const size = workSize(px);
  let waiting = false;
  const get = (name: string, isRegion = false) => {
    if (!URL_OF.has(name)) return undefined;
    const p = pixels(name, size, isRegion, repaint);
    if (!p) waiting = true;
    return p ?? undefined;
  };
  const base = get(baseName(look)) as Uint8ClampedArray | undefined;
  const parts = new Map<string, PartPixels>();
  for (const id of lookParts(look)) {
    const body = get(id) as Uint8ClampedArray | undefined;
    const mul = get(`${id}_mul`) as Uint8ClampedArray | undefined;
    const reg = get(`${id}_reg`, true) as Uint8Array | undefined;
    if (body) parts.set(id, { body, mul, reg });
  }
  if (waiting || !base) return null;
  const work = canvas(size);
  work.getContext('2d')!.putImageData(new ImageData(composeLook(look, base, parts), size, size), 0, 0);
  const c = shrink(work, px);
  painted.set(key, c);
  if (painted.size > MAX_PAINTED) painted.delete(painted.keys().next().value!);
  return c;
}

function paint(el: HTMLCanvasElement): void {
  const raw = el.dataset.look;
  if (!raw) return;
  const look = JSON.parse(decodeURIComponent(raw)) as Look;
  const px = el.width;
  const c = compose(look, px, () => paint(el));
  if (!c) return;
  const g = el.getContext('2d')!;
  g.clearRect(0, 0, px, px);
  g.drawImage(c, 0, 0);
  el.dataset.painted = '1';
}

/** 초상 자리 (캔버스). size는 화면 크기(CSS px) */
export function portraitHtml(look: Look | null | undefined, size = 48, label = ''): string {
  if (!look) return '';
  const px = Math.round(size * Math.min(2, globalThis.devicePixelRatio || 1));
  return `<canvas class="portrait" width="${px}" height="${px}" style="width:${size}px;height:${size}px" data-look="${encodeURIComponent(JSON.stringify(look))}" role="img" aria-label="${label}"></canvas>`;
}

/** 문서에 붙는 초상 캔버스를 찾아 칠한다 (앱을 열 때 한 번) */
export function watchPortraits(root: HTMLElement = document.body): void {
  const scan = (node: ParentNode) => node.querySelectorAll<HTMLCanvasElement>('canvas.portrait:not([data-painted])').forEach(paint);
  scan(root);
  new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (n instanceof HTMLCanvasElement && n.matches('canvas.portrait')) paint(n);
        else if (n instanceof HTMLElement) scan(n);
      }
    }
  }).observe(root, { childList: true, subtree: true });
}
