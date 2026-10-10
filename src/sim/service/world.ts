// 서버(0.2.0)가 세계 하나를 다루는 입구. 화면 쪽 Game이 하던 일(세계 열기, 봇과 하루 돌리기, 명령, 화면 데이터)을
// 실제 시간 없이 모은다. 서버 함수는 표에서 WorldBlob을 읽어 이 함수들을 부르고 다시 저장할 뿐이다.
// 모든 함수는 blob을 그 자리에서 바꾼다(시뮬과 같다). 실패한 명령은 바꾸지 않는다.
import { ECONOMY } from '../constants';
import { botSpecs, createCrew, crewDay, type BotBrain } from '../bot';
import { createCart } from '../cart';
import {
  advanceDay,
  applyCommand,
  createEconomy,
  getPlayer,
  playerView,
  seasonSeed,
  type Command,
  type CommandResult,
  type DayReport,
  type EconomyState,
  type PlayerId,
  type PlayerSpec,
  type PlayerView,
} from '../economy';
import { townFaces, type TownFaces } from '../looks';
import { scoreRows, type ScoreRow } from '../ranking';
import { generateWorld, type WorldMap } from '../worldgen';
import { digestAfter, markBefore, type PlayerDigest } from './away';
import { SIM_VERSION } from './version';

/** 서버 세계는 인원과 상관없이 늘 마을 6곳, 같은 시즌이면 같은 지도 (답 104·105) */
export const SERVER_TOWNS = 6;

/** 표(worlds.state)에 저장하는 것: 세계 상태와 봇 머릿속. 맵은 시드로 다시 만든다 */
export interface WorldBlob {
  /** 이 상태를 만든 시뮬 버전. 번들의 SIM_VERSION과 다르면 돌리지 않는다 */
  simVersion: number;
  state: EconomyState;
  crew: BotBrain[];
}

export interface OpenWorldOptions {
  seasonId: string;
  worldId: string;
  /** 사람 (들어온 차례대로). 상인 번호는 계정의 번호 */
  humans?: PlayerSpec[];
  /** 채울 봇 수. 봇은 견습을 마친 자리(손수레)에서 시작하고 상인 번호가 없다 (답 132) */
  bots?: number;
  /** 미리 돌리는 날 (기본 ECONOMY.warmupDays). 시험에서 줄인다 */
  warmupDays?: number;
}

/** 시즌 id로 맵을 만든다. 같은 시즌의 세계는 모두 같은 지도 */
export function seasonMap(seasonId: string): WorldMap {
  return generateWorld(seasonSeed(seasonId), { towns: SERVER_TOWNS });
}

/** 새 세계를 연다 (시즌 1일 장날 전) */
export function openWorld(map: WorldMap, opt: OpenWorldOptions): WorldBlob {
  const humans = opt.humans ?? [];
  const specs = botSpecs(
    map.seed,
    opt.bots ?? 0,
    humans.flatMap((h) => (h.name ? [h.name] : [])),
  ).map((b): PlayerSpec => ({ ...b, apprentice: false, merchantNo: null }));
  const state = createEconomy(map, map.seed, {
    warmupDays: opt.warmupDays ?? ECONOMY.warmupDays,
    world: { seasonId: opt.seasonId, worldId: opt.worldId },
    players: [...humans, ...specs],
  });
  for (const s of specs) getPlayer(state, s.id).cart = createCart('handcart');
  return { simVersion: SIM_VERSION, state, crew: createCrew(state, specs.map((s) => s.id)) };
}

export class SimVersionMismatch extends Error {
  constructor(readonly world: number, readonly bundle: number) {
    super(`시뮬 버전이 다르다: 세계 ${world}, 번들 ${bundle}`);
  }
}

/** 이 번들로 돌려도 되는 세계인가 (handoff 0.2.0 3번: 다르면 장날을 멈추고 알린다) */
export function assertSimVersion(blob: WorldBlob): void {
  if (blob.simVersion !== SIM_VERSION) throw new SimVersionMismatch(blob.simVersion, SIM_VERSION);
}

export interface TickResult {
  report: DayReport;
  /** 장날을 돌린 뒤의 점수 줄 (score_rows 표에) */
  rows: ScoreRow[];
  /** watch로 넘긴 사람마다 하루치 기록 ("자리를 비운 사이", day_reports 표에) */
  digests: Record<PlayerId, PlayerDigest>;
}

/**
 * 장날 하루: 봇이 먼저 오늘 할 일을 하고 장날을 연다 (로컬 Game.advance와 같은 차례).
 * 시즌이 끝나 결산 중이면 null
 */
export function tickWorld(blob: WorldBlob, map: WorldMap, watch: readonly PlayerId[] = []): TickResult | null {
  assertSimVersion(blob);
  if (blob.state.settlement) return null;
  crewDay(blob.state, map, blob.crew);
  // 봇 판단은 사람의 짐과 장부를 건드리지 않으니, 사람의 "돌리기 전"은 봇 다음에 적어도 같다
  const marks = watch.map((pid) => [pid, markBefore(blob.state, pid)] as const);
  const report = advanceDay(blob.state, map);
  const digests: Record<PlayerId, PlayerDigest> = {};
  for (const [pid, mark] of marks) digests[pid] = digestAfter(blob.state, pid, mark, report.day, report.players[pid]);
  return { report, rows: scoreRows(blob.state), digests };
}

/** 사람의 명령 하나. 봇의 명령은 받지 않는다 */
export function commandWorld(blob: WorldBlob, map: WorldMap, pid: PlayerId, cmd: Command): CommandResult {
  assertSimVersion(blob);
  if (blob.crew.some((b) => b.pid === pid)) throw new Error('봇 자리에는 명령을 보낼 수 없다');
  return applyCommand(blob.state, map, pid, cmd);
}

/** 폰에 보내는 화면 데이터: 플레이어가 아는 것과 지금 마을의 얼굴뿐 */
export interface ScreenData {
  view: PlayerView;
  faces: TownFaces | null;
}

export function screenData(blob: WorldBlob, map: WorldMap, pid: PlayerId): ScreenData {
  return { view: playerView(blob.state, map, pid), faces: townFaces(blob.state, map, pid) };
}
