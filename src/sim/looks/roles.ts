// 직업별 파츠 범위 (기획서 "NPC 외모", 0.1.6 인수인계의 표): 얼굴이 하나라 상의와 옷 색이 직업을 알려 준다.
// 상의 목록의 한 칸은 파츠 id 하나, 또는 ['top_13', 'top_05']처럼 "앞의 것이 없으면 뒤의 것" 차례다.
// 같은 것을 여러 번 넣으면 그만큼 자주 나온다. 목록과 확률은 초안이다.
import type { JobId } from '../economy/jobs';
import { ANY_CLOTH, BEARD_RATE, DEEP_CLOTH, MALE_RATE } from './catalog';
import type { ClothColorId, LookRole } from './types';

/** 상의 한 칸: 파츠 id, 또는 앞에서부터 그림이 있는 첫 파츠 */
export type PartChoice = string | readonly string[];

export interface RoleRange {
  tops: readonly PartChoice[];
  /** 상의의 주 색 영역(main)에 입히는 직업 색 */
  cloth: readonly ClothColorId[];
  /** 남자 중 수염 비율. 없으면 BEARD_RATE */
  beardRate?: number;
  /** 수염 모양. 없으면 COMMON_BEARDS */
  beards?: readonly PartChoice[];
  /** 남자 비율. 없으면 MALE_RATE */
  maleRate?: number;
  /** 머리 모양. 없으면 COMMON_HAIR (노인은 COMMON_OLD_HAIR) */
  hair?: readonly PartChoice[];
  /** 언제나 노인 (노상인) */
  alwaysOld?: boolean;
}

/** 아무 직업이나 입는 상의: 직업 상의가 이 사람(여자·남자)에게 맞지 않거나 그림이 없을 때 */
export const COMMON_TOPS: readonly PartChoice[] = ['top_03', 'top_07'];

/**
 * 머리 모양. 직업으로 나누지 않는다 (일꾼이 일을 바꿔도 머리는 그대로).
 * 얼굴이 하나라 여자·남자는 머리로 가장 잘 드러난다: 누구나 쓰는 머리(hair_01 짧은 머리, hair_02 생머리)도
 * 남자는 짧은 머리, 여자는 생머리를 자주 고른다
 */
export const COMMON_HAIR: Record<'male' | 'female', readonly PartChoice[]> = {
  male: ['hair_01', 'hair_01', 'hair_01', 'hair_02', 'hair_04', 'hair_04', 'hair_07'],
  female: ['hair_02', 'hair_02', 'hair_02', 'hair_01', 'hair_05', 'hair_05', 'hair_06', 'hair_06', 'hair_07'],
};
/** 노인 머리: 남자는 옆머리만 남은 대머리가 잦다 */
export const COMMON_OLD_HAIR: Record<'male' | 'female', readonly PartChoice[]> = {
  male: ['hair_03', 'hair_03', 'hair_01', 'hair_01', 'hair_02', 'hair_04'],
  female: ['hair_02', 'hair_02', 'hair_01', 'hair_05', 'hair_05', 'hair_06'],
};
export const COMMON_BEARDS: readonly PartChoice[] = ['beard_01', 'beard_02'];

/** 어부·대장장이·광부의 수염 비율 (도시 상인 0.3, 나머지는 BEARD_RATE) */
const BEARDY = 0.5;

const FIELD: RoleRange = { tops: ['top_07', 'top_03'], cloth: ['linen', 'ochre'] };

export const ROLE_RANGES: Record<LookRole, RoleRange> = {
  fisher: { tops: [['top_13', 'top_05'], 'top_03'], cloth: ['indigo', 'deepIndigo'], beardRate: BEARDY, beards: ['beard_01'] },
  miner: { tops: ['top_09', 'top_07'], cloth: DEEP_CLOTH, beardRate: BEARDY, beards: ['beard_01'] },
  hunter: { tops: ['top_09'], cloth: ['olive', 'brown'] },
  farmer: FIELD,
  woodcutter: FIELD,
  curer: FIELD,
  // 염전 일꾼은 표에 없어 농부·나무꾼·염장꾼과 같게 둔다
  salter: FIELD,
  innkeeper: { tops: [['top_10', 'top_04']], cloth: ['cream', 'ochre'] },
  smith: { tops: [['top_11', 'top_09']], cloth: ['deepBrown'], beardRate: BEARDY, beards: ['beard_01'] },
  cityMerchant: { tops: ['top_08', 'top_06'], cloth: ['madder', ...DEEP_CLOTH], beardRate: 0.3, beards: ['beard_02', 'beard_01'] },
  // 장 상인은 표에 없어 도시 상인보다 수수하게 둔다
  merchant: { tops: ['top_08', 'top_03', 'top_04'], cloth: ['madder', 'ochre', 'indigo', 'olive'] },
  villager: { tops: ['top_03', 'top_04', 'top_07', 'top_12'], cloth: ANY_CLOTH },
  // 노상인: 여관의 늙은 상인. 언제나 노인, 옆머리만 남은 대머리가 잦다
  elder: {
    tops: ['top_06', 'top_08'],
    cloth: ['madder', 'deepMadder', 'deepIndigo', 'deepGreen'],
    alwaysOld: true,
    maleRate: 1,
    hair: ['hair_03', 'hair_03', 'hair_03', 'hair_01', 'hair_02'],
    beards: ['beard_02', 'beard_01'],
  },
};

/** 마을 일꾼은 하는 일이 곧 직업 */
export function workerRole(job: JobId): LookRole {
  return job;
}

export const maleRate = (role: LookRole): number => ROLE_RANGES[role].maleRate ?? MALE_RATE;
export const beardRate = (role: LookRole): number => ROLE_RANGES[role].beardRate ?? BEARD_RATE;
