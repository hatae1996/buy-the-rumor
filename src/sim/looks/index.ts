export {
  ANY_CLOTH,
  AVAILABLE_PARTS,
  BEARD_RATE,
  CLOTH_COLORS,
  DEEP_CLOTH,
  HAIR_COLORS,
  MALE_RATE,
  OLD_RATE,
  PARTS,
  PORTRAIT_CANVAS,
  PORTRAIT_GAME,
  REGION_PALETTE,
  SKINS,
  YOUNG_HAIR_COLORS,
  type PartInfo,
  type Rgb,
} from './catalog';
export { KIT_PARTS } from './kitParts';
export { COMMON_BEARDS, COMMON_HAIR, COMMON_OLD_HAIR, COMMON_TOPS, ROLE_RANGES, beardRate, maleRate, workerRole, type PartChoice, type RoleRange } from './roles';
export { assignLooks, drawLook, lookKey, npcKey, npcOrder, resolveChoices, rollLook } from './draw';
export { townFaces, worldLooks, worldNpcs, type TownFaces } from './roster';
export type * from './types';
