// 게임 한 판: 맵과 경제 상태를 들고, 명령을 받고, 실제 시간에 맞춰 날을 넘기고, 저장한다.
// 실제 시간(Date.now)은 여기서만 쓴다. 시뮬레이션은 "하루 넘기기"만 안다.
// 나중에 서버가 생기면 이 클래스가 서버와 이야기하는 자리가 된다.
import {
  advanceDay,
  applyCommand,
  createEconomy,
  noteView,
  playerView,
  type Command,
  type CommandResult,
  type EconomyState,
  type LedgerEntry,
  type NewsItem,
  type NoteView,
  type PlayerView,
} from '../sim/economy';
import { ECONOMY } from '../sim/constants';
import { generateWorld, type WorldMap } from '../sim/worldgen';

/** 게임 속 하루 = 실제 2시간 30분 */
export const DAY_MS = 2.5 * 60 * 60 * 1000;
/** 오래 비웠을 때 한 번에 돌리는 최대 날 수 (시즌 3번) */
const MAX_CATCH_UP_DAYS = 45;
/**
 * 저장 칸. 상태 모양이 바뀌면 숫자를 올려 예전 저장을 쓰지 않는다
 * (v2: 0.0.3 수레, 피로, 원정이 들어감 / v5: 0.0.4 소문 / v6: 0.0.4 말)
 */
const SAVE_KEY = 'buy-the-rumor/save/v6';

interface SaveData {
  version: 1;
  seed: number;
  state: EconomyState;
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
}

export class Game {
  private listeners = new Set<() => void>();

  private constructor(
    readonly map: WorldMap,
    private state: EconomyState,
    private dayStartedAt: number,
  ) {}

  /** 저장된 판이 있으면 이어서, 없으면 새 판 */
  static start(now: number): Game {
    const saved = load();
    if (saved) return new Game(generateWorld(saved.seed), saved.state, saved.dayStartedAt);
    return Game.fresh(now, now % 1_000_000_007);
  }

  static fresh(now: number, seed: number): Game {
    const map = generateWorld(seed);
    const game = new Game(map, createEconomy(map, map.seed, { warmupDays: ECONOMY.warmupDays }), now);
    game.save();
    return game;
  }

  get seed(): number {
    return this.state.seed;
  }

  view(): PlayerView {
    return playerView(this.state, this.map);
  }

  dispatch(cmd: Command): CommandResult {
    const result = applyCommand(this.state, this.map, cmd);
    if (result.ok) this.changed();
    return result;
  }

  /** 다음 장날 정산까지 남은 시간 */
  msUntilMarket(now: number): number {
    return Math.max(0, this.dayStartedAt + DAY_MS - now);
  }

  /** 지나간 날만큼 돌린다. 하루도 안 지났으면 null */
  catchUp(now: number): AwaySummary | null {
    const passed = Math.floor((now - this.dayStartedAt) / DAY_MS);
    if (passed <= 0) return null;
    const days = Math.min(passed, MAX_CATCH_UP_DAYS);
    const summary = this.advance(days);
    // 너무 오래 비웠으면 나머지 날은 건너뛰고 지금부터 다시 센다
    this.dayStartedAt = passed > days ? now - ((now - this.dayStartedAt) % DAY_MS) : this.dayStartedAt + days * DAY_MS;
    this.changed();
    return summary;
  }

  /** 시험용: 기다리지 않고 장날을 연다 */
  passDay(now: number): AwaySummary {
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
    const wasOnRoad = this.state.player.travel !== null;
    const ledgerFrom = this.state.player.ledger.length;
    const newsFrom = this.state.news.length;
    const heard: NoteView[] = [];
    let stamped = 0;
    for (let i = 0; i < days; i++) {
      const r = advanceDay(this.state, this.map);
      heard.push(...r.heard.map(noteView));
      stamped += r.stamped;
    }
    const arrived = wasOnRoad && this.state.player.travel === null;
    return {
      days,
      fromDay,
      toDay: this.state.day,
      ledger: this.state.player.ledger.slice(ledgerFrom),
      news: this.state.news.slice(newsFrom),
      arrivedAt: arrived ? this.state.player.town : null,
      heard,
      stamped,
    };
  }

  private changed(): void {
    this.save();
    this.listeners.forEach((fn) => fn());
  }

  private save(): void {
    const data: SaveData = { version: 1, seed: this.state.seed, state: this.state, dayStartedAt: this.dayStartedAt };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 사생활 보호 모드 등에서는 저장하지 못한다. 그래도 이번 판은 계속할 수 있다
    }
  }
}

function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data.version === 1 && data.state?.version === 1 ? data : null;
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
