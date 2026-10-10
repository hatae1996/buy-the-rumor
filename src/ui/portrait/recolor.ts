// 파츠 색 바꾸기: 키트 regions.py의 recolor를 옮긴 것 (기획서 "NPC 외모": 로우폴리 명암은 두고 색만 바꾼다).
// 색 영역마다 Lab 밝기를 옮겨 그 영역의 대표 밝기(60번째 백분위)가 목표 색 밝기에 오게 하고,
// 원래 면마다의 밝기 차이는 그대로, 색 기운(a, b)의 차이는 절반만 남긴다.
// regions.py와 다른 점 하나: 완전히 투명한 픽셀은 색이 정해져 있지 않아(캔버스가 버린다) 계산에서 뺀다.
import type { Rgb } from '../../sim/looks';
import { labToRgb, rgbToLab } from './lab';

/** numpy.percentile (선형 보간)과 같다. values는 정렬해도 되는 배열 */
export function percentile(values: Float64Array, q: number): number {
  values.sort();
  const pos = (q / 100) * (values.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(values.length - 1, lo + 1);
  return values[lo]! + (values[hi]! - values[lo]!) * (pos - lo);
}

/**
 * rgba(파츠 본체, 한 픽셀에 4칸)의 색을 영역마다 바꾼다 (제자리에서).
 * reg는 픽셀마다 영역 번호 하나, colors는 영역 번호 → 목표 색. 적지 않은 영역(255 고정 장식 등)은 그대로
 */
export function recolor(rgba: Uint8ClampedArray, reg: Uint8Array, colors: ReadonlyMap<number, Rgb>): void {
  const n = reg.length;
  const lab = new Float64Array(3);
  const tl = new Float64Array(3);
  const rgb = new Float64Array(3);
  for (const [code, color] of colors) {
    // 이 영역의 픽셀
    let count = 0;
    for (let i = 0; i < n; i++) if (reg[i] === code && rgba[i * 4 + 3]! > 0) count++;
    if (count === 0) continue;
    const idx = new Uint32Array(count);
    const Ls = new Float64Array(count);
    const As = new Float64Array(count);
    const Bs = new Float64Array(count);
    for (let i = 0, k = 0; i < n; i++) {
      if (reg[i] !== code || rgba[i * 4 + 3]! === 0) continue;
      rgbToLab(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!, lab);
      idx[k] = i;
      Ls[k] = lab[0]!;
      As[k] = lab[1]!;
      Bs[k] = lab[2]!;
      k++;
    }
    const ref = percentile(Ls.slice(), 60);
    const ma = percentile(As.slice(), 50);
    const mb = percentile(Bs.slice(), 50);
    rgbToLab(color[0], color[1], color[2], tl);
    const shift = tl[0]! - ref;
    for (let k = 0; k < count; k++) {
      const L = Math.min(100, Math.max(0, Ls[k]! + shift));
      labToRgb(L, tl[1]! + (As[k]! - ma) * 0.5, tl[2]! + (Bs[k]! - mb) * 0.5, rgb);
      const p = idx[k]! * 4;
      rgba[p] = rgb[0]!;
      rgba[p + 1] = rgb[1]!;
      rgba[p + 2] = rgb[2]!;
    }
  }
}
