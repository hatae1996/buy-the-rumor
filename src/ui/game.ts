// 게임 한 판: 맵과 경제 상태를 들고, 명령을 받고, 실제 시간에 맞춰 날을 넘기고, 저장한다.
// 실제 시간(Date.now)은 여기서만 쓴다. 시뮬레이션은 "하루 넘기기"만 안다.
// 나중에 서버가 생기면 이 클래스가 서버와 이야기하는 자리가 된다.
import {
  applyCommand,
  createEconomy,
  getPlayer,
  nextSeasonEconomy,
  LOCAL_PLAYER,
  playerView,
  type Command,
  type CommandResult,
  type EconomyState,
  type PlayerState,
  type PlayerView,
} from '../sim/economy';
import { ECONOMY } from '../sim/constants';
import { botSpecs, createCrew, type BotBrain } from '../sim/bot';
import { generateWorld, townsForPlayers, type WorldMap } from '../sim/worldgen';
import { hireFaces, townFaces, type Look, type TownFaces } from '../sim/looks';
import { mixSeed } from '../sim/rng';
import { createCart, refitBoards } from '../sim/cart';
import { refitCertificates, type Emblem } from '../sim/ranking';
import { seasonOfDay, type Season } from '../sim/season';
import { awaySummary, SIM_VERSION, tickWorld, type AwaySummary, type PlayerDigest } from '../sim/service';

export type { AwaySummary };

/** 게임 속 하루 = 실제 2시간 30분 */
export const DAY_MS = 2.5 * 60 * 60 * 1000;
/** 오래 비웠을 때 한 번에 돌리는 최대 날 수 (시즌 3번) */
const MAX_CATCH_UP_DAYS = 45;
/**
 * 저장 칸. 상태 모양이 바뀌면 숫자를 올려 예전 저장을 쓰지 않는다
 * (v2: 0.0.3 수레, 피로, 원정이 들어감 / v5: 0.0.4 소문 / v6: 0.0.4 말 / v7: 0.0.4 원정 장비 / v8: 0.0.4 견습 / v9: 0.0.4 랭킹 기록 / v10: 0.0.5 창고 / v11: 0.0.5 일꾼 / v12: 0.0.5 두 번째 행렬 / v13: 0.0.5 은행 계좌 / v14: 0.0.5 알림 설정 / v15: 0.0.5 가 본 마을 / v19: 0.0.9 시즌 125일 / v20: 0.1.0 여러 플레이어 / v21: 0.1.0 봇 상인 / v22: 0.1.0 예약 주문, 신문값 / v23: 0.1.0 랭킹, 시즌 결산 / v24: 0.1.2 장비가 짐칸으로, 산 값, 망가진 칸 / v25: 0.1.3 세계·시즌 id, 매일 신문)
 */
const SAVE_KEY = 'buy-the-rumor/save/v25';

interface SaveData {
  version: 1;
  seed: number;
  state: EconomyState;
  /** 같은 시장의 봇 상인 머릿속 (0.1.0) */
  crew: BotBrain[];
  /** 오늘 장날이 시작된 실제 시각 (ms) */
  dayStartedAt: number;
}

/**
 * 화면이 보는 게임 한 판 (0.2.0): 로컬 게임(LocalGame, 이 폰에서 시뮬을 돌린다)과 서버 게임(ServerGame, 명령을 보내고
 * 화면 데이터를 받는다)이 같은 모양이다. 명령과 날 넘기기는 서버에서 답이 늦게 오므로 Promise로 돌려준다.
 */
export interface Game {
  readonly map: WorldMap;
  /** 이 폰의 플레이어 (서버에서는 로그인한 계정) */
  readonly playerId: string;
  /** 서버 게임인가 (의견 보내기처럼 서버에만 있는 것) */
  readonly server: boolean;
  view(): PlayerView;
  faces(): TownFaces | null;
  seasonOf(day: number): Season;
  hireFaces(): Record<number, Look>;
  dispatch(cmd: Command): Promise<CommandResult>;
  msUntilMarket(now: number): number;
  msUntilArrival(daysLeft: number, now: number): number | null;
  readonly inApprentice: boolean;
  readonly seasonOver: boolean;
  /** 지나간 날을 돌려(로컬) 또는 받아 와(서버) 자리를 비운 사이를 준다 */
  catchUp(now: number): Promise<AwaySummary | null>;
  /** 시험용: 기다리지 않고 장날 (서버에는 없다: null) */
  passDay(now: number): Promise<AwaySummary | null>;
  /** 견습의 "하루 보내기" */
  passApprenticeDay(now: number): Promise<AwaySummary | null>;
  /** 결산을 본 뒤 다음 시즌 (로컬: 새 세계를 저장하고 true. 서버: 시즌은 운영자가 연다, false) */
  startNextSeason(now: number): boolean;
  subscribe(fn: () => void): () => void;
}

/** 이 폰에서 시뮬을 돌리는 게임 (나 + 봇, localStorage에 저장) */
export class LocalGame implements Game {
  private listeners = new Set<() => void>();
  readonly server = false;
  /** 이 폰의 플레이어 (서버에서는 로그인한 계정) */
  readonly playerId = LOCAL_PLAYER;

  private constructor(
    readonly map: WorldMap,
    private state: EconomyState,
    private crew: BotBrain[],
    private dayStartedAt: number,
  ) {}

  /** 저장된 판이 있으면 이어서, 없으면 새 판 */
  static start(now: number): LocalGame {
    return LocalGame.load() ?? LocalGame.fresh(now, now % 1_000_000_007);
  }

  /** 저장된 판. 없으면 null (처음 하는 사람은 시작 화면부터, 0.1.7) */
  static load(): LocalGame | null {
    const saved = load();
    return saved ? new LocalGame(generateWorld(saved.seed, { towns: saved.state.towns.length }), saved.state, saved.crew, saved.dayStartedAt) : null;
  }

  /**
   * 새 판. 처음 하는 사람은 견습으로 시작한다 (기획서 "처음 하는 플레이어"). 두 번째 시즌부터는 건너뛸 수 있다.
   * 같은 시장에 봇 상인이 함께 앉는다 (기본 11명, 개발용 0~20). 마을 수는 사람 수로 정한다 (0.1.1, 나 + 봇 11명이면 6곳)
   */
  static fresh(
    now: number,
    seed: number,
    opt: { apprentice?: boolean; bots?: number; seasonDays?: number; towns?: number; company?: { name: string; face: Look; emblem: Emblem } } = {},
  ): LocalGame {
    const bots = Math.max(0, Math.min(ECONOMY.player.maxLocalBots, Math.floor(opt.bots ?? ECONOMY.player.localBots)));
    const map = generateWorld(seed, { towns: opt.towns ?? townsForPlayers(1 + bots) });
    const specs = botSpecs(map.seed, bots, opt.company ? [opt.company.name] : []);
    const state = createEconomy(map, map.seed, {
      warmupDays: ECONOMY.warmupDays,
      // 시작 화면에서 고른 상단 이름, 얼굴, 문장 (0.1.7). 상인 번호는 로컬이라 1번
      players: [{ id: LOCAL_PLAYER, apprentice: opt.apprentice ?? true, ...opt.company }, ...specs],
    });
    // 봇은 견습을 마친 자리에서 시작한다: 졸업 선물 손수레
    for (const s of specs) getPlayer(state, s.id).cart = createCart('handcart');
    // 시험용: 시즌을 짧게 (결산을 빨리 보려고)
    if (opt.seasonDays && state.season && opt.seasonDays >= 2) state.season.length = Math.min(state.season.length, Math.floor(opt.seasonDays));
    const game = new LocalGame(map, state, createCrew(state, specs.map((s) => s.id)), now);
    game.save();
    return game;
  }

  get seed(): number {
    return this.state.seed;
  }

  view(): PlayerView {
    return playerView(this.state, this.map, this.playerId);
  }

  /** 지금 마을에서 보이는 NPC 얼굴 (0.1.4). 봇이 쓰는 view()와 따로 둔다 */
  faces(): TownFaces | null {
    return townFaces(this.state, this.map, this.playerId);
  }

  /** 그날의 계절 (신문 발행일) */
  seasonOf(day: number): Season {
    return seasonOfDay(day, this.state.startSeason);
  }

  /** 데려온 일꾼 얼굴 (길 위에서도) */
  hireFaces(): Record<number, Look> {
    return hireFaces(this.state, this.playerId);
  }

  /** 명령 (바로 답한다, 시험용) */
  dispatchNow(cmd: Command): CommandResult {
    const result = applyCommand(this.state, this.map, this.playerId, cmd);
    if (result.ok) this.changed();
    return result;
  }

  dispatch(cmd: Command): Promise<CommandResult> {
    return Promise.resolve(this.dispatchNow(cmd));
  }

  /** 다음 장날 정산까지 남은 시간 */
  msUntilMarket(now: number): number {
    return Math.max(0, this.dayStartedAt + DAY_MS - now);
  }

  /**
   * 길 위에서 도착까지 남은 실제 시간. 남은 날의 마지막 날 넘김에 도착한다.
   * 견습 중이거나 시즌이 끝나 시간이 흐르지 않으면 null
   */
  msUntilArrival(daysLeft: number, now: number): number | null {
    if (this.inApprentice || this.seasonOver) return null;
    return this.msUntilMarket(now) + Math.max(0, daysLeft - 1) * DAY_MS;
  }

  /** 견습 중인가. 견습 마을은 혼자 쓰는 마을이라 실제 시간이 흐르지 않는다 */
  get inApprentice(): boolean {
    return this.me.apprentice !== null;
  }

  private get me(): PlayerState {
    return getPlayer(this.state, this.playerId);
  }

  /** 시즌이 끝나 결산을 보는 중인가 (다음 시즌을 시작할 때까지 날이 가지 않는다) */
  get seasonOver(): boolean {
    return this.state.settlement !== null;
  }

  /**
   * 다음 시즌 (질문 89 답): 새 시드로 새 세계를 열고 상인 증서·인장·칭호·연차만 들고 간다.
   * 봇 상인도 같은 이름과 증서로 다시 앉는다. 새 판을 저장하고 돌려준다 (지도가 바뀌므로 부른 쪽이 화면을 새로 연다)
   */
  startNextSeason(now: number): boolean {
    return this.nextSeason(now) !== null;
  }

  /** 다음 시즌의 새 판 (시험용) */
  nextSeason(now: number): LocalGame | null {
    if (!this.seasonOver) return null;
    const seed = mixSeed(this.state.seed, 0x5ea5, this.state.settlement!.season) % 1_000_000_007;
    const map = generateWorld(seed, { towns: this.map.towns.length });
    const state = nextSeasonEconomy(this.state, map, map.seed, { warmupDays: ECONOMY.warmupDays });
    const bots = this.crew.map((b) => b.pid);
    for (const id of bots) getPlayer(state, id).cart = createCart('handcart');
    const next = new LocalGame(map, state, createCrew(state, bots), now);
    next.save();
    return next;
  }

  /** 지나간 날만큼 돌린다. 하루도 안 지났으면 null. 견습 중에는 시간이 멈춰 있다. 시즌이 끝났으면 결산에서 멈춘다 */
  catchUp(now: number): Promise<AwaySummary | null> {
    return Promise.resolve(this.catchUpNow(now));
  }

  /** 지나간 날을 바로 돌린다 (시험용) */
  catchUpNow(now: number): AwaySummary | null {
    if (this.seasonOver) {
      this.dayStartedAt = now;
      return null;
    }
    if (this.inApprentice) {
      this.dayStartedAt = now;
      return null;
    }
    const passed = Math.floor((now - this.dayStartedAt) / DAY_MS);
    if (passed <= 0) return null;
    const days = Math.min(passed, MAX_CATCH_UP_DAYS);
    const summary = this.advance(days);
    // 너무 오래 비웠으면 나머지 날은 건너뛰고 지금부터 다시 센다
    this.dayStartedAt = passed > days ? now - ((now - this.dayStartedAt) % DAY_MS) : this.dayStartedAt + days * DAY_MS;
    this.changed();
    return summary;
  }

  /** 견습의 "하루 보내기": 견습 마을에서만 바로 다음 날로 넘긴다 */
  passApprenticeDay(now: number): Promise<AwaySummary | null> {
    return Promise.resolve(this.passApprenticeDayNow(now));
  }

  passApprenticeDayNow(now: number): AwaySummary | null {
    if (!this.inApprentice) return null;
    return this.passDayNow(now);
  }

  passDay(now: number): Promise<AwaySummary | null> {
    return Promise.resolve(this.passDayNow(now));
  }

  /** 시험용: 기다리지 않고 장날을 연다. 시즌이 끝났으면 null */
  passDayNow(now: number): AwaySummary | null {
    if (this.seasonOver) return null;
    const summary = this.advance(1);
    this.dayStartedAt = now;
    this.changed();
    return summary;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 서버와 같은 하루(src/sim/service): 봇 먼저, 장날, 내 하루치 기록. 요약도 서버와 같은 함수로 */
  private advance(days: number): AwaySummary {
    const fromDay = this.state.day;
    const blob = { simVersion: SIM_VERSION, state: this.state, crew: this.crew };
    const digests: PlayerDigest[] = [];
    for (let i = 0; i < days && !this.seasonOver; i++) {
      const r = tickWorld(blob, this.map, [this.playerId]);
      if (r) digests.push(r.digests[this.playerId]!);
    }
    return awaySummary(this.state, this.map, this.playerId, digests, fromDay);
  }

  private changed(): void {
    this.save();
    this.listeners.forEach((fn) => fn());
  }

  private save(): void {
    store({ version: 1, seed: this.state.seed, state: this.state, crew: this.crew, dayStartedAt: this.dayStartedAt });
  }
}

function store(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // 사생활 보호 모드 등에서는 저장하지 못한다. 그래도 이번 판은 계속할 수 있다
  }
}

function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!(data.version === 1 && data.state?.version === 1 && Array.isArray(data.crew))) return null;
    // 0.1.6: 수레가 세로형으로 바뀌었다. 예전 자리에 있던 짐은 새 모양의 빈자리로 다시 놓는다
    refitBoards(data.state);
    // 0.1.7: 증서에 문장 부품, 얼굴, 상인 번호
    refitCertificates(data.state);
    // 0.2.0: 봇 표시 (예전 저장은 봇 머릿속이 있는 자리가 봇)
    for (const p of Object.values(data.state.players)) if (typeof p.bot !== 'boolean') p.bot = data.crew.some((b) => b.pid === p.id);
    return data;
  } catch {
    return null;
  }
}

/** 시험용: 저장을 지우고 새 판 */
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 무시
  }
}
