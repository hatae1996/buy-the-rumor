// 하루 진행: 신청 받기 → 장날 정산 → 일꾼 생산과 소비 → 소식.
// 앱을 다시 열면 지나간 날만큼 이 함수를 빠르게 돌린다.
import { ECONOMY } from '../constants';
import { eulReul } from '../josa';
import { createRng, shuffle } from '../rng';
import { seasonOfDay, type Season } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';
import { Accounts } from './accounts';
import { citizenOrders, stipendOf, treasuryDay } from './citizens';
import { newWorker } from './create';
import { rollEvents } from './events';
import { GOOD_NAME, GOODS, type GoodId } from './goods';
import { ageAndSpoil } from './inventory';
import { JOB_NAME } from './jobs';
import { runMarket } from './market';
import { regrow } from './nodes';
import type { EconomyState, MarketResult, Order } from './state';
import { traderDay, traderOrders } from './traders';
import { arrivals, workerDay, workerOrders, type WorkerEvent } from './workers';

export interface DayReport {
  day: number;
  season: Season;
  /** markets[마을][물품] */
  markets: Record<GoodId, MarketResult>[];
  /** 영주에게 바친 돈 (빠져나간 돈) */
  tribute: number;
  /** 바깥에서 들어온 돈 (주민 금고) */
  stipend: number;
  /** 새로 온 일꾼이 갖고 온 돈, 떠난 일꾼이 갖고 간 돈 */
  arrivedGold: number;
  leftGold: number;
  spoiled: number;
  workerEvents: WorkerEvent[];
  news: string[];
}

export function advanceDay(state: EconomyState, map: WorldMap): DayReport {
  const rng = createRng(state.rng);
  const season = seasonOfDay(state.day, state.startSeason);
  const days = townTravelDays(map, season);
  const accounts = new Accounts(state);
  const news: string[] = [];
  const name = (town: number) => map.towns[town]!.name;

  // 1. 신청: 플레이어가 낮 동안 낸 신청 + NPC 신청
  const byTown: Order[][] = state.towns.map(() => []);
  for (const o of state.orders) byTown[o.town]!.push(o);
  for (const w of state.workers) byTown[w.town]!.push(...workerOrders(w, state.towns[w.town]!, season, accounts));
  for (const t of state.traders) if (!t.travel) byTown[t.town]!.push(...traderOrders(t, state, days, accounts));
  for (const town of state.towns) byTown[town.id]!.push(...citizenOrders(town, season, accounts, rng));

  // 2. 장날 정산
  const markets = state.towns.map((town) => {
    const { results, fills } = runMarket(town, byTown[town.id]!, accounts, rng);
    town.lastMarket = results;
    for (const f of fills) {
      if (f.owner.kind !== 'player') continue;
      state.player.ledger.push({ day: state.day, kind: f.side, town: town.id, good: f.good, qty: f.qty, price: f.price });
      if (f.qty * f.price >= ECONOMY.player.bigTradeNews) {
        const verb = f.side === 'buy' ? '사들였습니다' : '팔았습니다';
        news.push(`어느 상단이 ${name(town.id)}에서 ${GOOD_NAME[f.good]} ${f.qty}개를 한꺼번에 ${verb}.`);
      }
    }
    return results;
  });
  state.orders = [];
  const p = state.player;
  if (!p.travel) {
    const t = state.towns[p.town]!;
    const prices = {} as Record<GoodId, number>;
    for (const g of GOODS) prices[g] = Math.round(t.refPrice[g]);
    p.memory[p.town] = { day: state.day, prices, previous: p.memory[p.town]?.prices ?? null };
  }

  // 3. 생산과 소비. 순서가 유리하지 않도록 매일 섞는다
  const workerEvents: WorkerEvent[] = [];
  const ctx = { state, season, rng, log: (e: WorkerEvent) => workerEvents.push(e) };
  const gone = new Set<number>();
  let leftGold = 0;
  for (const w of shuffle([...state.workers], rng)) {
    if (workerDay(w, ctx) === 'gone') {
      gone.add(w.id);
      leftGold += w.gold;
    }
  }
  state.workers = state.workers.filter((w) => !gone.has(w.id));
  let arrivedGold = 0;
  arrivals(ctx, (town, job) => {
    const w = newWorker(state, town, job, rng);
    arrivedGold += w.gold;
    state.workers.push(w);
  });

  let tribute = 0;
  for (const town of state.towns) {
    tribute += treasuryDay(town);
    town.nodes.forEach(regrow);
  }
  for (const t of state.traders) traderDay(t, state, days, rng);
  if (p.travel && --p.travel.daysLeft <= 0) {
    p.town = p.travel.to;
    p.travel = null;
  }

  // 하루가 지나 음식이 상한다
  let spoiled = 0;
  const rate = ECONOMY.spoilRate[season];
  for (const w of state.workers) spoiled += sum(ageAndSpoil(w.inv, rate));
  for (const t of state.traders) spoiled += sum(ageAndSpoil(t.inv, rate));
  for (const [good, qty] of Object.entries(ageAndSpoil(p.cargo, rate)) as [GoodId, number][]) {
    spoiled += qty;
    p.ledger.push({ day: state.day, kind: 'spoil', good, qty });
  }

  // 4. 소식
  news.push(...rollEvents(state, map, rng));
  for (const e of workerEvents) {
    if (e.kind === 'leave') news.push(`굶주린 ${JOB_NAME[e.job]} 한 명이 ${eulReul(name(e.town))} 떠났습니다.`);
  }
  for (const text of news) state.news.push({ day: state.day, text });

  const report: DayReport = {
    day: state.day,
    season,
    markets,
    tribute,
    stipend: state.towns.reduce((s, t) => s + stipendOf(t), 0),
    arrivedGold,
    leftGold,
    spoiled,
    workerEvents,
    news,
  };
  state.day++;
  state.rng = rng.state();
  return report;
}

/** 여러 날을 한꺼번에 (자리를 비운 사이) */
export function advanceDays(state: EconomyState, map: WorldMap, n: number): DayReport[] {
  return Array.from({ length: n }, () => advanceDay(state, map));
}

function sum(rec: Partial<Record<string, number>>): number {
  return Object.values(rec).reduce<number>((a, b) => a + (b ?? 0), 0);
}

