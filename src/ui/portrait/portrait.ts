// NPC 초상 그리기 (기획서 "NPC 외모", 0.1.4): 레이어 순서대로 겹치고, 회색조 파츠에 팔레트 색을 곱한다.
// 그림은 assets/portrait/<레이어>/<파츠 id>.png. 없는 파츠는 단색 자리표시(placeholder.ts)로 그린다.
// 화면은 portraitHtml()로 캔버스 자리만 넣고, watchPortraits()가 문서에 붙는 캔버스를 찾아 칠한다.
// 사파리 메모리: 파츠 그림은 1254로 그리되 넣을 때 쓸 크기(512 이하)로 줄인다. 다 그린 초상은 외모·크기마다 하나만 남긴다.
import './portrait.css';
import { LAYERS, lookKey, tintHex, type Look } from '../../sim/looks';
import { PLACEHOLDER } from './placeholder';

const FILES = import.meta.glob<string>('../../../assets/portrait/*/*.png', { eager: true, query: '?url', import: 'default' });

/** "레이어/파츠" → 그림 주소 */
const PART_URL = new Map(
  Object.entries(FILES).map(([path, url]) => {
    const [layer, file] = path.split('/').slice(-2) as [string, string];
    return [`${layer}/${file.replace(/\.png$/, '')}`, url];
  }),
);

const images = new Map<string, HTMLImageElement>();

/** 파츠 그림 (불러오는 중이면 null). 다 불러오면 onLoad */
function partImage(key: string, onLoad: () => void): HTMLImageElement | null {
  const url = PART_URL.get(key);
  if (!url) return null;
  let img = images.get(key);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    images.set(key, img);
  }
  if (img.complete && img.naturalWidth > 0) return img;
  img.addEventListener('load', onLoad, { once: true });
  return null;
}

/** 회색조 그림에 색을 곱하고 그림의 투명한 곳은 그대로 둔다 */
function tinted(img: HTMLImageElement, color: string | null, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, px, px);
  if (color) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, px, px);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0, px, px);
  }
  return c;
}

const painted = new Map<string, HTMLCanvasElement>();

/** 외모 하나를 px 크기로 다 그린 캔버스. 아직 못 불러온 그림이 있으면 null (불러오면 repaint) */
function compose(look: Look, px: number, repaint: () => void): HTMLCanvasElement | null {
  const key = `${lookKey(look)}@${px}`;
  const done = painted.get(key);
  if (done) return done;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  let waiting = false;
  for (const layer of LAYERS) {
    const part = look.parts[layer.id];
    if (!part) continue;
    const color = layer.tint ? tintHex(layer.tint, look) : null;
    const partKey = `${layer.id}/${part}`;
    if (PART_URL.has(partKey)) {
      const img = partImage(partKey, repaint);
      if (img) g.drawImage(tinted(img, color, px), 0, 0);
      else waiting = true;
      continue;
    }
    g.save();
    g.scale(px / 100, px / 100);
    PLACEHOLDER[layer.id]?.[part]?.(g, color ?? '#000');
    g.restore();
  }
  if (waiting) return null;
  painted.set(key, c);
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
