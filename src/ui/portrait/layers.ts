// 외모 하나를 픽셀로 겹치기 (기획서 "NPC 외모"의 겹치는 순서).
// 베이스(피부 × 나이, 빌드 때 미리 만든 그림) → 상의 그림자 곱하기 → 상의 → 수염 그림자 → 수염 → 머리 그림자 → 머리.
// 파츠마다 색 영역 지도대로 색을 바꾼 뒤(recolor.ts) 덮는다. 그림을 불러오는 일은 portrait.ts가 한다.
import { CLOTH_COLORS, HAIR_COLORS, PARTS, type Look, type RegionCode, type Rgb } from '../../sim/looks';
import { multiply, over } from './blend';
import { recolor } from './recolor';

/** 베이스 그림 이름 (scripts/portrait/build.py가 만든다) */
export function baseName(look: Look): string {
  return `base_${look.skin}${look.old ? '_old' : ''}`;
}

/** 겹칠 파츠, 아래에서 위로 */
export function lookParts(look: Look): string[] {
  return [look.top, look.beard, look.hair].filter((id): id is string => !!id);
}

/** 파츠의 색 영역 번호 → 목표 색 */
export function regionColors(look: Look, part: string): Map<number, Rgb> {
  const out = new Map<number, Rgb>();
  for (const [code, kind] of Object.entries(PARTS[part]?.regions ?? {})) {
    if (kind === 'hair') out.set(Number(code), HAIR_COLORS[look.hairColor].rgb);
    else {
      const c = look.cloth[Number(code) as RegionCode];
      if (c) out.set(Number(code), CLOTH_COLORS[c].rgb);
    }
  }
  return out;
}

export interface PartPixels {
  /** 본체 (RGBA) */
  body: Uint8ClampedArray;
  /** 피부에 드리우는 그림자 (RGBA, 흰색 = 변화 없음). 없는 파츠도 있다 */
  mul?: Uint8ClampedArray;
  /** 색 영역 번호 (픽셀마다 하나). 없으면 색을 바꾸지 않는다 */
  reg?: Uint8Array;
}

/** 다 겹친 RGBA. base와 parts의 배열은 바꾸지 않는다 */
export function composeLook(look: Look, base: Uint8ClampedArray, parts: ReadonlyMap<string, PartPixels>): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(base);
  for (const id of lookParts(look)) {
    const p = parts.get(id);
    if (!p) continue;
    if (p.mul) multiply(out, p.mul);
    const colors = regionColors(look, id);
    let body = p.body;
    if (p.reg && colors.size) {
      body = new Uint8ClampedArray(p.body);
      recolor(body, p.reg, colors);
    }
    over(out, body);
  }
  return out;
}
