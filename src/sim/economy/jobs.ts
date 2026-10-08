// 직업 8개: 채집 6개와 가공 2개.
import type { ResourceKind } from '../worldgen';

export type GatherJob = 'fisher' | 'hunter' | 'farmer' | 'woodcutter' | 'miner' | 'salter';
export type CraftJob = 'curer' | 'smith';
export type JobId = GatherJob | CraftJob;

export const GATHER_JOBS: readonly GatherJob[] = ['fisher', 'hunter', 'farmer', 'woodcutter', 'miner', 'salter'];
export const CRAFT_JOBS: readonly CraftJob[] = ['curer', 'smith'];
export const JOBS: readonly JobId[] = [...GATHER_JOBS, ...CRAFT_JOBS];

export const JOB_NAME: Record<JobId, string> = {
  fisher: '어부',
  hunter: '사냥꾼',
  farmer: '농부',
  woodcutter: '나무꾼',
  miner: '광부',
  salter: '염부',
  curer: '염장장이',
  smith: '대장장이',
};

/** 채집 직업이 쓰는 자원지. 사냥꾼과 나무꾼은 같은 숲을 쓴다 */
export const JOB_RESOURCE: Record<GatherJob, ResourceKind> = {
  fisher: 'fish',
  hunter: 'forest',
  farmer: 'field',
  woodcutter: 'forest',
  miner: 'ore',
  salter: 'salt',
};

export const isGatherJob = (j: JobId): j is GatherJob => (GATHER_JOBS as readonly string[]).includes(j);
