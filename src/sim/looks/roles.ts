// 직업별 파츠 범위 (기획서 "NPC 외모": 완전 랜덤이 아니라 직업에 맞는 파츠와 색 안에서 뽑는다).
// 얼굴만 보고 누군지 짐작할 수 있게: 어부는 두건과 쪽빛, 광부는 가죽 조끼와 어두운 색, 여관 주인은 앞치마, 도시 상인은 진한 색과 모자.
// 목록에 같은 것을 여러 번 넣으면 그만큼 자주 나온다. null은 그 레이어를 비운다. 목록은 초안이다.
import type { JobId } from '../economy/jobs';
import type { ClothColorId, HairColorId, LayerId, LookRole, SkinId } from './types';

/** 직업 하나가 고르는 범위. 적지 않은 레이어와 색은 COMMON에서 */
export interface RoleRange {
  parts?: Partial<Record<LayerId, readonly (string | null)[]>>;
  cloth?: readonly ClothColorId[];
  hatColor?: readonly ClothColorId[];
  hair?: readonly HairColorId[];
  skin?: readonly SkinId[];
}

const NATURAL: readonly ClothColorId[] = ['indigo', 'madder', 'ochre', 'olive', 'linen'];
const DEEP: readonly ClothColorId[] = ['deepIndigo', 'deepMadder', 'deepOlive'];

/** 모든 직업의 기본 범위 */
export const COMMON: Required<RoleRange> & { parts: Record<LayerId, readonly (string | null)[]> } = {
  parts: {
    backHair: [null, null, 'long', 'braid', 'bun', 'nape'],
    face: ['round', 'oval', 'square'],
    top: ['tunic'],
    brows: ['soft', 'thick', 'arched'],
    beard: [null, null, null, 'stubble', 'mustache', 'full'],
    freckles: [null, null, null, 'freckles'],
    wrinkles: [null, null, null, 'lines'],
    frontHair: ['fringe', 'parted', 'swept', 'cropped', 'cropped', null],
    hat: [null],
  },
  cloth: NATURAL,
  hatColor: NATURAL,
  hair: ['black', 'brown', 'brown', 'auburn', 'gray'],
  skin: ['skin1', 'skin2', 'skin3', 'skin4'],
};

export const ROLE_RANGES: Record<LookRole, RoleRange> = {
  fisher: { parts: { top: ['tunic', 'shawl'], hat: ['hood', 'hood', 'kerchief'] }, cloth: ['indigo', 'indigo', 'linen'], hatColor: ['indigo', 'linen'] },
  hunter: { parts: { top: ['cloak', 'leatherVest'], hat: ['hood', null] }, cloth: ['olive', 'ochre', 'deepOlive'], hatColor: ['olive', 'deepOlive'] },
  farmer: { parts: { top: ['tunic', 'pinafore'], hat: ['feltHat', 'kerchief', null] }, cloth: ['ochre', 'linen', 'olive'], hatColor: ['ochre', 'linen'] },
  woodcutter: { parts: { top: ['tunic', 'leatherVest'], hat: ['cap', null] }, cloth: ['madder', 'olive', 'ochre'], hatColor: ['madder', 'olive'] },
  miner: { parts: { top: ['leatherVest'], hat: ['cap', 'hood'] }, cloth: DEEP, hatColor: DEEP },
  salter: { parts: { top: ['tunic', 'apron'], hat: ['kerchief', null] }, cloth: ['linen', 'linen', 'indigo'], hatColor: ['linen'] },
  curer: { parts: { top: ['apron'], hat: ['kerchief', 'cap'] }, cloth: ['madder', 'linen'], hatColor: ['linen', 'madder'] },
  smith: { parts: { top: ['leatherVest', 'apron'], hat: [null, 'cap'] }, cloth: DEEP, hatColor: DEEP },
  innkeeper: { parts: { top: ['apron'], hat: ['kerchief', null] }, cloth: ['linen', 'madder', 'ochre'], hatColor: ['linen'] },
  merchant: { parts: { top: ['tunic', 'shawl', 'pinafore'], hat: ['feltHat', null] }, cloth: ['madder', 'ochre', 'indigo'], hatColor: ['ochre', 'madder'] },
  cityMerchant: { parts: { top: ['cloak', 'shawl'], hat: ['feltHat'] }, cloth: DEEP, hatColor: DEEP },
  villager: { parts: { top: ['tunic', 'pinafore', 'shawl', 'apron'], hat: [null, null, 'kerchief', 'hood'] } },
  // 노상인: 여관의 늙은 상인
  elder: {
    parts: { top: ['cloak'], hat: ['feltHat'], wrinkles: ['lines'], beard: ['full', 'mustache', null] },
    cloth: ['deepMadder', 'deepIndigo'],
    hatColor: ['deepMadder', 'deepIndigo', 'deepOlive'],
    hair: ['gray'],
  },
};

/** 마을 일꾼은 하는 일이 곧 직업 */
export function workerRole(job: JobId): LookRole {
  return job;
}

/** 레이어 하나의 범위 */
export function partRange(role: LookRole, layer: LayerId): readonly (string | null)[] {
  return ROLE_RANGES[role].parts?.[layer] ?? COMMON.parts[layer];
}

export function colorRange(role: LookRole) {
  const r = ROLE_RANGES[role];
  return {
    cloth: r.cloth ?? COMMON.cloth,
    hatColor: r.hatColor ?? COMMON.hatColor,
    hair: r.hair ?? COMMON.hair,
    skin: r.skin ?? COMMON.skin,
  };
}
