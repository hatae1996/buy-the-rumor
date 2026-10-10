// 서버 게임 (0.2.0 11번): 명령을 game 함수로 보내고 화면 데이터(그 사람이 아는 것)를 받아 둔다.
// 화면 코드는 로컬 게임과 같은 Game 모양만 본다. 시뮬은 폰에서 돌리지 않고, 지도만 시즌 id로 다시 만든다.
// - 명령은 하나씩 차례로 보낸다(앞 명령의 답이 오기 전에 다음을 보내지 않는다).
// - 서버에 닿지 못하면 실패('offline')로 답하고 "다시 연결 중" 표시를 켠다(hooks.onOffline).
// - 견습 세계에서 졸업 명령을 보내 공유 세계 화면이 오면 hooks.onEnterWorld (○○ 세계에 들어갑니다).
import type { Command, CommandError, CommandResult, PlayerView } from '../../sim/economy';
import type { Look, TownFaces } from '../../sim/looks';
import { seasonOfDay, type Season } from '../../sim/season';
import { seasonMap, type AwaySummary } from '../../sim/service';
import type { WorldMap } from '../../sim/worldgen';
import type { Away, CommandReply, Screen } from '../../server/game';
import type { Game } from '../game';
import { ApiError, type Api } from './api';

/** 장날 하루 (서버 src/server/schedule.ts의 DAY_MS와 같다) */
const DAY_MS = 2.5 * 60 * 60 * 1000;

export interface ServerHooks {
  /** 견습을 마치고 공유 세계에 들어갔다 */
  onEnterWorld?: (screen: Screen) => void;
  /** 다른 시즌의 화면이 왔다 (지도가 바뀌어 화면을 새로 연다) */
  onSeasonChange?: (screen: Screen) => void;
  /** 서버에 닿지 못했다 / 다시 닿았다 */
  onOffline?: (offline: boolean) => void;
}

type ViewReply = { ok: true; screen: Screen; away: Away | null } | { ok: false; error: string };
type DayReply = { ok: true; summary: AwaySummary; screen: Screen } | { ok: false; error: string };

/** 서버 쪽 실패 이름을 명령 실패로 (화면은 ERROR_TEXT로 글을 찾는다) */
const fail = (error: string): CommandResult => ({ ok: false, error: error as CommandError });

export class ServerGame implements Game {
  readonly server = true;
  map: WorldMap;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private offline = false;

  private constructor(
    private readonly api: Api,
    readonly playerId: string,
    private screen: Screen,
    private readonly hooks: ServerHooks,
  ) {
    this.map = seasonMap(screen.seasonId);
  }

  /**
   * 화면 데이터를 받아 연다. 공유 세계에도 견습에도 없으면 견습을 시작한다.
   * 열 수 없으면 서버가 준 이유(noSeason, notFounded, worldsFull, seasonClosed …)
   */
  static async open(api: Api, uid: string, hooks: ServerHooks = {}): Promise<{ ok: true; game: ServerGame; away: Away | null } | { ok: false; error: string }> {
    let r = await api.call<ViewReply>('game', { action: 'view' });
    if (!r.ok && r.error === 'noWorld') r = await api.call<ViewReply>('game', { action: 'startApprentice' });
    if (!r.ok) return r;
    return { ok: true, game: new ServerGame(api, uid, r.screen, hooks), away: r.away };
  }

  get place(): Screen['place'] {
    return this.screen.place;
  }

  get seasonId(): string {
    return this.screen.seasonId;
  }

  get worldId(): string {
    return this.screen.worldId;
  }

  view(): PlayerView {
    return this.screen.view;
  }

  faces(): TownFaces | null {
    return this.screen.faces;
  }

  hireFaces(): Record<number, Look> {
    return this.screen.hireFaces;
  }

  seasonOf(day: number): Season {
    return seasonOfDay(day, this.screen.startSeason);
  }

  get inApprentice(): boolean {
    return this.screen.view.apprentice !== null;
  }

  get seasonOver(): boolean {
    return this.screen.view.settlement !== null;
  }

  /** 다음 장날까지: 시즌을 연 때부터 2시간 30분마다, 화면의 day가 다음에 열 장날 */
  msUntilMarket(now: number): number {
    return Math.max(0, this.screen.opensAt + this.screen.view.day * DAY_MS - now);
  }

  msUntilArrival(daysLeft: number, now: number): number | null {
    if (this.inApprentice || this.seasonOver) return null;
    return this.msUntilMarket(now) + Math.max(0, daysLeft - 1) * DAY_MS;
  }

  dispatch(cmd: Command): Promise<CommandResult> {
    return this.serial(async () => {
      const r = await this.call<CommandReply>({ action: 'command', cmd });
      if (r === null) return fail('offline');
      if (r.screen) this.setScreen(r.screen);
      return r.ok ? r.result : fail(r.error);
    });
  }

  /** 화면 데이터를 다시 받는다. 장날이 지나 자리를 비운 사이가 있으면 본 날을 올리고 돌려준다 */
  catchUp(): Promise<AwaySummary | null> {
    return this.serial(async () => {
      const r = await this.call<ViewReply>({ action: 'view' });
      if (r === null || !r.ok) return null;
      this.setScreen(r.screen);
      if (!r.away) return null;
      await this.call({ action: 'seen', day: r.screen.view.day });
      return r.away.summary;
    });
  }

  /** 서버에는 시험용 장날 열기가 없다 */
  passDay(): Promise<AwaySummary | null> {
    return Promise.resolve(null);
  }

  passApprenticeDay(): Promise<AwaySummary | null> {
    return this.serial(async () => {
      const r = await this.call<DayReply>({ action: 'passDay' });
      if (r === null || !r.ok) return null;
      this.setScreen(r.screen);
      return r.summary;
    });
  }

  /** 시즌은 운영자가 연다 (결산 뒤에는 새 시즌을 기다린다) */
  startNextSeason(): boolean {
    return false;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setScreen(s: Screen): void {
    const before = this.screen;
    this.screen = s;
    if (s.seasonId !== before.seasonId) {
      this.map = seasonMap(s.seasonId);
      this.hooks.onSeasonChange?.(s);
    } else if (before.place === 'apprentice' && s.place === 'world') {
      this.hooks.onEnterWorld?.(s);
    }
    this.listeners.forEach((fn) => fn());
  }

  /** 함수를 부른다. 닿지 못하면 null (끊김 표시를 켠다) */
  private async call<T>(body: unknown): Promise<T | null> {
    try {
      const r = await this.api.call<T>('game', body);
      this.setOffline(false);
      return r;
    } catch (e) {
      if (e instanceof ApiError && e.status !== null) throw e;
      this.setOffline(true);
      return null;
    }
  }

  private setOffline(v: boolean): void {
    if (this.offline === v) return;
    this.offline = v;
    this.hooks.onOffline?.(v);
  }

  /** 명령과 화면 받기를 하나씩 차례로 */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
