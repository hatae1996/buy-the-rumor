// 도시 공방: 대장간과 염장 공방 (handoff 0.0.4 "도시에 대장간과 염장 공방을 둔다").
// 도시 금고로 광석·목재·생선·고기·소금을 사들여 도구와 염장 식품을 만들어 판다.
// 일꾼이 아니라 도시가 운영하는 곳이라 굶거나 떠나지 않는다. 도구가 늘 조금씩은 나오는 곳이다.
import { ECONOMY } from '../constants';
import type { Accounts } from './accounts';
import { basePrice, priceBounds, RAW_FOODS, type GoodId } from './goods';
import { addGoods, capStorage, count, sellableCount, takeOldest } from './inventory';
import type { CraftJob } from './jobs';
import { limitPrice } from './market';
import type { Order, TownEconomy } from './state';

const WS = ECONOMY.city.workshop;
const W = ECONOMY.worker;

/** 공방이 하는 가공 (일꾼 가공 직업과 같은 재료와 결과) */
const RECIPES = Object.keys(WS.batches) as CraftJob[];

export function workshopOrders(town: TownEconomy, accounts: Accounts): Order[] {
  const inv = town.workshop;
  if (!inv) return [];
  const owner = { kind: 'workshop', town: town.id } as const;
  const out: Order[] = [];
  const place = (good: GoodId, side: 'buy' | 'sell', qty: number, limit: number) => {
    const o = accounts.place(owner, town.id, good, side, qty, limit);
    if (o) out.push(o);
  };

  // 만든 것은 다 판다. 많이 쌓였으면 싸게
  const rate = 1;
  for (const job of RECIPES) {
    for (const good of Object.keys(ECONOMY.craft[job].output) as GoodId[]) {
      const qty = sellableCount(inv, good, rate);
      if (qty <= 0) continue;
      const glut = Math.min(1, (qty * basePrice(good)) / W.glutValue);
      place(good, 'sell', qty, limitPrice(town, good, W.askMarkdown * (1 - W.glutMaxDiscount * glut)));
    }
  }

  // 재료마다 남는 장사가 되는 값까지만 부른다 (다른 재료는 시세로 쳐서). 금고의 일부만 쓴다
  const budget = () => Math.floor(accounts.gold(owner) * WS.treasuryShare);
  for (const job of RECIPES) {
    const r = ECONOMY.craft[job];
    const batches = WS.batches[job];
    const room = margin(town, job);
    const bid = (g: GoodId, n: number, need: number) => {
      // 이 재료에 쓸 수 있는 값 = 시세 + 남는 이익을 이 재료 몫으로 다 쓸 때
      const breakeven = Math.floor(town.refPrice[g] + room / n);
      // 기준 가격의 일정 배율 위로는 부르지 않는다 (공방이 시세를 끝없이 끌어올리지 않게)
      const limit = Math.min(limitPrice(town, g, W.bidMarkup), breakeven, Math.round(basePrice(g) * WS.maxBidOfBase));
      if (need > 0 && limit >= priceBounds(g).min) place(g, 'buy', Math.min(need, Math.floor(budget() / limit)), limit);
    };
    for (const [g, n] of Object.entries(r.inputs) as [GoodId, number][]) bid(g, n, n * batches - count(inv, g));
    if (r.rawFood > 0) {
      const have = RAW_FOODS.reduce((s, g) => s + count(inv, g), 0);
      const raw = [...RAW_FOODS].sort((a, b) => town.refPrice[a] - town.refPrice[b])[0]!;
      bid(raw, r.rawFood, r.rawFood * batches - have);
    }
  }
  return out;
}

/** 장날 뒤: 재료가 있는 만큼 하루 가공 */
export function workshopDay(town: TownEconomy): void {
  const inv = town.workshop;
  if (!inv) return;
  for (const job of RECIPES) {
    const r = ECONOMY.craft[job];
    for (let b = 0; b < WS.batches[job]; b++) {
      const inputs = Object.entries(r.inputs) as [GoodId, number][];
      if (inputs.some(([g, n]) => count(inv, g) < n)) break;
      if (RAW_FOODS.reduce((s, g) => s + count(inv, g), 0) < r.rawFood) break;
      for (const [g, n] of inputs) takeOldest(inv, g, n);
      let rawLeft = r.rawFood;
      for (const g of RAW_FOODS) rawLeft -= takeOldest(inv, g, rawLeft).reduce((s, l) => s + l.qty, 0);
      for (const [g, n] of Object.entries(r.output) as [GoodId, number][]) addGoods(inv, g, n);
    }
  }
  capStorage(inv, W.storagePerGood);
}

/** 가공 한 번의 이익 (도시 시세로). 결과물 값은 기준 가격의 일정 배율 아래로 보지 않는다 */
function margin(town: TownEconomy, job: CraftJob): number {
  const r = ECONOMY.craft[job];
  const value = (g: GoodId) => Math.max(town.refPrice[g], basePrice(g) * W.crafterValueFloor);
  const out = (Object.entries(r.output) as [GoodId, number][]).reduce((s, [g, n]) => s + n * value(g) * W.askMarkdown, 0);
  let cost = (Object.entries(r.inputs) as [GoodId, number][]).reduce((s, [g, n]) => s + n * town.refPrice[g], 0);
  if (r.rawFood > 0) cost += r.rawFood * Math.min(...RAW_FOODS.map((g) => town.refPrice[g]));
  return out - cost;
}
