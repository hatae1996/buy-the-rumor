// 봇 여럿이 한 시장 (0.1.0 작업 2): 세계 하나에 플레이어 봇 n명을 앉혀 한 시즌 돌리고,
// 서로 경쟁할 때의 벌이, 독점, 말 추첨, 큰 주문을 잰다 (기획서 "NPC 경제와 플레이어 수의 비율", handoff 0.1.0 합격 기준).
import { createCart } from '../cart';
import { advanceDay, createEconomy, getPlayer, isPlayerOwner, playerOrder, type EconomyState, type GoodId, type PlayerId } from '../economy';
import { eventDef } from '../events';
import { generateWorld, townsForPlayers, type WorldMap } from '../worldgen';
import type { Season } from '../season';
import { botProfile, type BotProfile } from './profiles';
import { createSeat, finishSeat, seasonIncome, seatDay, seatRecord, type BotRun, type BotSeat } from './run';

/** 성향 섞기: 보통 사람이 절반, 장사꾼과 원정꾼이 넷에 하나씩. n명이면 이 차례를 되풀이한다 */
export const MARKET_MIX: readonly BotProfile[] = [botProfile('casual'), botProfile('trader'), botProfile('casual'), botProfile('gatherer')];

export interface MarketRunOptions {
  days: number;
  warmupDays?: number;
  startSeason?: Season;
  maxCommandsPerDay?: number;
}

/** 봇 하나의 기록 (어느 자리였나) */
export interface SeatRun extends BotRun {
  pid: PlayerId;
}

export interface MarketStats {
  /** 한 마을·한 물품에서 상위 1명이 그날 플레이어 판매의 50%를 넘은 날 수 (가장 많은 곳) */
  monopolyDays: number;
  monopolyAt: { town: number; good: GoodId } | null;
  /** 같은 한 사람이 한 마을·한 물품에서 그날 플레이어 판매의 50%를 넘은 날 수 (가장 많은 사람과 곳). 날마다 다른 사람이면 독점이 아니다 */
  soleDays: number;
  /** 마을·물품마다 시즌 플레이어 판매량 중 상위 1명, 상위 10%의 몫 (판매량으로 가중 평균) */
  top1Share: number;
  top10Share: number;
  /** 말을 원한 사람(한 번이라도 신청), 시즌 내내 한 마리도 못 산 사람 */
  horseWanted: number;
  horseNever: number;
  /** 처음 신청한 날부터 처음 산 날까지 (산 사람만, 평균) */
  horseWaitDays: number | null;
  /** 큰 주문마다: 주문 물품을 그 마을 장에 낸 사람, 그중 한 개도 못 판 사람 */
  bigOrders: { event: string; town: number; good: GoodId; joined: number; soldNone: number }[];
}

export interface MarketRun {
  n: number;
  seats: SeatRun[];
  stats: MarketStats;
  /** 날마다 모든 마을 장날 거래량과 그중 플레이어가 판 양 */
  daily: { volume: number; playerSold: number }[];
  /** 시즌 끝 마을 기준 시세 (플레이어 없는 세계와 비교할 때) */
  prices: Record<GoodId, number>[];
}

/** 봇 n명이 한 세계에서 한 시즌. n = 0이면 플레이어 없는 세계 (NPC만) */
export function runBots(seed: number, n: number, opt: MarketRunOptions, world?: WorldMap, mix: readonly BotProfile[] = MARKET_MIX): MarketRun {
  const m = startBots(seed, n, opt, world, mix);
  while (m.step());
  return m.result();
}

/** 하루씩 돌리는 봇 n명 한 시장 (관찰 화면이 멈추지 않게 나눠 돌린다) */
export interface MarketStepper {
  /** 하루를 돌린다. 시즌이 끝났으면 false */
  step(): boolean;
  readonly day: number;
  result(): MarketRun;
}

export function startBots(seed: number, n: number, opt: MarketRunOptions, world?: WorldMap, mix: readonly BotProfile[] = MARKET_MIX): MarketStepper {
  // 맵을 주지 않으면 봇 수에 맞는 마을 수로 (0.1.1)
  const map = world ?? generateWorld(seed, { towns: townsForPlayers(n) });
  const ids = Array.from({ length: n }, (_, i) => `bot${i + 1}`);
  const state = createEconomy(map, seed, { warmupDays: opt.warmupDays ?? 20, startSeason: opt.startSeason, players: ids.map((id) => ({ id })) });
  // 봇은 견습을 마친 자리에서 시작한다: 졸업 선물 손수레
  for (const id of ids) getPlayer(state, id).cart = createCart('handcart');
  const seats = new Map(ids.map((id, i) => [id, createSeat(state, id, mix[i % mix.length]!)] as const));
  const watch = createWatch();
  let day = 0;
  return {
    get day() {
      return day;
    },
    step() {
      if (day >= opt.days) return false;
      // 명령은 오늘 차례대로 (장날은 동시호가라 차례가 값을 바꾸지 않는다. 바로 사는 것만 차례를 탄다)
      for (const p of playerOrder(state)) seatDay(state, map, seats.get(p.id)!, opt.maxCommandsPerDay);
      watch.beforeDay(state);
      const before = new Map(ids.map((id) => [id, getPlayer(state, id).ledger.length]));
      const report = advanceDay(state, map);
      for (const seat of seats.values()) seatRecord(state, seat, before.get(seat.pid)!);
      watch.afterDay(state, before, report.markets);
      day++;
      return day < opt.days;
    },
    result() {
      return {
        n,
        seats: [...seats.values()].map((s: BotSeat) => ({ ...finishSeat(state, s, day), pid: s.pid })),
        stats: watch.stats(),
        daily: watch.daily,
        prices: state.towns.map((t) => ({ ...t.refPrice })),
      };
    },
  };
}

/** 하루마다 장날 신청과 장부를 보고 시장 수치를 모은다 */
function createWatch() {
  // 마을·물품 → 플레이어 → 시즌 판매량
  const season = new Map<string, Map<PlayerId, number>>();
  const monopoly = new Map<string, number>();
  const sole = new Map<string, number>();
  const firstAsk = new Map<PlayerId, number>();
  const firstHorse = new Map<PlayerId, number>();
  // 큰 주문마다 낸 사람과 판 사람
  const big = new Map<number, { event: string; town: number; good: GoodId; joined: Set<PlayerId>; sold: Set<PlayerId> }>();
  let offered: { event: number; pid: PlayerId; good: GoodId; town: number }[] = [];
  const daily: { volume: number; playerSold: number }[] = [];

  return {
    daily,
    beforeDay(state: EconomyState): void {
      for (const d of state.draws) if (d.kind === 'horse' && !firstAsk.has(d.pid)) firstAsk.set(d.pid, d.day);
      // 오늘 열린 큰 주문에 그 물품을 낸 플레이어
      offered = [];
      for (const ev of state.events) {
        if (!ev.orders?.length || ev.start > state.day || ev.end < state.day) continue;
        const rec = (g: GoodId) => {
          const key = ev.id * 100 + ev.orders!.findIndex((o) => o.good === g);
          if (!big.has(key)) big.set(key, { event: eventDef(ev.event).name, town: ev.town, good: g, joined: new Set(), sold: new Set() });
          return key;
        };
        for (const o of ev.orders) {
          if (o.left <= 0) continue;
          for (const x of state.orders) {
            if (x.side !== 'sell' || x.town !== ev.town || x.good !== o.good || !isPlayerOwner(x.owner)) continue;
            const key = rec(o.good);
            big.get(key)!.joined.add(x.owner.pid);
            offered.push({ event: key, pid: x.owner.pid, good: o.good, town: ev.town });
          }
        }
      }
    },
    afterDay(state: EconomyState, before: Map<PlayerId, number>, markets: readonly Record<GoodId, { volume: number }>[]): void {
      const today = new Map<string, Map<PlayerId, number>>();
      let playerSold = 0;
      for (const [pid, from] of before) {
        for (const e of getPlayer(state, pid).ledger.slice(from)) {
          if (e.kind === 'horse' && e.what === 'buy' && !firstHorse.has(pid)) firstHorse.set(pid, e.day);
          if (e.kind !== 'sell') continue;
          playerSold += e.qty;
          const key = `${e.town}:${e.good}`;
          const t = today.get(key) ?? new Map<PlayerId, number>();
          t.set(pid, (t.get(pid) ?? 0) + e.qty);
          today.set(key, t);
          const s = season.get(key) ?? new Map<PlayerId, number>();
          s.set(pid, (s.get(pid) ?? 0) + e.qty);
          season.set(key, s);
          for (const o of offered) if (o.pid === pid && o.town === e.town && o.good === e.good) big.get(o.event)!.sold.add(pid);
        }
      }
      for (const [key, sellers] of today) {
        const qty = [...sellers.values()];
        const total = qty.reduce((a, b) => a + b, 0);
        if (total > 0 && Math.max(...qty) / total > 0.5) {
          monopoly.set(key, (monopoly.get(key) ?? 0) + 1);
          const top = [...sellers].find(([, q]) => q === Math.max(...qty))![0];
          sole.set(`${key}:${top}`, (sole.get(`${key}:${top}`) ?? 0) + 1);
        }
      }
      const volume = markets.reduce((a, m) => a + Object.values(m).reduce((b, r) => b + r.volume, 0), 0);
      daily.push({ volume, playerSold });
    },
    stats(): MarketStats {
      let worst: [string, number] | null = null;
      for (const [k, v] of monopoly) if (!worst || v > worst[1]) worst = [k, v];
      let total = 0;
      let top1 = 0;
      let top10 = 0;
      for (const sellers of season.values()) {
        const qty = [...sellers.values()].sort((a, b) => b - a);
        const sum = qty.reduce((a, b) => a + b, 0);
        const k = Math.max(1, Math.ceil(qty.length * 0.1));
        total += sum;
        top1 += qty[0]!;
        top10 += qty.slice(0, k).reduce((a, b) => a + b, 0);
      }
      const waits = [...firstHorse].filter(([pid]) => firstAsk.has(pid)).map(([pid, d]) => d - firstAsk.get(pid)!);
      const wanted = new Set([...firstAsk.keys(), ...firstHorse.keys()]);
      const [town, good] = worst ? worst[0].split(':') : [];
      return {
        monopolyDays: worst?.[1] ?? 0,
        monopolyAt: worst ? { town: Number(town), good: good as GoodId } : null,
        soleDays: Math.max(0, ...sole.values()),
        top1Share: total ? top1 / total : 0,
        top10Share: total ? top10 / total : 0,
        horseWanted: wanted.size,
        horseNever: [...wanted].filter((pid) => !firstHorse.has(pid)).length,
        horseWaitDays: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
        bigOrders: [...big.values()].map((b) => ({ event: b.event, town: b.town, good: b.good, joined: b.joined.size, soldNone: [...b.joined].filter((p) => !b.sold.has(p)).length })),
      };
    },
  };
}

/** 성향별 시즌 평균 하루 벌이·끝 순자산의 가운데 값 */
export function byProfile(run: MarketRun): Record<string, { count: number; income: number; endWorth: number }> {
  const out: Record<string, { count: number; income: number; endWorth: number }> = {};
  const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  const groups = new Map<string, SeatRun[]>();
  for (const s of run.seats) groups.set(s.profile.id, [...(groups.get(s.profile.id) ?? []), s]);
  for (const [id, seats] of groups) {
    out[id] = { count: seats.length, income: med(seats.map((s) => seasonIncome(s).avg)), endWorth: med(seats.map((s) => s.worth.at(-1) ?? 0)) };
  }
  return out;
}

/** 합격 기준 (handoff 0.1.0)으로 본 문제. 참이면 문제다 */
export interface MarketProblems {
  /** 한 마을·한 물품에서 상위 1명이 플레이어 판매의 50%를 넘은 날이 시즌의 절반을 넘었다 */
  monopoly: boolean;
  /** 말을 원한 사람 중 시즌 내내 한 마리도 못 산 사람이 절반을 넘었다 */
  horses: boolean;
  /** 참여한 사람 중 한 개도 못 판 사람이 절반을 넘은 큰 주문 수 (참여한 사람이 있는 주문 중) */
  bigOrders: number;
  bigOrdersJoined: number;
}

export function marketProblems(run: MarketRun): MarketProblems {
  const s = run.stats;
  const joined = s.bigOrders.filter((b) => b.joined > 0);
  return {
    monopoly: s.monopolyDays > run.daily.length / 2,
    horses: s.horseWanted > 0 && s.horseNever > s.horseWanted / 2,
    bigOrders: joined.filter((b) => b.soldNone > b.joined / 2).length,
    bigOrdersJoined: joined.length,
  };
}
