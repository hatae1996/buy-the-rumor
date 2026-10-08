// 기둥 윗면에 깔 땅 그림 (assets/map/hex_*.png).
// 그림은 비스듬히 본 육각 타일이라 아래쪽에 흙 옆면이 그려져 있다. 윗면 꼭짓점만 골라 UV로 쓴다.
// 그림은 가을이라, 다른 계절은 캔버스에서 색을 바꿔 만든다.
import * as THREE from 'three';
import coastUrl from '../../assets/map/hex_coast.png';
import forestUrl from '../../assets/map/hex_forest.png';
import hillsUrl from '../../assets/map/hex_hills.png';
import mountainUrl from '../../assets/map/hex_mountain.png';
import plainUrl from '../../assets/map/hex_plain.png';
import seaUrl from '../../assets/map/hex_sea.png';
import type { Season } from '../sim/season';
import type { Terrain } from '../sim/worldgen';
import type { TopUv } from './hexPrism';

const URLS: Record<Terrain, string> = {
  sea: seaUrl,
  coast: coastUrl,
  plain: plainUrl,
  forest: forestUrl,
  hills: hillsUrl,
  mountain: mountainUrl,
};

/** 그림 높이에서 흙 옆면이 차지하는 비율 (그림을 재서 정함) */
const SIDE_BAND = 0.082;
/** 가장자리 흙이 비치지 않도록 윗면 안쪽으로 줄이는 비율 */
const INSET = 0.04;

export interface TileArt {
  image: HTMLImageElement;
  /** 윗면 꼭짓점 UV (hexPrism의 순서) */
  topUv: TopUv;
}

export type TileArtSet = Record<Terrain, TileArt>;

export async function loadTileArt(): Promise<TileArtSet> {
  const entries = await Promise.all(
    (Object.keys(URLS) as Terrain[]).map(async (t) => {
      const image = await loadImage(URLS[t]);
      return [t, { image, topUv: measureTopFace(image) }] as const;
    }),
  );
  return Object.fromEntries(entries) as TileArtSet;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`그림을 못 불러왔다: ${src}`));
    img.src = src;
  });
}

/** 오른쪽 가장자리의 불투명한 구간으로 윗면 꼭짓점을 찾는다 */
function measureTopFace(img: HTMLImageElement): TopUv {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ctx = canvas2d(w, h);
  ctx.drawImage(img, 0, 0);
  const alpha = ctx.getImageData(w - 3, 0, 1, h).data;
  let first = 0;
  while (first < h && alpha[first * 4 + 3]! < 128) first++;
  let last = h - 1;
  while (last > 0 && alpha[last * 4 + 3]! < 128) last--;
  const band = Math.round(h * SIDE_BAND);

  // 위, 오른쪽 위, 오른쪽 아래, 아래, 왼쪽 아래, 왼쪽 위 (픽셀)
  const px: [number, number][] = [
    [w / 2, 0],
    [w, first],
    [w, last - band],
    [w / 2, h - band],
    [0, last - band],
    [0, first],
  ];
  const cx = px.reduce((s, p) => s + p[0], 0) / 6;
  const cy = px.reduce((s, p) => s + p[1], 0) / 6;
  return px.map(([x, y]) => {
    const ix = x + (cx - x) * INSET;
    const iy = y + (cy - y) * INSET;
    return [ix / w, 1 - iy / h] as const;
  });
}

/** 계절에 맞춰 색을 바꾼 질감. 다 쓰면 dispose 한다 */
export function seasonTexture(art: TileArt, terrain: Terrain, season: Season): THREE.Texture {
  const { image } = art;
  const ctx = canvas2d(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, 0, 0);
  if (season !== 2) {
    const data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    recolor(data.data, terrain, season);
    ctx.putImageData(data, 0, 0);
  }
  const tex = new THREE.CanvasTexture(ctx.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function canvas2d(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d', { willReadFrequently: true })!;
}

/** 봄과 여름은 단풍을 초록으로, 겨울은 눈을 덮는다 */
function recolor(px: Uint8ClampedArray, terrain: Terrain, season: Season): void {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 8) continue;
    const [h, s, l] = rgbToHsl(px[i]!, px[i + 1]!, px[i + 2]!);
    let nh = h;
    let ns = s;
    let nl = l;
    if (season === 3) {
      // 어두운 외곽선은 남기고 밝은 곳일수록 눈을 많이 덮는다
      const k = terrain === 'sea' ? 0.25 : l < 0.2 ? 0 : 0.55 + 0.3 * l;
      ns = s * (1 - k) * 0.4;
      nl = l + (0.96 - l) * k;
    } else if (h <= 70 && s > 0.5 && l > 0.2) {
      // 빨강, 주황, 노랑 잎과 누런 풀을 초록 쪽으로
      const target = season === 0 ? 95 : 108;
      nh = h + (target - h) * (season === 0 ? 0.75 : 0.85);
      nl = Math.min(1, l * (season === 0 ? 1.06 : 0.95));
    }
    const [r, g, b] = hslToRgb(nh, ns, nl);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}
