// 일꾼: 장날에 팔고 사고, 일하고, 먹고, 도구를 쓰고, 세금을 내고, 형편이 나쁘면 일을 바꾸거나 떠난다.
import { ECONOMY } from '../constants';
import { stochasticRound, type Rng } from '../rng';
import { AUTUMN, WINTER, type Season } from '../season';
import type { Accounts } from './accounts';
import { basePrice, FOODS, GOODS, RAW_FOODS, shelfLife, type GoodId } from './goods';
import { addGoods, capStorage, count, sellableCount, spoilingSoon, takeOldest } from './inventory';
import { isGatherJob, JOB_RESOURCE, JOBS, type CraftJob, type GatherJob, type JobId } from './jobs';
import { limitPrice } from './market';
import { findNode, nodeYield } from './nodes';
import { jobIncomeFactor, produceFactor } from '../events/active';
import type { EconomyState, Order, TownEconomy, Worker } from './state';

const W = ECONOMY.worker;

// ───────── 장날 신청 ─────────

/** 갖고 있으려는 음식 양. 가을엔 겨울을 날 만큼 */
function foodReserve(season: Season): number {
  return (season === AUTUMN ? W.winterReserveDays : W.foodReserveDays) * W.foodPerDay;
}

export function workerOrders(w: Worker, state: EconomyState, season: Season, accounts: Accounts): Order[] {
  const owner = { kind: 'worker', id: w.id } as const;
  const town = state.towns[w.town]!;
  const out: Order[] = [];
  const place = (good: GoodId, side: 'buy' | 'sell', qty: number, limit: number, at = w.town) => {
    const o = accounts.place(owner, at, good, side, qty, limit);
    if (o) out.push(o);
  };

  // 팔기: 먹을 것, 가공 재료, 여분 도구 하나를 빼고 다 판다. 곧 상하는 건 싸게
  const keep = keepAmounts(w, season);
  const rate = ECONOMY.spoilRate[season];
  for (const good of GOODS) {
    // 내일이면 상할 것은 장에 못 낸다 (먼저 먹는다)
    const surplus = Math.min(count(w.inv, good) - (keep[good] ?? 0), sellableCount(w.inv, good, rate));
    if (surplus <= 0) continue;
    // 많이 쌓였을수록 싸게 내놓는다
    const glut = Math.min(1, (surplus * basePrice(good)) / W.glutValue);
    place(good, 'sell', surplus, limitPrice(town, good, W.askMarkdown * (1 - W.glutMaxDiscount * glut)));
  }

  // 사기: 도구 → 음식 → 가공 재료 순서로 돈이 되는 만큼. 굶고 있으면 음식이 먼저
  const buyTool = () => {
    if (w.tool > W.toolReplaceAt || count(w.inv, 'tools') > 0) return;
    // 우리 장에 도구가 없으면 도구가 팔리는 다른 마을 장에서 사 온다
    // 어디서도 안 팔렸으면 우리 장에 신청을 내 둔다 (사려는 사람이 있어야 값이 오르고 만드는 사람이 생긴다)
    const market = sourceMarket(state, w.town, 'tools') ?? town;
    const limit = limitPrice(market, 'tools', W.bidMarkup);
    if (w.gold >= limit) place('tools', 'buy', 1, limit, market.id);
  };
  if (w.hunger === 0) buyTool();
  const foodNeed = foodReserve(season) - foodCount(w);
  if (foodNeed > 0) {
    // 어제 파는 사람이 있었던 음식 중 싼 것부터. 어제 굶었으면 다른 음식도 찾아본다.
    // 넉넉히 쌓을 때(가을)는 겨울을 나는 오래가는 음식만 본다
    const stocking = foodNeed > W.foodReserveDays * W.foodPerDay;
    const lasting = (g: GoodId) => (shelfLife(g) ?? Infinity) >= 30;
    const sold = (g: GoodId) => (town.lastMarket[g].supply > 0 ? 0 : 1);
    const foods = FOODS.filter((g) => !stocking || lasting(g)).sort(
      (a, b) => sold(a) - sold(b) || town.refPrice[a] - town.refPrice[b],
    );
    let good = foods[w.hunger % foods.length]!;
    let market = town;
    // 우리 장에 음식이 하나도 없으면 음식이 팔리는 다른 마을 장에서 사 온다 (가공 일꾼은 먹을 걸 만들지 않는다)
    if (foods.every((g) => town.lastMarket[g].supply === 0)) {
      const remote = cheapestSource(state, w.town, foods);
      if (remote) ({ good, market } = remote);
    }
    const limit = limitPrice(market, good, w.hunger > 0 ? W.hungryBidMarkup : W.bidMarkup);
    // 도구가 곧 닳으면 쌓아 두는 음식보다 도구 값을 먼저 남겨 둔다
    const saving =
      stocking && w.hunger === 0 && w.tool > W.toolReplaceAt && w.tool <= W.toolSaveAt && count(w.inv, 'tools') === 0
        ? limitPrice(sourceMarket(state, w.town, 'tools') ?? town, 'tools', W.bidMarkup)
        : 0;
    const budget = Math.max(0, w.gold - saving);
    place(good, 'buy', Math.min(foodNeed, Math.floor(budget / limit)), limit, market.id);
  }
  if (w.hunger > 0) buyTool();
  if (!isGatherJob(w.job) && craftMargin(w.job, state, w.town) > 0) {
    // 우리 마을 장에 없는 재료는 그 재료가 팔리는 다른 마을 장에서 사 온다
    for (const [good, need, market] of craftNeeds(w, state)) {
      const limit = limitPrice(market, good, W.bidMarkup);
      place(good, 'buy', Math.min(need, Math.floor(w.gold / limit)), limit, market.id);
    }
  }
  return out;
}

/** 팔지 않고 남겨 둘 양 */
function keepAmounts(w: Worker, season: Season): Partial<Record<GoodId, number>> {
  const keep: Partial<Record<GoodId, number>> = { tools: 1 };
  // 음식은 상하는 날이 가까운 것부터 먹으니, 오래가는 음식을 남긴다
  let food = foodReserve(season);
  for (const g of [...FOODS].sort((a, b) => (shelfLife(b) ?? 1e9) - (shelfLife(a) ?? 1e9))) {
    const n = Math.min(food, count(w.inv, g));
    keep[g] = n;
    food -= n;
  }
  if (!isGatherJob(w.job)) {
    const recipe = ECONOMY.craft[w.job];
    for (const [g, n] of Object.entries(recipe.inputs) as [GoodId, number][]) keep[g] = (keep[g] ?? 0) + n * recipe.batches;
    if (recipe.rawFood > 0) for (const g of RAW_FOODS) keep[g] = Math.max(keep[g] ?? 0, recipe.rawFood * recipe.batches);
  }
  return keep;
}

/** 하루치 가공에 모자란 재료와 살 장. 날음식은 더 싸게 살 수 있는 쪽을 산다 */
function craftNeeds(w: Worker, state: EconomyState): [GoodId, number, TownEconomy][] {
  const recipe = ECONOMY.craft[w.job as CraftJob];
  const needs: [GoodId, number, TownEconomy][] = [];
  for (const [g, n] of Object.entries(recipe.inputs) as [GoodId, number][]) {
    const need = n * recipe.batches - count(w.inv, g);
    // 어디서도 안 팔렸으면 우리 장에 신청을 내 둔다 (사려는 사람이 있어야 값이 오르고 만드는 사람이 생긴다)
    if (need > 0) needs.push([g, need, sourceMarket(state, w.town, g) ?? state.towns[w.town]!]);
  }
  if (recipe.rawFood > 0) {
    const have = RAW_FOODS.reduce((s, g) => s + count(w.inv, g), 0);
    const need = recipe.rawFood * recipe.batches - have;
    const raw = cheapestRawFood(state, w.town);
    if (need > 0 && raw) needs.push([raw.good, need, raw.market]);
  }
  return needs;
}

/**
 * 일꾼이 물건을 살 장: 우리 마을에서 어제 팔렸으면 우리 마을, 아니면 어제 팔린 다른 마을 중 가장 싼 곳(사 온다).
 * 어디서도 안 팔렸으면 null. 가공 재료, 음식, 도구에 쓴다 (handoff 0.0.4: 대장장이가 없는 재료를 시장에서 사 온다)
 */
export function sourceMarket(state: EconomyState, townId: number, good: GoodId): TownEconomy | null {
  const home = state.towns[townId]!;
  if (home.lastMarket[good].supply > 0) return home;
  let best: TownEconomy | null = null;
  for (const t of state.towns) {
    if (t.id === townId || t.lastMarket[good].supply === 0) continue;
    if (!best || t.refPrice[good] < best.refPrice[good]) best = t;
  }
  return best;
}

function cheapestRawFood(state: EconomyState, townId: number): { good: GoodId; market: TownEconomy } | null {
  return cheapestSource(state, townId, RAW_FOODS);
}

/** 물품들 중 살 수 있는 장에서 가장 싼 것 */
function cheapestSource(
  state: EconomyState,
  townId: number,
  goods: readonly GoodId[],
): { good: GoodId; market: TownEconomy } | null {
  let best: { good: GoodId; market: TownEconomy } | null = null;
  for (const good of goods) {
    const market = sourceMarket(state, townId, good);
    if (market && (!best || market.refPrice[good] < best.market.refPrice[good])) best = { good, market };
  }
  return best;
}

// ───────── 하루 생활 ─────────

export interface WorkerDayContext {
  state: EconomyState;
  season: Season;
  rng: Rng;
  /** 굶은 일꾼이 세상을 떠나도 되는지 (겨울엔 줄어드는 한도가 있다). 떠나면 한도를 하나 쓴다 */
  mayLeave: () => boolean;
  /** 일꾼이 마을을 떠나거나 직업을 바꿀 때 알린다 */
  log: (text: WorkerEvent) => void;
}

export type WorkerEvent =
  | { kind: 'switch'; town: number; from: JobId; to: JobId }
  | { kind: 'migrate'; from: number; to: number; job: JobId }
  | { kind: 'leave'; town: number; job: JobId }
  | { kind: 'arrive'; town: number; job: JobId };

export function workerDay(w: Worker, ctx: WorkerDayContext): 'stay' | 'gone' {
  const { state, season, rng } = ctx;
  const town = state.towns[w.town]!;
  const eff = (w.tool > 0 ? 1 : W.noToolEfficiency) * (w.hunger > 0 ? W.hungryEfficiency : 1);

  const earned = isGatherJob(w.job) ? gather(w, state, town, w.job, eff, season, rng) : craft(w, w.job, eff, rng, state);
  w.income += (earned - w.income) * W.incomeMemory;
  w.jobDays++;

  eat(w);

  if (w.tool > 0) w.tool--;
  if (w.tool === 0 && takeOldest(w.inv, 'tools', 1).length > 0) w.tool = W.toolLife;

  if (w.gold > W.taxThreshold) {
    const tax = Math.floor(w.gold * W.taxRate);
    w.gold -= tax;
    town.treasury += tax;
  }
  capStorage(w.inv, W.storagePerGood);

  return reconsider(w, ctx);
}

/** 채집하고, 거둔 것을 기준 시세로 친 값을 돌려준다 */
function gather(w: Worker, state: EconomyState, town: TownEconomy, job: GatherJob, eff: number, season: Season, rng: Rng): number {
  const node = findNode(town, JOB_RESOURCE[job]);
  if (!node) return 0;
  let value = 0;
  const factor = eff * nodeYield(node) * ECONOMY.seasonYield[job][season];
  let used = 0;
  for (const [good, base] of Object.entries(ECONOMY.gather[job]) as [GoodId, number][]) {
    // 사건(폭풍, 늑대, 풍어 등)이 생산 배율을 바꾼다
    let qty = stochasticRound(base * factor * produceFactor(state, town.id, good), rng);
    // 줄어드는 자원지는 첫 번째 결과물만큼 쓴다 (고기 한 덩이 = 사슴 한 마리 몫)
    if (used === 0 && node.amount < qty) qty = Math.floor(node.amount);
    if (used === 0) used = qty;
    addGoods(w.inv, good, qty);
    value += qty * town.refPrice[good] * W.askMarkdown;
  }
  if (ECONOMY.node.regrowth[node.kind] !== null) node.amount = Math.max(0, node.amount - used);
  return value;
}

/** 가공하고, 한 만큼의 이익(결과물 값 − 재료 값)을 돌려준다 */
function craft(w: Worker, job: CraftJob, eff: number, rng: Rng, state: EconomyState): number {
  const recipe = ECONOMY.craft[job];
  const batches = stochasticRound(recipe.batches * eff, rng);
  const margin = Math.max(0, craftMargin(job, state, w.town));
  let done = 0;
  for (let b = 0; b < batches; b++) {
    const inputs = Object.entries(recipe.inputs) as [GoodId, number][];
    if (inputs.some(([g, n]) => count(w.inv, g) < n)) break;
    const raw = RAW_FOODS.reduce((s, g) => s + count(w.inv, g), 0);
    if (raw < recipe.rawFood) break;
    for (const [g, n] of inputs) takeOldest(w.inv, g, n);
    let rawLeft = recipe.rawFood;
    // 곧 상하는 날것부터 쓴다
    for (const g of [...RAW_FOODS].sort((a, b) => spoilingSoon(w.inv, b) - spoilingSoon(w.inv, a))) {
      rawLeft -= takeOldest(w.inv, g, rawLeft).reduce((s, l) => s + l.qty, 0);
    }
    for (const [g, n] of Object.entries(recipe.output) as [GoodId, number][]) addGoods(w.inv, g, n);
    done++;
  }
  return done * margin;
}

/** 상하는 날이 가장 가까운 음식부터 먹는다 */
function eat(w: Worker): void {
  for (let i = 0; i < W.foodPerDay; i++) {
    let pick: GoodId | null = null;
    let soonest = Infinity;
    for (const l of w.inv) {
      if (!FOODS.includes(l.good)) continue;
      const left = (shelfLife(l.good) ?? 1e6) - l.age;
      if (left < soonest) {
        soonest = left;
        pick = l.good;
      }
    }
    if (pick === null) {
      w.hunger++;
      return;
    }
    takeOldest(w.inv, pick, 1);
  }
  w.hunger = 0;
}

function foodCount(w: Worker): number {
  return FOODS.reduce((s, g) => s + count(w.inv, g), 0);
}

// ───────── 일 바꾸기와 이주 ─────────

/**
 * 직업별 예상 하루 수입 (기준 시세로). 그 마을에서 할 수 없으면 null.
 * 사건이 그 일의 벌이를 다르게 보이게 한다 (일을 줄임, 일꾼이 몰림)
 */
export function expectedIncome(job: JobId, state: EconomyState, townId: number, season: Season): number | null {
  const income = baseIncome(job, state, townId, season);
  return income === null ? null : income * jobIncomeFactor(state, townId, job);
}

function baseIncome(job: JobId, state: EconomyState, townId: number, season: Season): number | null {
  const town = state.towns[townId]!;
  if (isGatherJob(job)) {
    const node = findNode(town, JOB_RESOURCE[job]);
    if (!node) return null;
    const factor = nodeYield(node) * ECONOMY.seasonYield[job][season];
    return (Object.entries(ECONOMY.gather[job]) as [GoodId, number][]).reduce(
      (s, [g, n]) => s + n * factor * produceFactor(state, townId, g) * town.refPrice[g] * W.askMarkdown,
      0,
    );
  }
  // 재료를 어디서도 구할 수 없으면 가공으로 벌 수 없다 (어제 어느 장에도 파는 사람이 없었음).
  // 재료가 조금만 나왔으면 같은 일을 하는 사람들과 나눠야 하니 그만큼 덜 번다
  const r = ECONOMY.craft[job];
  const sharers = state.workers.filter((w) => w.town === townId && w.job === job).length + 1;
  let share = 1;
  for (const [g, n] of Object.entries(r.inputs) as [GoodId, number][]) {
    const market = sourceMarket(state, townId, g);
    if (!market) return 0;
    share = Math.min(share, market.lastMarket[g].supply / (n * r.batches * sharers));
  }
  if (r.rawFood > 0) {
    const raw = cheapestRawFood(state, townId);
    if (!raw) return 0;
    share = Math.min(share, raw.market.lastMarket[raw.good].supply / (r.rawFood * r.batches * sharers));
  }
  return Math.max(0, craftMargin(job, state, townId) * r.batches * share);
}

/** 가공 한 번의 이익 (결과물 판 값 − 재료 값). 재료는 살 수 있는 장의 시세 그대로 (채집 일꾼의 예상 벌이와 같은 기준) */
function craftMargin(job: CraftJob, state: EconomyState, townId: number): number {
  const town = state.towns[townId]!;
  const r = ECONOMY.craft[job];
  const priceOf = (g: GoodId) => (sourceMarket(state, townId, g) ?? town).refPrice[g];
  const value = (g: GoodId) => Math.max(town.refPrice[g], basePrice(g) * W.crafterValueFloor);
  const out = (Object.entries(r.output) as [GoodId, number][]).reduce((s, [g, n]) => s + n * value(g) * W.askMarkdown, 0);
  let cost = (Object.entries(r.inputs) as [GoodId, number][]).reduce((s, [g, n]) => s + n * priceOf(g), 0);
  if (r.rawFood > 0) cost += r.rawFood * Math.min(...RAW_FOODS.map(priceOf));
  return out - cost;
}

const WINTER_JOBS: readonly JobId[] = ECONOMY.winterWork.jobs;

/** 이 계절에 일이 거의 멈추는 채집 직업인가 (어부, 농부, 염전 일꾼의 겨울) */
function idleInSeason(job: JobId, season: Season): boolean {
  return isGatherJob(job) && ECONOMY.seasonYield[job][season] < ECONOMY.winterWork.idleBelow;
}

export function jobCap(job: JobId, town: TownEconomy, season: Season): number {
  // 도시는 일꾼 대신 공방이 가공한다 (workshop.ts)
  if (town.tier === 'city') return 0;
  let cap: number;
  if (!isGatherJob(job)) {
    cap = ECONOMY.jobCap.crafter;
  } else {
    const node = findNode(town, JOB_RESOURCE[job]);
    if (!node) return 0;
    // 숲은 사냥꾼과 나무꾼이 나눠 쓴다
    const share = JOB_RESOURCE[job] === 'forest' ? 0.5 : 1;
    cap = Math.max(1, Math.round(node.tiles * ECONOMY.jobCap.perResourceTile * share));
  }
  // 겨울엔 겨울 일에 사람이 더 몰린다
  if (season === WINTER && WINTER_JOBS.includes(job)) cap = Math.ceil(cap * ECONOMY.winterWork.capFactor);
  return cap;
}

/** 자리가 남은 직업 중 가장 잘 버는 것. jobs로 고를 직업을 좁힐 수 있다 */
export function bestJob(
  state: EconomyState,
  townId: number,
  season: Season,
  except?: Worker,
  jobs: readonly JobId[] = JOBS,
): { job: JobId; income: number } | null {
  const town = state.towns[townId]!;
  let best: { job: JobId; income: number } | null = null;
  for (const job of jobs) {
    if (idleInSeason(job, season)) continue;
    const income = expectedIncome(job, state, townId, season);
    if (income === null) continue;
    const taken = state.workers.filter((w) => w !== except && w.town === townId && w.job === job).length;
    if (taken >= jobCap(job, town, season)) continue;
    if (!best || income > best.income) best = { job, income };
  }
  return best;
}

function reconsider(w: Worker, ctx: WorkerDayContext): 'stay' | 'gone' {
  const { state, season, rng, log } = ctx;
  if (w.hunger >= W.leaveHunger && ctx.mayLeave()) {
    log({ kind: 'leave', town: w.town, job: w.job });
    return 'gone';
  }
  const cheapestFood = Math.min(...FOODS.map((g) => state.towns[w.town]!.refPrice[g]));
  const poor = w.hunger >= 2 && w.gold < cheapestFood;

  // 며칠 굶으면 (돈이 있어도 먹을 게 없으면) 다른 마을로 간다 (가는 길은 생략)
  if (w.hunger >= W.migrateHunger && rng.next() < W.switchWhenPoorChance) {
    // 먹을 것이 팔리는 마을을 먼저, 그다음 벌이가 좋은 마을
    const foodSold = (t: TownEconomy) => FOODS.reduce((s, g) => s + t.lastMarket[g].supply, 0);
    const options = state.towns
      .filter((t) => t.id !== w.town)
      .map((t) => ({ town: t.id, food: foodSold(t), best: bestJob(state, t.id, season) }))
      .filter((o) => o.best !== null)
      .sort((a, b) => Number(b.food > 0) - Number(a.food > 0) || b.best!.income - a.best!.income);
    const dest = options[0];
    if (dest) {
      log({ kind: 'migrate', from: w.town, to: dest.town, job: dest.best!.job });
      w.town = dest.town;
      w.job = dest.best!.job;
      w.income = dest.best!.income;
      w.jobDays = 0;
      w.homeJob = null;
      w.hunger = Math.max(0, w.hunger - 1);
      return 'stay';
    }
  }

  // 겨울 일: 일이 멈추는 직업은 겨울 동안 겨울 일로 옮겼다가 봄에 돌아온다 (떠나지 않는다)
  if (w.homeJob !== null) {
    if (season !== WINTER) {
      log({ kind: 'switch', town: w.town, from: w.job, to: w.homeJob });
      w.job = w.homeJob;
      w.homeJob = null;
      w.income = expectedIncome(w.job, state, w.town, season) ?? 0;
      w.jobDays = 0;
    }
    return 'stay';
  }
  if (season === WINTER && idleInSeason(w.job, season)) {
    const winter = bestJob(state, w.town, season, w, WINTER_JOBS);
    if (winter && winter.income > 0) {
      log({ kind: 'switch', town: w.town, from: w.job, to: winter.job });
      w.homeJob = w.job;
      w.job = winter.job;
      w.income = winter.income;
      w.jobDays = 0;
    }
    return 'stay';
  }

  const best = bestJob(state, w.town, season, w);
  if (!best || best.job === w.job) return 'stay';
  // 지금 일은 실제로 번 값으로 본다 (재료를 못 구하는 가공 일꾼은 장부상 이익이 커도 버는 게 없다)
  const current = w.income * jobIncomeFactor(state, w.town, w.job);
  const envy =
    w.jobDays >= W.switchCooldownDays &&
    best.income > current * W.switchEnvyFactor + 2 &&
    rng.next() < W.switchEnvyChance;
  const desperate = poor && rng.next() < W.switchWhenPoorChance;
  // 지금 일을 이 마을에서 못 하게 되었으면(자원지가 없음) 바로 바꾼다
  const impossible = expectedIncome(w.job, state, w.town, season) === null;
  if (envy || desperate || impossible) {
    log({ kind: 'switch', town: w.town, from: w.job, to: best.job });
    w.job = best.job;
    w.income = best.income;
    w.jobDays = 0;
  }
  return 'stay';
}

/** 형편이 좋은 마을에는 일꾼이 새로 찾아온다 */
export function arrivals(ctx: WorkerDayContext, newWorker: (town: number, job: JobId) => void): void {
  const { state, season, rng, log } = ctx;
  for (const town of state.towns) {
    const best = bestJob(state, town.id, season);
    if (!best) continue;
    const few = state.workers.filter((w) => w.town === town.id).length < W.refillBelow;
    const chance = few ? W.refillChance : best.income > W.arriveMinIncome ? W.arriveChance : 0;
    if (rng.next() < chance) {
      newWorker(town.id, best.job);
      log({ kind: 'arrive', town: town.id, job: best.job });
    }
  }
}
