// 초상 겹치기 (0.1.6 아바타 키트): 색 바꾸기가 키트 regions.py(scikit-image)와 같은 값을 내는지,
// 게임용 그림(assets/portrait)이 kitParts.ts 목록과 맞는지 본다. 기대 값은 키트 파이썬 코드로 낸 것이다.
import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HAIR_COLORS, KIT_PARTS, SKINS, type Look } from '../../sim/looks';
import { multiply, over } from './blend';
import { labToRgb, rgbToLab } from './lab';
import { baseName, composeLook, lookParts, regionColors } from './layers';
import { percentile, recolor } from './recolor';

const near = (got: ArrayLike<number>, want: readonly number[], tol: number) => {
  expect(got.length).toBe(want.length);
  want.forEach((w, i) => expect(Math.abs(got[i]! - w), `${i}: ${got[i]} ≠ ${w}`).toBeLessThanOrEqual(tol));
};

describe('Lab 바꾸기 (skimage rgb2lab, lab2rgb)', () => {
  it('rgb → Lab', () => {
    const cases: [number[], number[]][] = [
      [[0, 0, 0], [0, 0, 0]],
      [[255, 255, 255], [100, -0.0025, 0.0047]],
      [[110, 40, 40], [26.6969, 31.1123, 16.2401]],
      [[205, 170, 110], [71.4575, 4.9727, 35.6252]],
      [[70, 80, 120], [34.7924, 7.1204, -24.0355]],
    ];
    const out = [0, 0, 0];
    for (const [rgb, lab] of cases) {
      rgbToLab(rgb[0]!, rgb[1]!, rgb[2]!, out);
      near(out, lab, 0.001);
    }
  });

  it('Lab → rgb (화면 밖 색은 자른다)', () => {
    const out = [0, 0, 0];
    labToRgb(50, 20, -30, out);
    near(out, [126.572, 109.461, 170.044], 0.01);
    labToRgb(20, -60, 90, out);
    near(out, [0, 62.589, 0], 0.01);
  });

  it('왕복하면 제자리', () => {
    const lab = [0, 0, 0];
    const rgb = [0, 0, 0];
    for (const c of [[12, 200, 99], [255, 0, 128], [64, 64, 64]]) {
      rgbToLab(c[0]!, c[1]!, c[2]!, lab);
      labToRgb(lab[0]!, lab[1]!, lab[2]!, rgb);
      near(rgb, c, 0.01);
    }
  });

  it('백분위는 numpy와 같다 (선형 보간)', () => {
    expect(percentile(Float64Array.from([5, 1, 3, 2, 4]), 60)).toBeCloseTo(3.4);
    expect(percentile(Float64Array.from([4, 1, 3, 2]), 50)).toBeCloseTo(2.5);
  });
});

describe('색 바꾸기 (regions.py recolor)', () => {
  // 4×2 그림: 영역 1 녹색 셋(밝기가 다르다)과 하나 더, 영역 2 크림, 255 고정 장식, 0 투명, 3
  const pixels = () =>
    Uint8ClampedArray.from([60, 90, 50, 255, 80, 110, 70, 255, 40, 60, 30, 255, 230, 215, 190, 255, 200, 180, 40, 255, 50, 70, 40, 255, 0, 0, 0, 0, 120, 100, 90, 255]);
  const reg = Uint8Array.from([1, 1, 1, 2, 255, 1, 0, 3]);

  it('키트 파이썬과 같은 색 (반올림 차이 1까지)', () => {
    const px = pixels();
    recolor(
      px,
      reg,
      new Map([
        [1, [110, 40, 40]],
        [2, [70, 80, 120]],
      ]),
    );
    near(px, [112, 45, 41, 255, 135, 64, 60, 255, 82, 11, 19, 255, 70, 80, 120, 255, 200, 180, 40, 255, 94, 23, 28, 255, 0, 0, 0, 0, 120, 100, 90, 255], 1);
  });

  it('영역 0(투명)과 255(고정 장식), 색을 정하지 않은 영역은 그대로', () => {
    const px = pixels();
    recolor(px, reg, new Map([[1, [110, 40, 40]]]));
    const before = pixels();
    for (const i of [3, 4, 6, 7]) expect([...px.slice(i * 4, i * 4 + 4)]).toEqual([...before.slice(i * 4, i * 4 + 4)]);
  });

  it('영역의 대표 밝기(60번째 백분위)가 목표 색 밝기에 오고, 면 사이 밝기 차이는 그대로', () => {
    // 한 영역에 밝기가 다른 회색 다섯
    const greys = [40, 70, 100, 130, 160];
    const px = Uint8ClampedArray.from(greys.flatMap((g) => [g, g, g, 255]));
    const before = greys.map((g) => {
      const lab = [0, 0, 0];
      rgbToLab(g, g, g, lab);
      return lab[0]!;
    });
    const target: [number, number, number] = [150, 110, 50];
    recolor(px, new Uint8Array(5).fill(1), new Map([[1, target]]));
    const tl = [0, 0, 0];
    rgbToLab(...target, tl);
    const after = greys.map((_, i) => {
      const lab = [0, 0, 0];
      rgbToLab(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!, lab);
      return lab[0]!;
    });
    // 60번째 백분위 = 넷째 값(130)과 셋째 값 사이 → 목표 밝기
    const ref = before[2]! + (before[3]! - before[2]!) * 0.4;
    for (let i = 0; i < 5; i++) expect(after[i]!).toBeCloseTo(before[i]! - ref + tl[0]!, 0);
  });
});

describe('겹치기 (render.py layer_mul, layer_over)', () => {
  it('곱하기는 색만 바꾸고 투명한 배경에는 그림자를 칠하지 않는다', () => {
    const dst = Uint8ClampedArray.from([200, 100, 50, 255, 0, 0, 0, 0]);
    multiply(dst, Uint8ClampedArray.from([128, 255, 0, 255, 10, 10, 10, 255]));
    expect([...dst]).toEqual([100, 100, 0, 255, 0, 0, 0, 0]);
  });

  it('덮기: 불투명은 바꿔 놓고, 반투명은 섞고, 투명한 배경 위에서는 그 색 그대로', () => {
    const dst = Uint8ClampedArray.from([200, 0, 0, 255, 200, 0, 0, 255, 0, 0, 0, 0]);
    over(dst, Uint8ClampedArray.from([0, 0, 200, 255, 0, 0, 200, 128, 0, 0, 200, 128]));
    near(dst, [0, 0, 200, 255, 100, 0, 100, 255, 0, 0, 200, 128], 1);
  });
});

describe('외모 → 그림', () => {
  const look: Look = { skin: 'deep', old: true, male: true, hair: 'hair_03', hairColor: 'gray', top: 'top_08', cloth: { 1: 'madder', 2: 'fur', 3: 'cream' }, beard: 'beard_01' };

  it('베이스는 피부 × 나이, 파츠는 상의 → 수염 → 머리 차례', () => {
    expect(baseName(look)).toBe('base_deep_old');
    expect(baseName({ ...look, skin: 'light', old: false })).toBe('base_light');
    expect(lookParts(look)).toEqual(['top_08', 'beard_01', 'hair_03']);
    expect(lookParts({ ...look, beard: null })).toEqual(['top_08', 'hair_03']);
  });

  it('수염과 머리는 머리색, 상의는 영역마다 옷 색', () => {
    expect(regionColors(look, 'beard_01').get(1)).toEqual(HAIR_COLORS.gray.rgb);
    expect(regionColors(look, 'hair_03').get(1)).toEqual(HAIR_COLORS.gray.rgb);
    expect([...regionColors(look, 'top_08').keys()].sort()).toEqual([1, 2, 3]);
  });

  it('그림이 없는 파츠는 건너뛰고, 베이스 배열은 바꾸지 않는다', () => {
    const base = Uint8ClampedArray.from([10, 20, 30, 255]);
    const out = composeLook(look, base, new Map([['top_08', { body: Uint8ClampedArray.from([0, 0, 0, 0]), mul: Uint8ClampedArray.from([128, 128, 128, 255]) }]]));
    expect([...out]).toEqual([5, 10, 15, 255]);
    expect([...base]).toEqual([10, 20, 30, 255]);
  });
});

describe('게임용 그림 (npm run portraits)', () => {
  const dir = new URL('../../../assets/portrait/', import.meta.url);

  it('피부 3 × 나이 2 = 베이스 6장', () => {
    for (const skin of Object.keys(SKINS)) {
      for (const old of ['', '_old']) expect(existsSync(new URL(`base_${skin}${old}.png`, dir)), `base_${skin}${old}`).toBe(true);
    }
  });

  it('kitParts.ts 목록 = 그림이 있는 파츠, 파츠마다 본체와 색 영역 지도', () => {
    const files = readdirSync(new URL('parts/', dir));
    const bodies = files.filter((f) => /^(top|hair|beard)_\d+\.png$/.test(f)).map((f) => f.replace('.png', ''));
    expect([...bodies].sort()).toEqual([...KIT_PARTS].sort());
    for (const id of KIT_PARTS) expect(files, id).toContain(`${id}_reg.png`);
  });
});
