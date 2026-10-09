// 수가 정해진 것은 하루 끝에 추첨한다 (기획서 "멀티플레이 구조", 질문 86 답, 0.1.0).
// 마구간의 말, 여관 게시판의 일꾼은 먼저 온 사람이 가져가지 않는다. 그날 "사겠다"고 신청한 사람을 모아
// 하루 끝에 시드로 섞어 뽑는다. 신청할 때 값을 맡겨 두고(장날 신청처럼), 떨어지면 그대로 돌려준다.
// 값은 뽑는 때 걸린 값. 그 사이 값이 내렸으면 차액을 돌려준다.
// 수레·장비·창고처럼 수가 정해지지 않은 것은 바로 산다.
import { GROWTH, HORSES } from '../constants';
import { getPlayer } from '../economy/players';
import type { EconomyState, PlayerId, PlayerState } from '../economy/state';
import { hasBuilding } from '../growth/buildings';
import { candidate, hire, wageFor, type HireRole } from '../hire/hire';
import { buyHorse } from '../horses/commands';
import { buyPrice } from '../horses/stable';
import { stableAt } from '../horses/supply';
import type { HorseKind } from '../horses/types';
import { createRng, mixSeed, shuffle } from '../rng';
import type { WorldMap } from '../worldgen';

/** 추첨 신청 하나 (말 한 필, 또는 게시판 일꾼 한 명) */
export type DrawRequest = {
  id: number;
  pid: PlayerId;
  /** 신청한 날. 그날 밤에 뽑는다 */
  day: number;
  town: number;
  /** 맡겨 둔 돈 (신청할 때 걸린 값) */
  reserved: number;
} & ({ kind: 'horse'; horse: HorseKind } | { kind: 'hire'; role: HireRole });

export type DrawError = 'alreadyRequested' | 'noDraw';
type Err = DrawError | 'traveling' | 'noStable' | 'noHorseLeft' | 'tooManyHorses' | 'notEnoughGold' | 'noInn' | 'noWorker';

/** 이 플레이어가 낸 신청 */
export const drawsOf = (state: EconomyState, p: PlayerState): DrawRequest[] => state.draws.filter((d) => d.pid === p.id);

/** 말 사기 신청: 지금 마을 마구간에 그 말이 있어야 하고, 가진 말과 신청한 말을 합쳐 최대 2필 */
export function requestHorse(state: EconomyState, p: PlayerState, kind: HorseKind): Err | null {
  if (p.travel) return 'traveling';
  const stable = stableAt(state, p.town);
  if (!stable) return 'noStable';
  const pending = drawsOf(state, p).filter((d) => d.kind === 'horse').length;
  if (p.horses.length + (p.caravan?.horses.length ?? 0) + pending >= HORSES.maxPerOwner) return 'tooManyHorses';
  const price = buyPrice(stable, kind);
  if (price === null) return 'noHorseLeft';
  if (p.gold < price) return 'notEnoughGold';
  return place(state, p, price, { kind: 'horse', horse: kind });
}

/** 게시판 일꾼 고용 신청: 하루치 일당(선불)을 맡긴다. 같은 마을 같은 자리는 하루 한 번 */
export function requestHire(state: EconomyState, p: PlayerState, map: WorldMap, role: HireRole): Err | null {
  if (p.travel) return 'traveling';
  if (!hasBuilding(state, map, p.town, 'inn')) return 'noInn';
  const w = candidate(state, p.town, role);
  if (!w) return 'noWorker';
  if (drawsOf(state, p).some((d) => d.kind === 'hire' && d.role === role && d.town === p.town)) return 'alreadyRequested';
  const advance = wageFor(state, p.town, role, w.job) * GROWTH.hire.advanceDays;
  if (p.gold < advance) return 'notEnoughGold';
  return place(state, p, advance, { kind: 'hire', role });
}

function place(state: EconomyState, p: PlayerState, reserved: number, what: { kind: 'horse'; horse: HorseKind } | { kind: 'hire'; role: HireRole }): null {
  p.gold -= reserved;
  state.draws.push({ id: state.nextId++, pid: p.id, day: state.day, town: p.town, reserved, ...what });
  return null;
}

/** 신청을 거둔다 (맡긴 돈을 돌려준다) */
export function cancelDraw(state: EconomyState, p: PlayerState, id: number): Err | null {
  const d = state.draws.find((x) => x.id === id && x.pid === p.id);
  if (!d) return 'noDraw';
  refund(state, d);
  state.draws = state.draws.filter((x) => x !== d);
  return null;
}

/** 떠나면 이 마을에 낸 신청은 거둔다 (말과 일꾼은 그 마을에서 받아 가야 한다) */
export function cancelDrawsOnLeave(state: EconomyState, p: PlayerState): void {
  for (const d of drawsOf(state, p)) refund(state, d);
  state.draws = state.draws.filter((d) => d.pid !== p.id);
}

function refund(state: EconomyState, d: DrawRequest): void {
  getPlayer(state, d.pid).gold += d.reserved;
}

/**
 * 하루 끝에 뽑는다 (그날 장날 전에). 마구간·게시판마다 신청을 시드로 섞어 차례대로 준다:
 * 말은 남은 수만큼, 게시판 일꾼은 한 자리에 한 사람. 떨어지면 맡긴 돈을 돌려주고 장부에 적는다
 */
export function resolveDraws(state: EconomyState, map: WorldMap): void {
  if (!state.draws.length) return;
  const rng = createRng(mixSeed(state.seed, 0xd7a3, state.day));
  // 신청 순서는 보지 않는다: 플레이어 차례(들어온 차례)로 세운 뒤 섞는다. 먼저 낸 사람이 유리하지 않고,
  // 같은 사람들이 같은 날 같은 것을 신청하면 누가 먼저 냈든 결과가 같다
  const seq = (d: DrawRequest) => getPlayer(state, d.pid).seq;
  const requests = shuffle([...state.draws].sort((a, b) => seq(a) - seq(b) || a.id - b.id), rng);
  state.draws = [];
  const taken = new Set<string>();
  for (const d of requests) {
    const p = getPlayer(state, d.pid);
    refund(state, d);
    const won = d.kind === 'horse' ? drawHorse(state, p, d) : drawHire(state, p, map, d, taken);
    if (!won) p.ledger.push({ day: state.day, kind: 'draw', what: d.kind, town: d.town, ...(d.kind === 'horse' ? { horse: d.horse } : { role: d.role }) });
  }
}

/** 그 마구간에 그 말이 남았고, 아직 그 마을에 있고, 돈이 있으면 산다 (돈은 이미 돌려받은 뒤) */
function drawHorse(state: EconomyState, p: PlayerState, d: DrawRequest & { kind: 'horse' }): boolean {
  if (p.travel || p.town !== d.town) return false;
  return buyHorse(state, p, d.horse) === null;
}

/** 게시판 한 자리는 하루 한 사람 */
function drawHire(state: EconomyState, p: PlayerState, map: WorldMap, d: DrawRequest & { kind: 'hire' }, taken: Set<string>): boolean {
  const key = `${d.town}:${d.role}`;
  if (taken.has(key) || p.travel || p.town !== d.town) return false;
  if (hire(state, p, map, d.role) !== null) return false;
  taken.add(key);
  return true;
}
