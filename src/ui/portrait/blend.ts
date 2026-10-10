// 초상 레이어 겹치기 (키트 render.py의 layer_mul, layer_over). 픽셀 4칸(RGBA, 알파를 곱하지 않은 값) 배열에 제자리에서 한다.
// 캔버스의 multiply는 투명한 곳에 곱하기 그림을 그대로 칠해 버려서, 픽셀을 직접 계산한다.

/** 곱하기: 색만 mul/255 배로 (흰색 = 변화 없음). 알파는 그대로라 배경(투명)에는 그림자가 생기지 않는다 */
export function multiply(dst: Uint8ClampedArray, mul: Uint8ClampedArray): void {
  for (let p = 0; p < dst.length; p += 4) {
    if (dst[p + 3] === 0) continue;
    dst[p] = (dst[p]! * mul[p]!) / 255;
    dst[p + 1] = (dst[p + 1]! * mul[p + 1]!) / 255;
    dst[p + 2] = (dst[p + 2]! * mul[p + 2]!) / 255;
  }
}

/** 덮기: src를 dst 위에 (보통 알파 합성) */
export function over(dst: Uint8ClampedArray, src: Uint8ClampedArray): void {
  for (let p = 0; p < dst.length; p += 4) {
    const sa = src[p + 3]! / 255;
    if (sa === 0) continue;
    if (sa === 1) {
      dst[p] = src[p]!;
      dst[p + 1] = src[p + 1]!;
      dst[p + 2] = src[p + 2]!;
      dst[p + 3] = 255;
      continue;
    }
    const da = (dst[p + 3]! / 255) * (1 - sa);
    const oa = sa + da;
    dst[p] = (src[p]! * sa + dst[p]! * da) / oa;
    dst[p + 1] = (src[p + 1]! * sa + dst[p + 1]! * da) / oa;
    dst[p + 2] = (src[p + 2]! * sa + dst[p + 2]! * da) / oa;
    dst[p + 3] = oa * 255;
  }
}
