// NPC 외모 (기획서 "NPC 외모", 0.1.6 아바타 키트 방식): 베이스 한 명에 상의·수염·머리를 겹치고, 파츠의 색 영역마다 색을 바꾼다.
// 외모(Look)는 누구의 얼굴인지 모른다. 나중에 플레이어 상인 증서 사진도 같은 모양을 쓴다.

/** 피부 3가지 (키트 render.py의 SKIN). 베이스 그림은 피부 × 나이로 미리 만들어 둔다 */
export type SkinId = 'light' | 'medium' | 'deep';

/** 머리색 6가지 (키트 render.py의 HAIR_COLORS) + 노인 흰머리 (GRAY_HAIR) */
export type HairColorId = 'black' | 'brown' | 'auburn' | 'blond' | 'ash' | 'darkBrown' | 'gray';

/** 옷 색 (천연 염료와 가죽·털 색, catalog.ts의 CLOTH_COLORS) */
export type ClothColorId =
  | 'indigo'
  | 'deepIndigo'
  | 'madder'
  | 'deepMadder'
  | 'ochre'
  | 'olive'
  | 'deepGreen'
  | 'brown'
  | 'deepBrown'
  | 'dark'
  | 'cream'
  | 'linen'
  | 'leather'
  | 'fur'
  | 'darkFur';

/** 파츠의 색 영역 번호 (키트 <파츠>_reg.png: 1 주 색, 2 보조, 3 보조 2. 255 고정 장식과 0 투명은 색을 바꾸지 않는다) */
export type RegionCode = 1 | 2 | 3;

/**
 * 색 영역이 무엇인가 (상의마다 다르다: top_04는 1이 블라우스, 2가 조끼 원피스).
 * main은 직업 색, under는 안에 받쳐 입은 셔츠, leather는 가죽, fur는 털깃, hair는 머리색(머리·수염)
 */
export type RegionKind = 'main' | 'under' | 'leather' | 'fur' | 'hair';

export type PartKind = 'top' | 'hair' | 'beard';

/** 누가 쓰나. 얼굴이 하나라 여자·남자는 머리 모양, 상의, 수염으로만 드러난다 */
export type PartWho = 'any' | 'male' | 'female';

export interface Look {
  skin: SkinId;
  /** 노인: 회색 눈썹 + 주름 (베이스 그림), 흰머리 */
  old: boolean;
  /** 남자 얼굴 (수염은 남자만, 원피스·쪽머리는 여자만). 그림에 직접 보이지 않아 겹침 열쇠에 넣지 않는다 */
  male: boolean;
  /** 머리 파츠 id (키트 파일 이름, hair_01 등). 그림 있는 머리가 하나도 없을 때만 null (민머리) */
  hair: string | null;
  /** 머리색. 수염도 같은 색 */
  hairColor: HairColorId;
  /** 상의 파츠 id (top_03 등) */
  top: string;
  /** 상의의 색 영역마다 옷 색. 적지 않은 영역은 그림 색 그대로 */
  cloth: Partial<Record<RegionCode, ClothColorId>>;
  /** 수염 파츠 id (beard_01 등). 없으면 null */
  beard: string | null;
}

/** 얼굴이 있는 NPC의 종류 */
export type NpcKind = 'elder' | 'inn' | 'market' | 'gossip' | 'trader' | 'worker';

/** 직업 (파츠와 색을 고르는 범위, roles.ts) */
export type LookRole =
  | 'fisher'
  | 'hunter'
  | 'farmer'
  | 'woodcutter'
  | 'miner'
  | 'salter'
  | 'curer'
  | 'smith'
  | 'innkeeper'
  | 'merchant'
  | 'cityMerchant'
  | 'villager'
  | 'elder';

/** 세계의 NPC 한 명: 번호(kind + id)와 직업 */
export interface NpcEntry {
  kind: NpcKind;
  /** 종류 안의 번호 (마을 번호, 소문꾼·상단·일꾼 id) */
  id: number;
  role: LookRole;
}
