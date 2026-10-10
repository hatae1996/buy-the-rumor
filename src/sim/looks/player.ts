// 플레이어 얼굴 (기획서 "게임 시작 화면과 부품", 0.1.7 답 130): NPC 아바타 키트를 그대로 쓴다.
// 피부, 머리, 머리색, 상의, 옷 색, 수염(그림이 오면)을 고른다. 남녀 구분 없이 그림 있는 모든 파츠를 고를 수 있다.
// 옷 색은 상의의 주 색 영역(main) 하나만 고르고, 셔츠·가죽·털 영역은 정해 둔 색으로 둔다.
import type { Rng } from '../rng';
import { AVAILABLE_PARTS, CLOTH_COLORS, HAIR_COLORS, PARTS, REGION_PALETTE, SKINS, YOUNG_HAIR_COLORS } from './catalog';
import { rollLook } from './draw';
import type { ClothColorId, HairColorId, Look, PartKind, RegionCode, SkinId } from './types';

/** 플레이어가 고를 수 있는 옷 색 (주 색) */
export const FACE_CLOTH: readonly ClothColorId[] = ['indigo', 'deepIndigo', 'madder', 'deepMadder', 'ochre', 'olive', 'deepGreen', 'brown', 'deepBrown', 'dark', 'cream', 'linen'];
export const FACE_SKINS = Object.keys(SKINS) as SkinId[];
export const FACE_HAIR_COLORS = Object.keys(HAIR_COLORS) as HairColorId[];

/** 그림 있는 파츠 (남녀 구분 없이) */
export function faceParts(kind: PartKind, available: ReadonlySet<string> = AVAILABLE_PARTS): string[] {
  return Object.keys(PARTS).filter((id) => PARTS[id]!.kind === kind && available.has(id));
}

/** 상의의 주 색 영역 번호 (없으면 null: 그림 색 그대로) */
function mainRegion(top: string): RegionCode | null {
  const hit = Object.entries(PARTS[top]?.regions ?? {}).find(([, kind]) => kind === 'main');
  return hit ? (Number(hit[0]) as RegionCode) : null;
}

/** 지금 옷 색 (주 색 영역의 색) */
export function faceCloth(look: Look): ClothColorId | null {
  const r = mainRegion(look.top);
  return r === null ? null : (look.cloth[r] ?? null);
}

/** 상의와 주 색으로 영역마다 옷 색을 다시 칠한다 (셔츠·가죽·털은 정해 둔 첫 색) */
function dress(top: string, main: ClothColorId): Look['cloth'] {
  const cloth: Look['cloth'] = {};
  for (const [code, kind] of Object.entries(PARTS[top]?.regions ?? {})) {
    if (kind === 'hair') continue;
    cloth[Number(code) as RegionCode] = kind === 'main' ? main : REGION_PALETTE[kind][0]!;
  }
  return cloth;
}

/** 상의를 바꾼다 (옷 색은 그대로) */
export function withTop(look: Look, top: string): Look {
  return { ...look, top, cloth: dress(top, faceCloth(look) ?? FACE_CLOTH[0]!) };
}

/** 옷 색을 바꾼다 */
export function withCloth(look: Look, main: ClothColorId): Look {
  return { ...look, cloth: dress(look.top, main) };
}

/**
 * 추천 얼굴: 마을 사람처럼 뽑는다(아무 옷 색). 젊은 얼굴로 시작한다 (흰머리는 머리색에서 고를 수 있다).
 * body·outfit 두 난수를 따로 쓰는 것은 NPC 뽑기와 같다
 */
export function rollPlayerFace(rng: Rng, available: ReadonlySet<string> = AVAILABLE_PARTS): Look {
  const look = rollLook(rng, rng, 'villager', available);
  const main = faceCloth(look);
  // 노인으로 뽑혔으면 흰머리 대신 젊은 머리색으로
  const hairColor = look.old ? rng.pick(YOUNG_HAIR_COLORS) : look.hairColor;
  return { ...look, old: false, hairColor, cloth: dress(look.top, main && FACE_CLOTH.includes(main) ? main : rng.pick(FACE_CLOTH)) };
}

/**
 * 받은 얼굴이 고를 수 있는 값으로만 되어 있나 (명령으로 들어온 값). 맞으면 저장할 모양으로 다듬어 돌려준다.
 * 옷 색은 주 색만 보고 나머지 영역은 다시 칠한다
 */
export function cleanFace(x: unknown, available: ReadonlySet<string> = AVAILABLE_PARTS): Look | null {
  if (!x || typeof x !== 'object') return null;
  const f = x as Partial<Look>;
  if (typeof f.skin !== 'string' || !(f.skin in SKINS)) return null;
  if (typeof f.hairColor !== 'string' || !(f.hairColor in HAIR_COLORS)) return null;
  const isPart = (id: unknown, kind: PartKind) => typeof id === 'string' && PARTS[id]?.kind === kind && available.has(id);
  if (!(f.hair === null || isPart(f.hair, 'hair'))) return null;
  if (!(f.beard === null || f.beard === undefined || isPart(f.beard, 'beard'))) return null;
  if (!isPart(f.top, 'top')) return null;
  const top = f.top!;
  const region = mainRegion(top);
  const main = region === null ? FACE_CLOTH[0]! : (f.cloth as Look['cloth'] | undefined)?.[region];
  if (typeof main !== 'string' || !(main in CLOTH_COLORS)) return null;
  return {
    skin: f.skin,
    old: f.old === true,
    male: f.male === true,
    hair: f.hair ?? null,
    hairColor: f.hairColor,
    top,
    cloth: dress(top, main),
    beard: f.beard ?? null,
  };
}
