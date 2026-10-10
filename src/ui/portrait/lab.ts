// sRGB ↔ CIE Lab (D65, 2°). 키트 regions.py가 쓰는 scikit-image의 rgb2lab, lab2rgb와 같은 식이다.
// 색은 0~255, L은 0~100. 화면 밖 색은 lab2rgb처럼 0~255로 자른다.

/** sRGB(선형) → XYZ (skimage xyz_from_rgb) */
const XYZ_FROM_RGB = [
  [0.412453, 0.35758, 0.180423],
  [0.212671, 0.71516, 0.072169],
  [0.019334, 0.119193, 0.950227],
] as const;

/** 3×3 역행렬 (skimage rgb_from_xyz = inv(xyz_from_rgb)) */
function invert3(m: readonly (readonly number[])[]): number[][] {
  const [a, b, c] = m[0]!;
  const [d, e, f] = m[1]!;
  const [g, h, i] = m[2]!;
  const A = e! * i! - f! * h!;
  const B = -(d! * i! - f! * g!);
  const C = d! * h! - e! * g!;
  const det = a! * A + b! * B + c! * C;
  return [
    [A / det, -(b! * i! - c! * h!) / det, (b! * f! - c! * e!) / det],
    [B / det, (a! * i! - c! * g!) / det, -(a! * f! - c! * d!) / det],
    [C / det, -(a! * h! - b! * g!) / det, (a! * e! - b! * d!) / det],
  ];
}

const RGB_FROM_XYZ = invert3(XYZ_FROM_RGB);
const WHITE = [0.95047, 1, 1.08883] as const;

const toLinear = (v: number): number => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
const fromLinear = (v: number): number => (v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : v * 12.92);
const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fInv = (t: number): number => (t > 0.2068966 ? t ** 3 : (t - 16 / 116) / 7.787);

/** r, g, b (0~255) → out[o..o+2] = L, a, b */
export function rgbToLab(r: number, g: number, b: number, out: Float64Array | number[], o = 0): void {
  const R = toLinear(r / 255);
  const G = toLinear(g / 255);
  const B = toLinear(b / 255);
  const m = XYZ_FROM_RGB;
  const x = f((m[0][0] * R + m[0][1] * G + m[0][2] * B) / WHITE[0]);
  const y = f((m[1][0] * R + m[1][1] * G + m[1][2] * B) / WHITE[1]);
  const z = f((m[2][0] * R + m[2][1] * G + m[2][2] * B) / WHITE[2]);
  out[o] = 116 * y - 16;
  out[o + 1] = 500 * (x - y);
  out[o + 2] = 200 * (y - z);
}

/** L, a, b → out[o..o+2] = r, g, b (0~255, 소수) */
export function labToRgb(L: number, a: number, b: number, out: Float64Array | number[], o = 0): void {
  const fy = (L + 16) / 116;
  // skimage lab2xyz처럼 z가 음수가 되면 0으로 자른다
  const x = fInv(a / 500 + fy) * WHITE[0];
  const y = fInv(fy) * WHITE[1];
  const z = fInv(Math.max(0, fy - b / 200)) * WHITE[2];
  const m = RGB_FROM_XYZ;
  for (let k = 0; k < 3; k++) {
    const v = fromLinear(m[k]![0]! * x + m[k]![1]! * y + m[k]![2]! * z);
    out[o + k] = Math.min(255, Math.max(0, v * 255));
  }
}
