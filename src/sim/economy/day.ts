// 하루 진행: 사건 시작 → 신청 받기 → 장날 정산 → 일꾼 생산과 소비 → 반응 사건과 소식.
// 앱을 다시 열면 지나간 날만큼 이 함수를 빠르게 돌린다.
import { ECONOMY } from '../constants';
import { eulReul, iGa } from '../josa';
import { createRng, shuffle } from '../rng';
import { seasonOfDay, WINTER, type Season } from '../season';
import type { WorldMap } from '../worldgen';
import {
  bannedGoods,
  bigOrdersToday,
  bulkTradesToday,
  giveOutBigOrders,
  settleBigOrders,
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
import { horseMorning, playerHorsesNight, traderHorseDeal, traderHorsesNight } from '../horses';
import { apprenticeAfterDay, noteUnsold, settleApprenticeOrders, updateUnlocks } from '../apprentice';
import { checkBadges, ensureRecord, lastSeasonDay, newsName, noteTrade, settleSeason, trackWorth, tradeRecord, updateRankings } from '../ranking';
import { warehouseNight } from '../warehouse/warehouse';
import { resolveDraws } from '../draws';
import { noteReservationFill, placeReservations } from '../reservations';
import { hireNight, porterBoards } from '../hire';
import { caravanNight, caravanOrders } from '../caravan';
import { dayNotices, type NotifyEvent } from '../notify';
import { getPlayer, isPlayerOwner, playerOrder } from './players';
import type { EconomyState, MarketResult, Order, PlayerId } from './state';
import { traderDay, traderOrders } from './traders';
import { arrivals, workerDay, workerOrders, type WorkerEvent } from './workers';
import { workshopDay, workshopOrders } from './workshop';

/** 플레이어 한 사람의 하루 */
export interface PlayerDayReport {
  /** 오늘 밤 수첩에 새로 적힌 줄 */
  heard: HeardRumor[];
  /** 오늘 밤 새로 찍힌 도장 수 */
  stamped: number;
  /** 알림을 보낼 사건 (켜고 끄기, 묶기, 상한은 받는 쪽이 planDelivery로) */
  notices: NotifyEvent[];
}

export interface DayReport {
  day: number;
  season: Season;
  /** markets[마을][물품] */
  markets: Record<GoodId, MarketResult>[];
  /** 영주에게 바친 돈 (빠져나간 돈) */
  tribute: number;
  /** 바깥에서 들어온 돈 (주민 금고) */
  stipend: number;
  /** 큰 주문이 바깥 돈으로 산 값 (0.0.7) */
  outsideGold: number;
  /** 새로 온 일꾼이 갖고 온 돈, 떠난 일꾼이 갖고 간 돈 */
  arrivedGold: number;
  leftGold: number;
  spoiled: number;
  workerEvents: WorkerEvent[];
  news: string[];
  /** 플레이어마다 */
  players: Record<PlayerId, PlayerDayReport>;
}

export function advanceDay(state: EconomyState, map: WorldMap): DayReport {
  const rng = createRng(state.rng);
  const season = seasonOfDay(state.day, state.startSeason);
  const news: string[] = [];
  const name = (town: number) => map.towns[town]!.name;
  // 플레이어 차례가 결과를 바꾸는 곳(밤 처리)은 오늘 차례로. 세계의 난수는 쓰지 않는다
  const turn = playerOrder(state);

  // 0. 시즌과 사건: 시즌이 끝났으면 새로 짜고, 오늘 일정의 사건을 시작한다 (신문은 사실만)
  news.push(...startDay(state, map));
  // 시즌이 바뀌었으면 지난 시즌 기록을 마감하고 새로 연다
  ensureRecord(state);
  // 수가 정해진 것(말, 게시판 일꾼)은 어제 낮 동안 모인 신청 중에서 뽑는다 (오늘 입고 전 재고로)
  resolveDraws(state, map);
  // 말: 시즌 입고 일정대로 목장 마을 마구간에 풀린다 (신문에는 실리지 않는다)
  horseMorning(state, map);
  // 막힌 길은 돌아간다
  const days = travelDaysToday(state, map, season);
  const accounts = new Accounts(state);

  // 견습 마을 손님: 견습 동안 플레이어 신청은 장날에 따로, 반드시 다 맞춘다
  for (const p of turn) {
    for (const f of settleApprenticeOrders(state, p, accounts)) {
      p.ledger.push({ day: state.day, kind: f.side, town: p.town, good: f.good, qty: f.qty, price: f.price });
      noteTrade(p, tradeRecord(state.day, f.side, p.town, f.good, f.qty, f.price));
    }
  }

  // 예약 주문: 오늘 장날 신청으로 넣는다 (자리를 비운 사이에도)
  for (const p of turn) state.orders.push(...placeReservations(state, p, accounts));

  // 1. 신청: 플레이어가 낮 동안 낸 신청 + NPC 신청
  const byTown: Order[][] = state.towns.map(() => []);
  for (const o of state.orders) byTown[o.town]!.push(o);
  // 일꾼 신청은 다른 마을 장에 낼 수도 있다 (가공 재료를 사 온다)
  for (const w of state.workers) for (const o of workerOrders(w, state, season, accounts)) byTown[o.town]!.push(o);
  for (const t of state.traders) if (!t.travel) byTown[t.town]!.push(...traderOrders(t, state, days, accounts));
  for (const town of state.towns) byTown[town.id]!.push(...citizenOrders(state, town, season, accounts, rng));
  // 마구간이 먹인 곡물은 오늘 주민 신청에 들어갔다
  for (const town of state.towns) town.stableGrain = 0;
  for (const town of state.towns) byTown[town.id]!.push(...workshopOrders(town, accounts));
  // 두 번째 행렬: 지시서 마을에 와 있으면 지시대로 신청한다
  for (const p of turn) for (const o of caravanOrders(state, p, accounts)) byTown[o.town]!.push(o);
  // 대상단: 그날 장에서 한 물품을 한꺼번에 사거나 판다 (마을 금고를 거쳐 돈이 새지 않는다)
  for (const b of bulkTradesToday(state)) {
    const o = bulkOrder(state, accounts, b);
    if (o) byTown[b.town]!.push(o);
  }
  // 큰 주문 (0.0.7): 사건 기간 동안 남은 양을 높은 값에 사들인다 (바깥 돈)
  for (const { event, order } of bigOrdersToday(state)) {
    const o = accounts.place({ kind: 'buyer', event: event.id }, event.town, order.good, 'buy', order.left, order.price);
    if (o) byTown[event.town]!.push(o);
  }
  const buyerFills: { event: number; good: GoodId; qty: number; price: number }[] = [];

  // 2. 장날 정산
  // 플레이어마다 수레 짐으로 내놓은 양과 판 양 (첫 장날 실패를 본다)
  const offered = new Map<PlayerId, number>();
  const sold = new Map<PlayerId, number>();
  for (const o of state.orders) {
    if (o.side === 'sell' && o.owner.kind === 'player') offered.set(o.owner.pid, (offered.get(o.owner.pid) ?? 0) + o.qty);
  }
  const playerBuys: Partial<Record<GoodId, number>>[] = state.towns.map(() => ({}));
  const reservationOf = new Map(state.orders.filter((o) => o.reservation !== undefined).map((o) => [o.id, o.reservation!]));
  const markets = state.towns.map((town) => {
    const { results, fills } = runMarket(town, byTown[town.id]!, accounts, rng, {
      banned: bannedGoods(state, town.id),
      tax: salesTax(state, town.id),
    });
    town.lastMarket = results;
    for (const f of fills) if (f.owner.kind === 'buyer' && f.side === 'buy') buyerFills.push({ event: f.owner.event, good: f.good, qty: f.qty, price: f.price });
    for (const f of fills) {
      // 수레 짐, 창고 짐, 두 번째 행렬 모두 플레이어 거래다
      if (!isPlayerOwner(f.owner)) continue;
      const p = getPlayer(state, f.owner.pid);
      const by = f.owner.kind === 'player' ? undefined : f.owner.kind;
      if (f.side === 'sell' && f.owner.kind === 'player') sold.set(p.id, (sold.get(p.id) ?? 0) + f.qty);
      if (f.side === 'buy') playerBuys[town.id]![f.good] = (playerBuys[town.id]![f.good] ?? 0) + f.qty;
      const res = f.orderId === undefined ? undefined : reservationOf.get(f.orderId);
      if (res !== undefined) noteReservationFill(p, res, f.qty);
      p.ledger.push({ day: state.day, kind: f.side, town: town.id, good: f.good, qty: f.qty, price: f.price, ...(by ? { by } : {}), ...(res !== undefined ? { reserved: true as const } : {}) });
      noteTrade(p, tradeRecord(state.day, f.side, town.id, f.good, f.qty, f.price));
      if (f.qty * f.price >= ECONOMY.player.bigTradeNews) {
        const verb = f.side === 'buy' ? '사들였습니다' : '팔았습니다';
        news.push(`${iGa(newsName(state, p))} ${name(town.id)}에서 ${GOOD_NAME[f.good]} ${f.qty}개를 한꺼번에 ${verb}.`);
      }
    }
    return results;
  });
  state.orders = [];
  // 큰 주문이 산 만큼 남은 양을 줄인다. 큰 주문이 낸 돈은 바깥에서 들어온 돈이다
  const outsideGold = settleBigOrders(state, buyerFills);
  // 봄 구휼: 영주가 사들인 곡물은 그 마을 일꾼에게 나눠 준다
  giveOutBigOrders(state, buyerFills);
  for (const p of turn) {
    noteUnsold(state, p, offered.get(p.id) ?? 0, sold.get(p.id) ?? 0);
    if (p.travel) continue;
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
  for (const t of state.traders) {
    traderHorseDeal(state, t);
    traderDay(t, state, days, rng);
    traderHorsesNight(state, t);
  }
  // 플레이어 밤: 오늘 차례대로 (마구간 먹이, 채집꾼이 거두는 자원지처럼 나눠 쓰는 것이 있다)
  const arrived = new Map<PlayerId, number>();
  for (const p of turn) {
    if (p.travel && --p.travel.daysLeft <= 0) {
      p.town = p.travel.to;
      p.travel = null;
      arrived.set(p.id, p.town);
      if (!p.visited.includes(p.town)) p.visited.push(p.town);
    }
    playerNight(state, p);
    playerHorsesNight(state, p);
    hireNight(state, p);
    caravanNight(state, p, map);
    warehouseNight(state, p);
  }

  // 하루가 지나 음식이 상한다
  let spoiled = 0;
  const rate = ECONOMY.spoilRate[season];
  for (const w of state.workers) spoiled += sum(ageAndSpoil(w.inv, rate));
  for (const t of state.traders) spoiled += sum(ageAndSpoil(t.inv, rate));
  for (const t of state.towns) if (t.workshop) spoiled += sum(ageAndSpoil(t.workshop, rate));
  // 수레와 창고: 음식은 창고에서도 상한다
  for (const p of turn) {
    for (const board of [p.cart, ...porterBoards(p), ...(p.caravan ? [p.caravan.cart] : []), ...p.warehouses.map((w) => w.board)]) {
      for (const [good, qty] of Object.entries(ageCart(board, rate)) as [GoodId, number][]) {
        spoiled += qty;
        p.ledger.push({ day: state.day, kind: 'spoil', good, qty });
      }
    }
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
    outsideGold,
    arrivedGold,
    leftGold,
    spoiled,
    workerEvents,
    news,
    players: {},
  };
  for (const p of turn) {
    report.players[p.id] = {
      heard: rumors[p.id]?.heard ?? [],
      stamped: rumors[p.id]?.stamped ?? 0,
      notices: dayNotices(state, p, map, state.day, news, arrived.get(p.id) ?? null),
    };
  }
  for (const p of turn) {
    // 견습 장면과 하나씩 열리는 것
    apprenticeAfterDay(state, p, map, state.day);
    updateUnlocks(state, p);
    // 랭킹: 시즌 동안 가장 낮았던 순자산, 업적과 의뢰 인장
    trackWorth(state, p);
    checkBadges(state, p);
  }
  // 오늘 순위를 매기고, 시즌 마지막 장날이면 결산한다 (시즌 중이 아니면 하지 않는다)
  if (state.season) {
    updateRankings(state);
    if (lastSeasonDay(state)) settleSeason(state);
  }
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
