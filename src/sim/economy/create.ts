// 경제 시작 상태. 맵의 마을과 자원지로 일꾼을 나누고, 같은 시드면 같은 시작이 된다.
import { createCart } from '../cart';
import { CART, ECONOMY } from '../constants';
import { createRng, mixSeed, type Rng } from '../rng';
import { seasonOfDay, WINTER, type Season } from '../season';
import type { WorldMap } from '../worldgen';
import { basePrice, emptyGoodMap, GOODS, type GoodId } from './goods';
import { addGoods } from './inventory';
import { CRAFT_JOBS, GATHER_JOBS, JOB_RESOURCE, type JobId } from './jobs';
import { townNodes } from './nodes';
import { LOCAL_PLAYER, playerList, playerSeed } from './players';
import type { EconomyState, MarketResult, PlayerId, PlayerState, TownEconomy, Worker } from './state';
import { TRADER_NAMES } from './traders';
import { advanceDay } from './day';
import { createSeason } from '../events/schedule';
import { emptyRumorMill } from '../rumors/night';
import { emptyHorseMarket } from '../horses/supply';
import { ALL_UNLOCKS, startApprentice } from '../apprentice/progress';
import { createCertificate } from '../ranking/certificate';
import { ensureRecord } from '../ranking/record';
import { emptyAccount } from '../bank/bank';
import { defaultNotifySettings } from '../notify/kinds';

/** 세계에 앉을 플레이어 */
export interface PlayerSpec {
  id: PlayerId;
  /** 견습으로 시작한다 (처음 하는 플레이어). 아니면 모든 것이 열린 채로 */
  apprentice?: boolean;
  /** 상단 이름 (상인 증서). 없으면 이름 없는 상단 */
  name?: string;
}

export interface CreateOptions {
  /** 플레이어가 오기 전에 세계를 미리 돌리는 날 (기본 0). 다 돌린 뒤 날짜는 1일로 다시 센다 */
  warmupDays?: number;
  /** 견습으로 시작한다 (처음 하는 플레이어). 아니면 모든 것이 열린 채로 시작한다 (봇, 시험, 두 번째 시즌부터). players가 없을 때만 */
  apprentice?: boolean;
  /** 세계의 플레이어 (들어온 차례대로). 없으면 로컬 플레이어(LOCAL_PLAYER) 한 사람 */
  players?: PlayerSpec[];
  /**
   * 플레이어가 오는 날(1일)의 계절을 정한다. 시험과 관찰 화면에서 시작 계절마다 재 볼 때만 쓴다 (0.0.8).
   * 없으면 시드로 랜덤 (실제 게임). 정해도 시드의 다른 난수는 그대로라, 계절 말고는 같은 세계다
   */
  startSeason?: Season;
}

export function createEconomy(map: WorldMap, seed: number, opt: CreateOptions = {}): EconomyState {
  const rng = createRng(seed ^ 0x5eed);
  const drawnSeason = rng.int(0, 3) as Season;
  const specs = opt.players ?? [{ id: LOCAL_PLAYER, apprentice: opt.apprentice }];
  if (new Set(specs.map((s) => s.id)).size !== specs.length) throw new Error('플레이어 id가 겹친다');
  // 시작 마을은 마을 4곳에 고르게 랜덤 (기획서 "시작 조건"). 첫 플레이어는 세계의 난수로, 나머지는 따로 둔 난수로
  const firstTown = rng.int(0, map.towns.length - 1);
  const startTown = (seq: number) => (seq === 0 ? firstTown : createRng(mixSeed(seed, 0x57a7, seq)).int(0, map.towns.length - 1));
  const state: EconomyState = {
    version: 1,
    seed,
    day: 1,
    startSeason: opt.startSeason === undefined ? drawnSeason : seasonBeforeWarmup(opt.startSeason, opt.warmupDays ?? 0),
    rng: 0,
    nextId: 1,
    towns: map.towns.map((t) => createTown(map, t.id)),
    workers: [],
    traders: [],
    players: Object.fromEntries(specs.map((sp, seq) => [sp.id, newPlayer(sp.id, seq, startTown(seq))])),
    orders: [],
    draws: [],
    news: [],
    winterStartWorkers: null,
    season: null,
    events: [],
    reactive: { low: {}, high: {}, cooldown: {} },
    rumorMill: emptyRumorMill(),
    horses: emptyHorseMarket(),
  };

  for (const town of state.towns) {
    for (const job of GATHER_JOBS) {
      const node = town.nodes.find((n) => n.kind === JOB_RESOURCE[job]);
      if (!node) continue;
      const share = node.kind === 'forest' ? 0.5 : 1;
      const n = Math.max(1, Math.round(node.tiles * ECONOMY.startWorkers.perResourceTile * share));
      for (let i = 0; i < n; i++) state.workers.push(newWorker(state, town.id, job, rng));
    }
    // 도시는 일꾼 대신 공방이 가공한다 (workshop.ts)
    if (town.tier === 'city') continue;
    for (const job of CRAFT_JOBS) {
      for (let i = 0; i < ECONOMY.startWorkers.crafter; i++) state.workers.push(newWorker(state, town.id, job, rng));
    }
  }

  // 겨울에 시작하면 지난가을에 쌓아 둔 겨울 양식을 갖고 시작한다 (아니면 첫겨울에 다 떠난다)
  if (state.startSeason === WINTER) {
    for (const w of state.workers) addGoods(w.inv, 'grain', ECONOMY.worker.winterReserveDays * ECONOMY.worker.foodPerDay);
  }

  for (let i = 0; i < ECONOMY.traders.count; i++) {
    state.traders.push({
      id: state.nextId++,
      name: TRADER_NAMES[i % TRADER_NAMES.length]!,
      town: (i + 1) % state.towns.length,
      gold: ECONOMY.traders.startGold,
      inv: [],
      travel: null,
      plan: null,
      stuckDays: 0,
      horses: [],
    });
  }

  state.rng = rng.state();
  if (opt.warmupDays) warmUp(state, map, opt.warmupDays);
  // 플레이어가 오는 날 첫 시즌이 시작된다 (사건 일정은 이때 짠다)
  state.season = createSeason(state, map, 1, state.day);
  for (const p of playerList(state)) {
    p.homeTown = p.town;
    p.visited = [p.town];
    if (specs[p.seq]!.name) p.certificate.name = specs[p.seq]!.name!;
    if (specs[p.seq]!.apprentice) startApprentice(state, p, map, createRng(playerSeed(seed ^ 0xa99e, p)));
    else for (const id of ALL_UNLOCKS) p.unlocks[id] = state.day;
  }
  // 이번 시즌 기록을 연다 (수완가 부문의 시작 자금)
  ensureRecord(state);
  return state;
}

/** 새 플레이어: 금화와 등짐 하나 (기획서 "시작 조건") */
function newPlayer(id: PlayerId, seq: number, town: number): PlayerState {
  return {
    id,
    seq,
    gold: ECONOMY.player.startGold,
    town,
    travel: null,
    // 시작은 등짐 하나 (기획서 "시작 조건")
    cart: createCart(CART.start),
    memory: {},
    ledger: [],
    fatigue: 0,
    expeditionChances: 0,
    mealsToday: 0,
    restedToday: false,
    expedition: null,
    lastExpedition: null,
    rumors: [],
    drankToday: false,
    pigeons: [],
    informants: [],
    horses: [],
    horsesRested: false,
    marks: [],
    gear: {},
    guide: false,
    toolUses: 0,
    apprentice: null,
    unlocks: {},
    homeTown: 0,
    newsReadDay: null,
    newspapers: [],
    record: null,
    certificate: createCertificate(),
    warehouses: [],
    hires: [],
    caravan: null,
    bank: emptyAccount(),
    workshops: [],
    notify: defaultNotifySettings(),
    visited: [],
    reservations: [],
  };
}

/** 미리 돌린 날이 지나 플레이어가 올 때 want 계절이 되도록, 미리 돌리기를 시작할 계절 */
function seasonBeforeWarmup(want: Season, warmupDays: number): Season {
  for (let s = 0; s < 4; s++) if (seasonOfDay(warmupDays + 1, s as Season) === want) return s as Season;
  return want;
}

/** 미리 돌린 뒤 1일째로 되돌린다. 계절은 이어지도록 시작 계절을 맞춘다 */
function warmUp(state: EconomyState, map: WorldMap, days: number): void {
  for (let i = 0; i < days; i++) advanceDay(state, map);
  state.startSeason = seasonOfDay(state.day, state.startSeason);
  // 시작 계절 안에서 며칠째인지도 맞추려면 날짜 오프셋이 필요하다. 지금은 계절 첫날부터 다시 센다
  state.day = 1;
  state.news = [];
  for (const p of playerList(state)) {
    p.ledger = [];
    p.memory = {};
    // 플레이어는 미리 돌린 날에 없었다: 기회와 피로도 처음부터
    p.expeditionChances = 0;
    p.fatigue = 0;
    p.mealsToday = 0;
    p.restedToday = false;
  }
}

function createTown(map: WorldMap, id: number): TownEconomy {
  const refPrice = {} as Record<GoodId, number>;
  for (const g of GOODS) refPrice[g] = basePrice(g);
  const tier = map.towns[id]!.tier;
  return {
    id,
    tier,
    nodes: townNodes(map, id),
    refPrice,
    lastMarket: emptyGoodMap<MarketResult>({ price: null, volume: 0, demand: 0, supply: 0, bestBid: null, bestAsk: null, imbalance: 0 }),
    treasury: ECONOMY.citizens.startTreasury * (tier === 'city' ? ECONOMY.city.treasuryFactor : 1),
    workshop: tier === 'city' ? [] : null,
    recentEvents: [],
    stableGrain: 0,
  };
}

/** 새 일꾼. 처음엔 이틀 치 먹을 것(상하지 않는 염장 식품)과 쓸 만한 도구를 갖고 있다 */
export function newWorker(state: EconomyState, town: number, job: JobId, rng: Rng): Worker {
  const [lo, hi] = ECONOMY.worker.startGold;
  const w: Worker = {
    id: state.nextId++,
    town,
    job,
    gold: rng.int(lo, hi),
    inv: [],
    tool: rng.int(5, ECONOMY.worker.toolLife),
    hunger: 0,
    // 처음엔 그 일로 벌 만하다고 보고 온다
    income: ECONOMY.worker.arriveMinIncome,
    jobDays: 0,
    homeJob: null,
  };
  addGoods(w.inv, 'salted', ECONOMY.worker.foodReserveDays * ECONOMY.worker.foodPerDay);
  return w;
}
