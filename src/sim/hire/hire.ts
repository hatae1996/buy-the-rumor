// 여관 고용 게시판 (기획서 "성장", 시안 prototypes/screens-0.0.5.html): 짐꾼, 채집꾼, 마부.
// 일꾼은 그 마을 NPC 일꾼 중에서 데려온다. 데려간 만큼 그 마을 생산이 준다.
// 일당은 그 마을 일손 사정에 따라 오르고, 일당을 못 주면 떠난다(빚이 되지 않는다). 떠나면 다시 그 마을 일꾼이 된다.
// 정보원은 마을 일꾼이 아니라 이름 없는 사람이라 따로 둔다 (src/sim/rumors/pigeon.ts).
import { createCart, type Cart } from '../cart';
import { GROWTH } from '../constants';
import { isGatherJob, JOB_NAME, JOB_RESOURCE, JOBS, type JobId } from '../economy/jobs';
import type { EconomyState, PlayerState, Worker } from '../economy/state';
import { hasBuilding } from '../growth/buildings';
import { mixSeed } from '../rng';
import type { WorldMap } from '../worldgen';
import { restWage } from './wage';

const H = GROWTH.hire;

/** 마을 일꾼에서 데려오는 사람 (정보원은 따로) */
export type HireRole = 'porter' | 'gatherer' | 'carter';

export interface Hire {
  id: number;
  role: HireRole;
  name: string;
  /** 원래 하던 일 (채집꾼은 이 일로 원정한다) */
  job: JobId;
  /** 데려온 마을 (채집꾼은 여기서 일하고, 그만두면 여기로 돌아간다) */
  town: number;
  wage: number;
  since: number;
  /** 데려오면서 마을 일꾼 목록에서 뺀 일꾼 (그만두면 돌려놓는다) */
  worker: Worker;
  /** 짐꾼이 끄는 손수레. 아니면 null */
  board: Cart | null;
}

export type HireError = 'noInn' | 'noWorker' | 'noHire';
type Err = HireError | 'traveling' | 'notEnoughGold';

const NAMES = ['브람', '엘사', '오드', '마르타', '한스', '토마', '일자', '오스윈', '테오', '리나', '게르다', '파울', '욘', '헤다', '루카', '미나', '카를', '베른'];

/** 일꾼 이름 (일꾼 번호로 늘 같은 이름) */
export function workerName(w: Worker): string {
  return NAMES[mixSeed(w.id, 0x4a3e) % NAMES.length]!;
}

/** 이 마을에서 그 일을 하는 일꾼 수 */
function jobCount(state: EconomyState, town: number, job: JobId): number {
  return state.workers.filter((w) => w.town === town && w.job === job).length;
}

/** 일당: 기준값 × 일손 사정 (그 일을 하는 사람이 적을수록 비싸다) */
export function wageFor(state: EconomyState, town: number, role: HireRole, job: JobId): number {
  const short = Math.max(0, H.scarceBelow - jobCount(state, town, job));
  const factor = Math.min(H.wageFactor[1], Math.max(H.wageFactor[0], 1 + short * H.scarceStep));
  return Math.max(1, Math.round(H[role].wage * factor));
}

/**
 * 게시판에 나온 사람: 채집꾼은 그 마을 채집 일꾼 중 가장 흔한 일에서, 짐꾼·마부는 가장 흔한 일에서.
 * 마을에 일꾼이 너무 적으면 아무도 나오지 않는다
 */
export function candidate(state: EconomyState, town: number, role: HireRole): Worker | null {
  const here = state.workers.filter((w) => w.town === town);
  if (here.length <= H.minLeft) return null;
  const t = state.towns[town]!;
  const jobs = JOBS.filter((j) =>
    role === 'gatherer' ? isGatherJob(j) && t.nodes.some((n) => n.kind === JOB_RESOURCE[j as keyof typeof JOB_RESOURCE]) : true,
  );
  const best = jobs
    .map((j) => ({ j, n: jobCount(state, town, j) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  if (!best) return null;
  // 게시판에 같은 사람이 세 자리로 나오지 않도록 자리마다 다른 사람을 고른다
  const pool = here.filter((w) => w.job === best.j).sort((a, b) => a.id - b.id);
  return pool[ROLE_PICK[role] % pool.length] ?? null;
}

const ROLE_PICK: Record<HireRole, number> = { porter: 0, carter: 1, gatherer: 2 };

export interface HireOffer {
  role: HireRole;
  name: string;
  job: JobId;
  jobName: string;
  wage: number;
  /** 마부가 쉬는 날 일당 (0.0.9). 다른 일꾼은 null */
  restWage: number | null;
}

/** 지금 마을 게시판 (여관이 있는 마을에서만) */
export function hireBoard(state: EconomyState, p: PlayerState, map: WorldMap): HireOffer[] {
  if (p.travel || !hasBuilding(state, map, p.town, 'inn')) return [];
  const out: HireOffer[] = [];
  for (const role of ['porter', 'gatherer', 'carter'] as const) {
    const w = candidate(state, p.town, role);
    if (!w) continue;
    const wage = wageFor(state, p.town, role, w.job);
    out.push({ role, name: workerName(w), job: w.job, jobName: JOB_NAME[w.job], wage, restWage: role === 'carter' ? restWage({ wage }) : null });
  }
  return out;
}

/** 게시판에서 고용한다. 하루치 일당을 먼저 준다 */
export function hire(state: EconomyState, p: PlayerState, map: WorldMap, role: HireRole): Err | null {
  if (p.travel) return 'traveling';
  if (!hasBuilding(state, map, p.town, 'inn')) return 'noInn';
  const w = candidate(state, p.town, role);
  if (!w) return 'noWorker';
  const wage = wageFor(state, p.town, role, w.job);
  const advance = wage * H.advanceDays;
  if (p.gold < advance) return 'notEnoughGold';
  p.gold -= advance;
  state.towns[p.town]!.treasury += advance;
  state.workers = state.workers.filter((x) => x !== w);
  const h: Hire = {
    id: state.nextId++,
    role,
    name: workerName(w),
    job: w.job,
    town: p.town,
    wage,
    since: state.day,
    worker: w,
    board: role === 'porter' ? createCart('handcart') : null,
  };
  p.hires.push(h);
  p.ledger.push({ day: state.day, kind: 'hire', what: 'hire', role, name: h.name, town: p.town, fee: advance });
  return null;
}

/** 일꾼을 내보낸다. 짐꾼 수레에 짐이 있으면 먼저 옮겨야 한다 */
export function dismiss(state: EconomyState, p: PlayerState, hireId: number): Err | 'boardNotEmpty' | null {
  const h = p.hires.find((x) => x.id === hireId);
  if (!h) return 'noHire';
  if (h.board && h.board.pieces.length) return 'boardNotEmpty';
  release(state, p, h);
  p.ledger.push({ day: state.day, kind: 'hire', what: 'dismiss', role: h.role, name: h.name, town: h.town, fee: 0 });
  return null;
}

/** 일꾼을 그 마을 일꾼으로 돌려놓는다 */
export function release(state: EconomyState, p: PlayerState, h: Hire): void {
  p.hires = p.hires.filter((x) => x !== h);
  state.workers.push({ ...h.worker, town: h.town });
}
