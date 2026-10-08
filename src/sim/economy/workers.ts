// 일꾼: 장날에 팔고 사고, 일하고, 먹고, 도구를 쓰고, 세금을 내고, 형편이 나쁘면 일을 바꾸거나 떠난다.
import { ECONOMY } from '../constants';
import { stochasticRound, type Rng } from '../rng';
import { AUTUMN, type Season } from '../season';
import type { Accounts } from './accounts';
import { FOODS, GOODS, RAW_FOODS, shelfLife, type GoodId } from './goods';
import { addGoods, capStorage, count, sellableCount, spoilingSoon, takeOldest } from './inventory';
import { isGatherJob, JOB_RESOURCE, JOBS, type CraftJob, type GatherJob, type JobId } from './jobs';
import { limitPrice } from './market';
import { findNode, nodeYield } from './nodes';
import type { EconomyState, Order, TownEconomy, Worker } from './state';

const W = ECONOMY.worker;

// ───────── 장날 신청 ─────────

/** 갖고 있으려는 음식 양. 가을엔 겨울을 날 만큼 */
function foodReserve(season: Season): number {
  return (season === AUTUMN ? W.winterReserveDays : W.foodReserveDays) * W.foodPerDay;
}

export function workerOrders(w: Worker, town: TownEconomy, season: Season, accounts: Accounts): Order[] {
  const owner = { kind: 'worker', id: w.id } as const;
  const out: Order[] = [];
  const place = (good: GoodId, side: 'buy' | 'sell', qty: number, limit: number) => {
    const o = accounts.place(owner, w.town, good, side, qty, limit);
    if (o) out.push(o);
  };

  // 팔기: 먹을 것, 가공 재료, 여분 도구 하나를 빼고 다 판다. 곧 상하는 건 싸게
  const keep = keepAmounts(w, season);
  const rate = ECONOMY.spoilRate[season];
  for (const good of GOODS) {
    // 내일이면 상할 것은 장에 못 낸다 (먼저 먹는다)
    const surplus = Math.min(count(w.inv, good) - (keep[good] ?? 0), sellableCount(w.inv, good, rate));
    if (surplus > 0) place(good, 'sell', surplus, limitPrice(town, good, W.askMarkdown));
  }

  // 사기: 음식 → 도구 → 가공 재료 순서로 돈이 되는 만큼
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
    const good = foods[w.hunger % foods.length]!;
    const limit = limitPrice(town, good, w.hunger > 0 ? W.hungryBidMarkup : W.bidMarkup);
    place(good, 'buy', Math.min(foodNeed, Math.floor(w.gold / limit)), limit);
  }
  if (w.tool <= W.toolReplaceAt && count(w.inv, 'tools') === 0) {
    const limit = limitPrice(town, 'tools', W.bidMarkup);
    if (w.gold >= limit) place('tools', 'buy', 1, limit);
  }
  if (!isGatherJob(w.job) && craftMargin(w.job, town) > 0) {
    for (const [good, need] of craftNeeds(w, town)) {
      const limit = limitPrice(town, good, W.bidMarkup);
      place(good, 'buy', Math.min(need, Math.floor(w.gold / limit)), limit);
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

/** 하루치 가공에 모자란 재료. 날음식은 더 싼 쪽을 산다 */
function craftNeeds(w: Worker, town: TownEconomy): [GoodId, number][] {
  const recipe = ECONOMY.craft[w.job as CraftJob];
  const needs: [GoodId, number][] = [];
  for (const [g, n] of Object.entries(recipe.inputs) as [GoodId, number][]) {
    const need = n * recipe.batches - count(w.inv, g);
    if (need > 0) needs.push([g, need]);
  }
  if (recipe.rawFood > 0) {
    const have = RAW_FOODS.reduce((s, g) => s + count(w.inv, g), 0);
    const need = recipe.rawFood * recipe.batches - have;
    const cheaper = [...RAW_FOODS].sort((a, b) => town.refPrice[a] - town.refPrice[b])[0]!;
    if (need > 0) needs.push([cheaper, need]);
  }
  return needs;
}

// ───────── 하루 생활 ─────────

export interface WorkerDayContext {
  state: EconomyState;
  season: Season;
  rng: Rng;
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

  if (isGatherJob(w.job)) gather(w, town, w.job, eff, season, rng);
  else craft(w, w.job, eff, rng);

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

function gather(w: Worker, town: TownEconomy, job: GatherJob, eff: number, season: Season, rng: Rng): void {
  const node = findNode(town, JOB_RESOURCE[job]);
  if (!node || (job === 'fisher' && town.storm > 0)) return;
  const factor = eff * nodeYield(node) * ECONOMY.seasonYield[job][season];
  let used = 0;
  for (const [good, base] of Object.entries(ECONOMY.gather[job]) as [GoodId, number][]) {
    let qty = stochasticRound(base * factor, rng);
    // 줄어드는 자원지는 첫 번째 결과물만큼 쓴다 (고기 한 덩이 = 사슴 한 마리 몫)
    if (used === 0 && node.amount < qty) qty = Math.floor(node.amount);
    if (used === 0) used = qty;
    addGoods(w.inv, good, qty);
  }
  if (ECONOMY.node.regrowth[node.kind] !== null) node.amount = Math.max(0, node.amount - used);
}

function craft(w: Worker, job: CraftJob, eff: number, rng: Rng): void {
  const recipe = ECONOMY.craft[job];
  const batches = stochasticRound(recipe.batches * eff, rng);
  for (let b = 0; b < batches; b++) {
    const inputs = Object.entries(recipe.inputs) as [GoodId, number][];
    if (inputs.some(([g, n]) => count(w.inv, g) < n)) return;
    const raw = RAW_FOODS.reduce((s, g) => s + count(w.inv, g), 0);
    if (raw < recipe.rawFood) return;
    for (const [g, n] of inputs) takeOldest(w.inv, g, n);
    let rawLeft = recipe.rawFood;
    // 곧 상하는 날것부터 쓴다
    for (const g of [...RAW_FOODS].sort((a, b) => spoilingSoon(w.inv, b) - spoilingSoon(w.inv, a))) {
      rawLeft -= takeOldest(w.inv, g, rawLeft).reduce((s, l) => s + l.qty, 0);
    }
    for (const [g, n] of Object.entries(recipe.output) as [GoodId, number][]) addGoods(w.inv, g, n);
  }
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

/** 직업별 예상 하루 수입 (기준 시세로). 그 마을에서 할 수 없으면 null */
export function expectedIncome(job: JobId, town: TownEconomy, season: Season): number | null {
  if (isGatherJob(job)) {
    const node = findNode(town, JOB_RESOURCE[job]);
    if (!node) return null;
    if (job === 'fisher' && town.storm > 0) return 0;
    const factor = nodeYield(node) * ECONOMY.seasonYield[job][season];
    return (Object.entries(ECONOMY.gather[job]) as [GoodId, number][]).reduce(
      (s, [g, n]) => s + n * factor * town.refPrice[g] * W.askMarkdown,
      0,
    );
  }
  // 재료를 구할 수 없는 마을에서는 가공으로 벌 수 없다 (어제 파는 사람이 없었음)
  const r = ECONOMY.craft[job];
  const available = (g: GoodId) => town.lastMarket[g].supply > 0;
  if (!(Object.keys(r.inputs) as GoodId[]).every(available)) return 0;
  if (r.rawFood > 0 && !RAW_FOODS.some(available)) return 0;
  return Math.max(0, craftMargin(job, town) * r.batches);
}

/** 가공 한 번의 이익 (결과물 판 값 − 재료 산 값) */
function craftMargin(job: CraftJob, town: TownEconomy): number {
  const r = ECONOMY.craft[job];
  const out = (Object.entries(r.output) as [GoodId, number][]).reduce((s, [g, n]) => s + n * town.refPrice[g] * W.askMarkdown, 0);
  let cost = (Object.entries(r.inputs) as [GoodId, number][]).reduce((s, [g, n]) => s + n * town.refPrice[g] * W.bidMarkup, 0);
  if (r.rawFood > 0) cost += r.rawFood * Math.min(...RAW_FOODS.map((g) => town.refPrice[g])) * W.bidMarkup;
  return out - cost;
}

export function jobCap(job: JobId, town: TownEconomy): number {
  if (!isGatherJob(job)) return ECONOMY.jobCap.crafter;
  const node = findNode(town, JOB_RESOURCE[job]);
  if (!node) return 0;
  // 숲은 사냥꾼과 나무꾼이 나눠 쓴다
  const share = JOB_RESOURCE[job] === 'forest' ? 0.5 : 1;
  return Math.max(1, Math.round(node.tiles * ECONOMY.jobCap.perResourceTile * share));
}

/** 자리가 남은 직업 중 가장 잘 버는 것 */
export function bestJob(state: EconomyState, townId: number, season: Season, except?: Worker): { job: JobId; income: number } | null {
  const town = state.towns[townId]!;
  let best: { job: JobId; income: number } | null = null;
  for (const job of JOBS) {
    const income = expectedIncome(job, town, season);
    if (income === null) continue;
    const taken = state.workers.filter((w) => w !== except && w.town === townId && w.job === job).length;
    if (taken >= jobCap(job, town)) continue;
    if (!best || income > best.income) best = { job, income };
  }
  return best;
}

function reconsider(w: Worker, ctx: WorkerDayContext): 'stay' | 'gone' {
  const { state, season, rng, log } = ctx;
  if (w.hunger >= W.leaveHunger) {
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
      w.hunger = Math.max(0, w.hunger - 1);
      return 'stay';
    }
  }

  const town = state.towns[w.town]!;
  const best = bestJob(state, w.town, season, w);
  if (!best || best.job === w.job) return 'stay';
  const current = expectedIncome(w.job, town, season) ?? 0;
  const envy = best.income > current * W.switchEnvyFactor + 2 && rng.next() < W.switchEnvyChance;
  const desperate = poor && rng.next() < W.switchWhenPoorChance;
  // 지금 일을 이 마을에서 못 하게 되었으면(자원지가 없음) 바로 바꾼다
  const impossible = expectedIncome(w.job, town, season) === null;
  if (envy || desperate || impossible) {
    log({ kind: 'switch', town: w.town, from: w.job, to: best.job });
    w.job = best.job;
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

