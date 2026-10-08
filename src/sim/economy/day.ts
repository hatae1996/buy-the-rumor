// 하루 진행: 사건 시작 → 신청 받기 → 장날 정산 → 일꾼 생산과 소비 → 반응 사건과 소식.
// 앱을 다시 열면 지나간 날만큼 이 함수를 빠르게 돌린다.
import { ECONOMY } from '../constants';
import { eulReul } from '../josa';
import { createRng, shuffle } from '../rng';
import { seasonOfDay, WINTER, type Season } from '../season';
import type { WorldMap } from '../worldgen';
import {
  bannedGoods,
  bulkTradesToday,
  reactiveEvents,
  salesTax,
  startDay,
  travelDaysToday,
} from '../events';
import { Accounts } from './accounts';
import { citizenOrders, stipendOf, treasuryDay } from './citizens';
import { newWorker } from './create';
import { GOOD_NAME, GOODS, type GoodId } from './goods';
import { ageCart } from '../cart';
import { ageAndSpoil } from './inventory';
import { JOB_NAME } from './jobs';
import { limitPrice, runMarket } from './market';
import { regrow } from './nodes';
import { playerNight } from './player';
import { rumorNight, type HeardRumor } from '../rumors';
import type { EconomyState, MarketResult, Order } from './state';
import { traderDay, traderOrders } from './traders';
import { arrivals, workerDay, workerOrders, type WorkerEvent } from './workers';
import { workshopDay, workshopOrders } from './workshop';

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
  /** 오늘 밤 수첩에 새로 적힌 줄 */
  heard: HeardRumor[];
  /** 오늘 밤 새로 찍힌 도장 수 */
  stamped: number;
}

export function advanceDay(state: EconomyState, map: WorldMap): DayReport {
  const rng = createRng(state.rng);
  const season = seasonOfDay(state.day, state.startSeason);
  const news: string[] = [];
  const name = (town: number) => map.towns[town]!.name;

  // 0. 시즌과 사건: 시즌이 끝났으면 새로 짜고, 오늘 일정의 사건을 시작한다 (신문은 사실만)
  news.push(...startDay(state, map));
  // 막힌 길은 돌아간다
  const days = travelDaysToday(state, map, season);
  const accounts = new Accounts(state);

  // 1. 신청: 플레이어가 낮 동안 낸 신청 + NPC 신청
  const byTown: Order[][] = state.towns.map(() => []);
  for (const o of state.orders) byTown[o.town]!.push(o);
  // 일꾼 신청은 다른 마을 장에 낼 수도 있다 (가공 재료를 사 온다)
  for (const w of state.workers) for (const o of workerOrders(w, state, season, accounts)) byTown[o.town]!.push(o);
  for (const t of state.traders) if (!t.travel) byTown[t.town]!.push(...traderOrders(t, state, days, accounts));
  for (const town of state.towns) byTown[town.id]!.push(...citizenOrders(state, town, season, accounts, rng));
  for (const town of state.towns) byTown[town.id]!.push(...workshopOrders(town, accounts));
  // 대상단: 그날 장에서 한 물품을 한꺼번에 사거나 판다 (마을 금고를 거쳐 돈이 새지 않는다)
  for (const b of bulkTradesToday(state)) {
    const o = bulkOrder(state, accounts, b);
    if (o) byTown[b.town]!.push(o);
  }

  // 2. 장날 정산
  const playerBuys: Partial<Record<GoodId, number>>[] = state.towns.map(() => ({}));
  const markets = state.towns.map((town) => {
    const { results, fills } = runMarket(town, byTown[town.id]!, accounts, rng, {
      banned: bannedGoods(state, town.id),
      tax: salesTax(state, town.id),
    });
    town.lastMarket = results;
    for (const f of fills) {
      if (f.owner.kind !== 'player') continue;
      if (f.side === 'buy') playerBuys[town.id]![f.good] = (playerBuys[town.id]![f.good] ?? 0) + f.qty;
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
  // 겨울엔 일꾼이 겨울 첫날보다 정해진 비율 넘게 줄지 않는다 (handoff 0.0.4)
  if (season === WINTER) state.winterStartWorkers ??= state.workers.length;
  else state.winterStartWorkers = null;
  let leaveBudget =
    state.winterStartWorkers === null
      ? Infinity
      : state.workers.length - Math.ceil(state.winterStartWorkers * (1 - ECONOMY.winterWork.maxDecline));
  const mayLeave = () => leaveBudget-- > 0;
  const ctx = { state, season, rng, mayLeave, log: (e: WorkerEvent) => workerEvents.push(e) };
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
    workshopDay(town);
    tribute += treasuryDay(town);
    town.nodes.forEach(regrow);
  }
  for (const t of state.traders) traderDay(t, state, days, rng);
  if (p.travel && --p.travel.daysLeft <= 0) {
    p.town = p.travel.to;
    p.travel = null;
  }
  playerNight(state);

  // 하루가 지나 음식이 상한다
  let spoiled = 0;
  const rate = ECONOMY.spoilRate[season];
  for (const w of state.workers) spoiled += sum(ageAndSpoil(w.inv, rate));
  for (const t of state.traders) spoiled += sum(ageAndSpoil(t.inv, rate));
  for (const t of state.towns) if (t.workshop) spoiled += sum(ageAndSpoil(t.workshop, rate));
  for (const [good, qty] of Object.entries(ageCart(p.cart, rate)) as [GoodId, number][]) {
    spoiled += qty;
    p.ledger.push({ day: state.day, kind: 'spoil', good, qty });
  }

  // 4. 소식
  news.push(...reactiveEvents(state, map, playerBuys));
  // 소문: 새로 생기고 길을 따라 퍼진다. 마을에 있으면 소문꾼에게 듣고, 수첩에 도장이 찍힌다
  const rumors = rumorNight(state, map);
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
    heard: rumors.heard,
    stamped: rumors.stamped,
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


/** 대상단 신청: 살 때는 마을 금고로 비싸게, 팔 때는 바깥에서 들여온 물건을 싸게 내놓는다 */
function bulkOrder(
  state: EconomyState,
  accounts: Accounts,
  b: { town: number; good: GoodId; side: 'buy' | 'sell'; qty: number },
): Order | null {
  const town = state.towns[b.town]!;
  const owner = { kind: 'citizens', town: b.town } as const;
  if (b.side === 'buy') return accounts.place(owner, b.town, b.good, 'buy', b.qty, limitPrice(town, b.good, ECONOMY.events.bulkBuyMarkup));
  const limit = limitPrice(town, b.good, ECONOMY.events.bulkSellMarkdown);
  return { id: state.nextId++, town: b.town, good: b.good, side: 'sell', qty: b.qty, limit, owner, reserved: 0, lots: [{ good: b.good, qty: b.qty, age: 0 }] };
}
