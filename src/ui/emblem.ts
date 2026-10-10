// 상단 문장 그리기 (0.1.7 답 130): 방패 모양 안을 바탕 색과 나눔 무늬로 칠하고, 가운데에 상징을 얹는다.
// 그림(assets/emblem/shield_*.png, sym_*.png, 회색조)이 있으면 방패는 그림 모양으로 자르고 명암을 곱하고,
// 상징은 그림 모양에 색을 칠한 뒤 명암을 곱한다. 그림이 오기 전에는 방패를 도형으로, 상징을 이름 글자로 그린다.
import { EMBLEM_COLORS, SYMBOLS, type DivisionId, type Emblem, type ShieldId, type SymbolId } from '../sim/ranking';

const FILES = import.meta.glob<string>('../../assets/emblem/*.png', { eager: true, query: '?url', import: 'default' });
const ART = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

/** 그림이 오기 전 방패 모양 (viewBox 0 0 100 110) */
const SHIELD_PATH: Record<ShieldId, string> = {
  heater: 'M8 6 H92 V50 C92 80 72 98 50 106 C28 98 8 80 8 50 Z',
  round: 'M50 9 A46 46 0 1 1 49.9 9 Z',
  kite: 'M50 4 C78 4 92 20 92 38 C92 62 72 86 50 108 C28 86 8 62 8 38 C8 20 22 4 50 4 Z',
  banner: 'M12 6 H88 V104 L50 84 L12 104 Z',
  oval: 'M50 5 C74 5 90 28 90 55 C90 82 74 105 50 105 C26 105 10 82 10 55 C10 28 26 5 50 5 Z',
};

/** 그림이 오기 전 상징 글자 (짧게) */
const SYMBOL_GLYPH: Record<SymbolId, string> = {
  wheat: '밀',
  salt: '소금',
  horse: '말',
  key: '열쇠',
  scales: '저울',
  ship: '배',
  fish: '생선',
  hammer: '망치',
  antler: '뿔',
  purse: '돈',
};

/** 나눔 무늬: 바탕 위에 두 번째 색으로 칠하는 도형 (방패 모양으로 잘린다) */
function divisionShapes(d: DivisionId, fill: string): string {
  switch (d) {
    case 'none':
      return '';
    case 'pale':
      return `<rect x="50" y="0" width="50" height="110" fill="${fill}"/>`;
    case 'fess':
      return `<rect x="0" y="55" width="100" height="55" fill="${fill}"/>`;
    case 'bend':
      return `<polygon points="0,0 100,0 100,110" fill="${fill}"/>`;
    case 'band':
      return `<rect x="0" y="41" width="100" height="28" fill="${fill}"/>`;
    case 'cross':
      return `<rect x="39" y="0" width="22" height="110" fill="${fill}"/><rect x="0" y="44" width="100" height="22" fill="${fill}"/>`;
    case 'chevron':
      return `<polygon points="0,96 50,48 100,96 100,72 50,24 0,72" fill="${fill}"/>`;
    case 'checky': {
      let out = '';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) out += `<rect x="${x * 25}" y="${y * 27.5}" width="25" height="27.5" fill="${fill}"/>`;
      return out;
    }
  }
}

let uid = 0;

/** 문장 하나 (SVG). size는 화면 너비(CSS px), 높이는 1.1배 */
export function emblemSvg(e: Emblem, size = 64, label = '상단 문장'): string {
  const id = `em${++uid}`;
  const a = EMBLEM_COLORS[e.field[0]].hex;
  const b = EMBLEM_COLORS[e.field[1]].hex;
  const sc = EMBLEM_COLORS[e.symbolColor].hex;
  const shieldArt = ART.get(`shield_${e.shield}`);
  const symArt = ART.get(`sym_${e.symbol}`);
  // 자르는 모양: 그림이 있으면 그림의 불투명한 곳, 없으면 도형
  const clip = shieldArt
    ? `<mask id="${id}c" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="110"><image href="${shieldArt}" x="-5" y="0" width="110" height="110"/></mask>`
    : `<clipPath id="${id}c"><path d="${SHIELD_PATH[e.shield]}"/></clipPath>`;
  const clipRef = shieldArt ? `mask="url(#${id}c)"` : `clip-path="url(#${id}c)"`;
  const field = `<g ${clipRef}><rect width="100" height="110" fill="${a}"/>${divisionShapes(e.division, b)}</g>`;
  const rim = shieldArt
    ? `<image href="${shieldArt}" x="-5" y="0" width="110" height="110" style="mix-blend-mode:multiply"/>`
    : `<path d="${SHIELD_PATH[e.shield]}" fill="none" stroke="rgba(43,38,34,0.55)" stroke-width="3"/>`;
  const glyph = SYMBOL_GLYPH[e.symbol];
  const symbol = symArt
    ? `<mask id="${id}s" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="110"><image href="${symArt}" x="22" y="27" width="56" height="56"/></mask>
       <rect width="100" height="110" fill="${sc}" mask="url(#${id}s)"/>
       <image href="${symArt}" x="22" y="27" width="56" height="56" style="mix-blend-mode:multiply"/>`
    : `<text x="50" y="${glyph.length > 1 ? 63 : 67}" text-anchor="middle" font-family="Jua, sans-serif" font-size="${glyph.length > 1 ? 24 : 34}" fill="${sc}" stroke="rgba(255,255,255,0.7)" stroke-width="3" paint-order="stroke">${glyph}</text>`;
  return `<svg class="emblem" viewBox="0 0 100 110" width="${size}" height="${Math.round(size * 1.1)}" role="img" aria-label="${label}: ${SYMBOLS[e.symbol]}">
    <defs>${clip}</defs>${field}${rim}${symbol}</svg>`;
}

/** 캔버스에 문장을 그린다 (증서 이미지 저장). x, y는 왼쪽 위, w는 너비 */
export async function drawEmblem(g: CanvasRenderingContext2D, e: Emblem, x: number, y: number, w: number): Promise<void> {
  const svg = emblemSvg(e, w).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode().catch(() => undefined);
  if (img.complete && img.naturalWidth) g.drawImage(img, x, y, w, w * 1.1);
}
