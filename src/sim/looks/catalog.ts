// 초상 파츠 목록과 팔레트 (기획서 "NPC 외모", 0.1.6 아바타 키트). 확률과 옷 색은 초안이다. 기획자가 그림을 보며 고친다.
// 원본은 assets-src/portrait/avatar-kit/, 게임용 그림은 npm run portraits가 assets/portrait/에 만든다.
// 파츠 id는 키트 파일 이름 그대로. 목록에 있어도 그림이 없으면(kitParts.ts에 없으면) 뽑지 않는다.
import { KIT_PARTS } from './kitParts';
import type { ClothColorId, HairColorId, PartKind, PartWho, RegionCode, RegionKind, SkinId } from './types';

/** 키트 원본 캔버스 크기 (px). 게임에는 PORTRAIT_GAME 크기로 줄여 넣는다 */
export const PORTRAIT_CANVAS = 1254;
export const PORTRAIT_GAME = 512;

export type Rgb = readonly [number, number, number];

/** 피부 (베이스에 곱하는 비율은 키트 render.py의 SKIN, 빌드 때 베이스 그림에 미리 들어간다) */
export const SKINS: Record<SkinId, string> = {
  light: '밝은 피부',
  medium: '보통 피부',
  deep: '짙은 피부',
};

/** 머리색: 키트 render.py의 HAIR_COLORS 6가지와 노인 흰머리(GRAY_HAIR) */
export const HAIR_COLORS: Record<HairColorId, { name: string; rgb: Rgb }> = {
  black: { name: '검은 머리', rgb: [40, 34, 32] },
  brown: { name: '갈색 머리', rgb: [92, 60, 40] },
  auburn: { name: '붉은 머리', rgb: [140, 62, 38] },
  blond: { name: '금발', rgb: [205, 170, 110] },
  ash: { name: '잿빛 갈색 머리', rgb: [120, 110, 100] },
  darkBrown: { name: '짙은 갈색 머리', rgb: [60, 45, 35] },
  gray: { name: '흰머리', rgb: [200, 200, 198] },
};

/** 젊은 사람이 고르는 머리색 (노인은 흰머리) */
export const YOUNG_HAIR_COLORS: readonly HairColorId[] = ['black', 'brown', 'auburn', 'blond', 'ash', 'darkBrown'];

/** 옷 색 (초안). 천연 염료는 키트 render.py의 CLOTH에서, 짙은 쪽빛·짙은 꼭두서니와 가죽·털 색은 더했다 */
export const CLOTH_COLORS: Record<ClothColorId, { name: string; rgb: Rgb }> = {
  indigo: { name: '쪽빛', rgb: [70, 80, 120] },
  deepIndigo: { name: '짙은 쪽빛', rgb: [40, 48, 78] },
  madder: { name: '꼭두서니', rgb: [110, 40, 40] },
  deepMadder: { name: '짙은 꼭두서니', rgb: [72, 30, 34] },
  ochre: { name: '황토', rgb: [150, 110, 50] },
  olive: { name: '올리브', rgb: [60, 80, 55] },
  deepGreen: { name: '짙은 녹색', rgb: [40, 70, 60] },
  brown: { name: '갈색', rgb: [120, 90, 55] },
  deepBrown: { name: '짙은 갈색', rgb: [90, 70, 50] },
  dark: { name: '짙은 색', rgb: [70, 60, 55] },
  cream: { name: '크림', rgb: [225, 215, 195] },
  linen: { name: '표백 안 한 마', rgb: [190, 175, 145] },
  leather: { name: '가죽', rgb: [107, 71, 44] },
  fur: { name: '털', rgb: [122, 109, 87] },
  darkFur: { name: '짙은 털', rgb: [80, 68, 56] },
};

/** "짙은 색" (광부, 도시 상인) */
export const DEEP_CLOTH: readonly ClothColorId[] = ['deepIndigo', 'deepMadder', 'deepGreen', 'deepBrown', 'dark'];
/** "아무 색" (소문꾼·마을 사람): 직업 색으로 쓰는 옷 색 모두 */
export const ANY_CLOTH: readonly ClothColorId[] = ['indigo', 'deepIndigo', 'madder', 'deepMadder', 'ochre', 'olive', 'deepGreen', 'brown', 'deepBrown', 'dark', 'cream', 'linen'];

/** 직업 색(main)이 아닌 영역이 고르는 색 */
export const REGION_PALETTE: Record<Exclude<RegionKind, 'main' | 'hair'>, readonly ClothColorId[]> = {
  under: ['cream', 'cream', 'linen'],
  leather: ['leather', 'leather', 'deepBrown', 'dark'],
  fur: ['fur', 'fur', 'darkFur', 'linen'],
};

export interface PartInfo {
  kind: PartKind;
  name: string;
  who: PartWho;
  /** 색 영역마다 무엇인가. 적지 않은 영역은 그림 색 그대로 (머리·수염은 1 = 머리색) */
  regions: Partial<Record<RegionCode, RegionKind>>;
}

const HAIR_REGIONS = { 1: 'hair' } as const;

/**
 * 파츠 목록 (docs/reference/npc-prompts.md의 표). 새로 뽑을 파츠(top_10~13, hair_04~07, beard_01~02)는
 * 그림이 오면 그대로 쓰인다. 상의의 색 영역은 그림의 _reg.png를 보고 정한다: 새 상의는 그림이 오면 1 = 주 색만 두고 시작한다
 */
export const PARTS: Record<string, PartInfo> = {
  top_03: { kind: 'top', name: '끈 튜닉 + 크림 셔츠', who: 'any', regions: { 1: 'main', 2: 'under' } },
  top_04: { kind: 'top', name: '끈 조끼 원피스 + 크림 블라우스', who: 'female', regions: { 1: 'under', 2: 'main' } },
  top_05: { kind: 'top', name: '갈색 니트', who: 'any', regions: { 1: 'main' } },
  top_06: { kind: 'top', name: '더블릿, 놋쇠 단추', who: 'any', regions: { 1: 'main', 2: 'under' } },
  top_07: { kind: 'top', name: '농민 리넨 튜닉, 밧줄 매듭', who: 'any', regions: { 1: 'main' } },
  top_08: { kind: 'top', name: '모피 깃 상인 겉옷', who: 'any', regions: { 1: 'main', 2: 'fur', 3: 'under' } },
  top_09: { kind: 'top', name: '가죽 조끼 + 셔츠', who: 'any', regions: { 1: 'leather', 2: 'main' } },
  top_10: { kind: 'top', name: '앞치마 두른 셔츠', who: 'any', regions: { 1: 'main' } },
  top_11: { kind: 'top', name: '대장장이 가죽 앞치마', who: 'any', regions: { 1: 'main' } },
  top_12: { kind: 'top', name: '숄을 두른 블라우스', who: 'female', regions: { 1: 'main' } },
  top_13: { kind: 'top', name: '굵은 털실 스웨터', who: 'any', regions: { 1: 'main' } },
  hair_01: { kind: 'hair', name: '짧은 부스스한 머리', who: 'any', regions: HAIR_REGIONS },
  hair_02: { kind: 'hair', name: '어깨 길이 생머리', who: 'any', regions: HAIR_REGIONS },
  hair_03: { kind: 'hair', name: '옆머리만 남은 대머리', who: 'male', regions: HAIR_REGIONS },
  hair_04: { kind: 'hair', name: '짧게 깎은 머리', who: 'male', regions: HAIR_REGIONS },
  hair_05: { kind: 'hair', name: '쪽진 올림머리', who: 'female', regions: HAIR_REGIONS },
  hair_06: { kind: 'hair', name: '어깨 앞으로 넘긴 땋은 머리', who: 'female', regions: HAIR_REGIONS },
  hair_07: { kind: 'hair', name: '목 뒤로 묶은 꽁지머리', who: 'any', regions: HAIR_REGIONS },
  beard_01: { kind: 'beard', name: '짧은 턱수염', who: 'male', regions: HAIR_REGIONS },
  beard_02: { kind: 'beard', name: '콧수염', who: 'male', regions: HAIR_REGIONS },
};

/** 그림이 있는 파츠 (목록에 있고 키트에도 있는 것). 시뮬레이션은 이 안에서만 뽑는다 */
export const AVAILABLE_PARTS: ReadonlySet<string> = new Set(KIT_PARTS.filter((id) => id in PARTS));

// ── 확률 (초안) ──

/** 노인 비율 (노상인은 항상 노인) */
export const OLD_RATE = 0.25;
/** 남자 비율 (직업마다 roles.ts에서 바꿀 수 있다) */
export const MALE_RATE = 0.5;
/** 수염 비율 (남자 중에서, 직업마다 roles.ts에서 바꾼다) */
export const BEARD_RATE = 0.15;
