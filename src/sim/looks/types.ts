// NPC 외모 (기획서 "NPC 외모", 0.1.4): 파츠를 레이어 순서대로 겹치고, 색은 게임에서 곱해 입힌다.
// 외모(Look)는 누구의 얼굴인지 모른다. 나중에 플레이어 상인 증서 사진도 같은 모양을 쓴다.

/** 레이어 (아래에서 위로 그리는 순서는 catalog.ts의 LAYERS) */
export type LayerId = 'backHair' | 'face' | 'top' | 'brows' | 'beard' | 'freckles' | 'wrinkles' | 'frontHair' | 'hat';

/** 파츠에 곱하는 색: 피부, 머리, 옷, 모자. null이면 그림 그대로 */
export type TintId = 'skin' | 'hair' | 'cloth' | 'hat';

export type ClothColorId = 'indigo' | 'madder' | 'ochre' | 'olive' | 'linen' | 'deepIndigo' | 'deepMadder' | 'deepOlive';
export type SkinId = 'skin1' | 'skin2' | 'skin3' | 'skin4';
export type HairColorId = 'black' | 'brown' | 'auburn' | 'gray';
/** 머리 모양: 앞머리·옆머리와 뒷머리 한 벌 (catalog.ts의 HAIR_STYLES) */
export type HairStyleId = 'curly' | 'cropped' | 'balding' | 'bun' | 'braid' | 'long' | 'ponytail';

export interface Look {
  /** 레이어마다 파츠 id. 비어 있는 레이어는 null (그리지 않고 건너뛴다) */
  parts: Record<LayerId, string | null>;
  skin: SkinId;
  hair: HairColorId;
  cloth: ClothColorId;
  /** 모자·두건 색 (모자가 없어도 정해 둔다) */
  hatColor: ClothColorId;
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
