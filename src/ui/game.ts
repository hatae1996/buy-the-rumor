// 게임 한 판: 맵과 경제 상태를 들고, 명령을 받고, 실제 시간에 맞춰 날을 넘기고, 저장한다.
// 실제 시간(Date.now)은 여기서만 쓴다. 시뮬레이션은 "하루 넘기기"만 안다.
// 나중에 서버가 생기면 이 클래스가 서버와 이야기하는 자리가 된다.
import {
  advanceDay,
  applyCommand,
  createEconomy,
  getPlayer,
  nextSeasonEconomy,
  LOCAL_PLAYER,
  noteView,
  playerView,
  type Command,
  type CommandResult,
  type EconomyState,
  type LedgerEntry,
  type NewsItem,
  type NoteView,
  type PlayerState,
  type PlayerView,
} from '../sim/economy';
import { ECONOMY } from '../sim/constants';
import { botSpecs, createCrew, crewDay, type BotBrain } from '../sim/bot';
import { generateWorld, type WorldMap } from '../sim/worldgen';
import { mixSeed } from '../sim/rng';
import { createCart } from '../sim/cart';
import type { NotifyEvent } from '../sim/notify';

/** 게임 속 하루 = 실제 2시간 30분 */
export const DAY_MS = 2.5 * 60 * 60 * 1000;
/** 오래 비웠을 때 한 번에 돌리는 최대 날 수 (시즌 3번) */
const MAX_CATCH_UP_DAYS = 45;
/**
 * 저장 칸. 상태 모양이 바뀌면 숫자를 올려 예전 저장을 쓰지 않는다
 * (v2: 0.0.3 수레, 피로, 원정이 들어감 / v5: 0.0.4 소문 / v6: 0.0.4 말 / v7: 0.0.4 원정 장비 / v8: 0.0.4 견습 / v9: 0.0.4 랭킹 기록 / v10: 0.0.5 창고 / v11: 0.0.5 일꾼 / v12: 0.0.5 두 번째 행렬 / v13: 0.0.5 은행 계좌 / v14: 0.0.5 알림 설정 / v15: 0.0.5 가 본 마을 / v19: 0.0.9 시즌 125일 / v20: 0.1.0 여러 플레이어 / v21: 0.1.0 봇 상인 / v22: 0.1.0 예약 주문, 신문값 / v23: 0.1.0 랭킹, 시즌 결산)
 */
const SAVE_KEY = 'buy-the-rumor/save/v23';

interface SaveData {
  version: 1;
  seed: number;
  state: EconomyState;
  /** 같은 시장의 봇 상인 머릿속 (0.1.0) */
  crew: BotBrain[];
  /** 오늘 장날이 시작된 실제 시각 (ms) */
  dayStartedAt: number;
}

/** 자리를 비운 사이 일어난 일 */
export interface AwaySummary {
  days: number;
  fromDay: number;
  toDay: number;
  ledger: LedgerEntry[];
  news: NewsItem[];
  /** 그 사이 도착한 마을 */
  arrivedAt: number | null;
  /** 그 사이 수첩에 새로 적힌 이야기 */
  heard: NoteView[];
  /** 그 사이 새로 찍힌 도장 수 */
  stamped: number;
  /** 그 사이 알림을 보낼 만한 사건 (장날 결과, 급한 일, 도착 등) */
  notices: NotifyEvent[];
}

export class Game {
  private listeners = new Set<() => void>();
  /** 이 폰의 플레이어 (서버에서는 로그인한 계정) */
  readonly playerId = LOCAL_PLAYER;

  private constructor(
    readonly map: WorldMap,
    private state: EconomyState,
    private crew: BotBrain[],
    private dayStartedAt: number,
  ) {}

  /** 저장된 판이 있으면 이어서, 없으면 새 판 */
  static start(now: number): Game {
    const saved = load();
    if (saved) return new Game(generateWorld(saved.seed), saved.state, saved.crew, saved.dayStartedAt);
    return Game.fresh(now, now % 1_000_000_007);
  }

  /**
   * 새 판. 처음 하는 사람은 견습으로 시작한다 (기획서 "처음 하는 플레이어"). 두 번째 시즌부터는 건너뛸 수 있다.
   * 같은 시장에 봇 상인이 함께 앉는다 (기본 10명, 개발용 0~20)
   */
  static fresh(now: number, seed: number, opt: { apprentice?: boolean; bots?: number } = {}): Game {
    const map = generateWorld(seed);
    const bots = Math.max(0, Math.min(ECONOMY.player.maxLocalBots, Math.floor(opt.bots ?? ECONOMY.player.localBots)));
    const specs = botSpecs(map.seed, bots);
    const state = createEconomy(map, map.seed, {
      warmupDays: ECONOMY.warmupDays,
      players: [{ id: LOCAL_PLAYER, apprentice: opt.apprentice ?? true }, ...specs],
    });
    // 봇은 견습을 마친 자리에서 시작한다: 졸업 선물 손수레
    for (const s of specs) getPlayer(state, s.id).cart = createCart('handcart');
    const game = new Game(map, state, createCrew(state, specs.map((s) => s.id)), now);
    game.save();
    return game;
  }

  get seed(): number {
    return this.state.seed;
  }

  view(): PlayerView {
    return playerView(this.state, this.map, this.playerId);
  }

  dispatch(cmd: Command): CommandResult {
    const result = applyCommand(this.state, this.map, this.playerId, cmd);
    if (result.ok) this.changed();
    return result;
  }

  /** 다음 장날 정산까지 남은 시간 */
  msUntilMarket(now: number): number {
    return Math.max(0, this.dayStartedAt + DAY_MS - now);
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
  startNextSeason(now: number): Game | null {
    if (!this.seasonOver) return null;
    const seed = mixSeed(this.state.seed, 0x5ea5, this.state.settlement!.season) % 1_000_000_007;
    const map = generateWorld(seed);
    const state = nextSeasonEconomy(this.state, map, map.seed, { warmupDays: ECONOMY.warmupDays });
    const bots = this.crew.map((b) => b.pid);
    for (const id of bots) getPlayer(state, id).cart = createCart('handcart');
    const next = new Game(map, state, createCrew(state, bots), now);
    next.save();
    return next;
  }

  /** 지나간 날만큼 돌린다. 하루도 안 지났으면 null. 견습 중에는 시간이 멈춰 있다. 시즌이 끝났으면 결산에서 멈춘다 */
  catchUp(now: number): AwaySummary | null {
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
  passApprenticeDay(now: number): AwaySummary | null {
    if (!this.inApprentice) return null;
    return this.passDay(now);
  }

  /** 시험용: 기다리지 않고 장날을 연다. 시즌이 끝났으면 null */
  passDay(now: number): AwaySummary | null {
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

  private advance(days: number): AwaySummary {
    const fromDay = this.state.day;
    const me = this.me;
    const wasOnRoad = me.travel !== null;
    const ledgerFrom = me.ledger.length;
    const heard: NoteView[] = [];
    const notices: NotifyEvent[] = [];
    let stamped = 0;
    let done = 0;
    for (let i = 0; i < days && !this.seasonOver; i++, done++) {
      // 봇 상인은 장날 전에 오늘 할 일을 한다
      crewDay(this.state, this.map, this.crew);
      const r = advanceDay(this.state, this.map).players[this.playerId];
      if (!r) continue;
      heard.push(...r.heard.map(noteView));
      notices.push(...r.notices);
      stamped += r.stamped;
    }
    const arrived = wasOnRoad && me.travel === null;
    return {
      days: done,
      fromDay,
      toDay: this.state.day,
      ledger: me.ledger.slice(ledgerFrom),
      // 신문은 산 날만 전문, 아니면 머리기사만 (0.1.0)
      news: this.view().news.filter((n) => n.day >= fromDay),
      arrivedAt: arrived ? me.town : null,
      heard,
      stamped,
      notices,
    };
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
    return data.version === 1 && data.state?.version === 1 && Array.isArray(data.crew) ? data : null;
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
