// NPC 상단: 싼 마을에서 사서 비싼 마을로 옮긴다. 플레이어가 없어도 물건이 마을 사이를 돈다.
// 지금은 모든 마을 시세를 안다 (플레이어처럼 소문으로 아는 건 나중에).
import { ECONOMY } from '../constants';
import type { Rng } from '../rng';
import type { Accounts } from './accounts';
import { GOODS, shelfLife, type GoodId } from './goods';
import { count, totalCount } from './inventory';
import { limitPrice } from './market';
import type { EconomyState, Order, Trader } from './state';

const T = ECONOMY.traders;

export const TRADER_NAMES = ['바렌 상단', '미라 상단', '토르 상단', '엘사 상단'];

/** days[a][b]: 오늘 계절의 마을 사이 이동 일수 */
export function traderOrders(trader: Trader, state: EconomyState, days: number[][], accounts: Accounts): Order[] {
  if (trader.travel) return [];
  const here = state.towns[trader.town]!;
  const owner = { kind: 'trader', id: trader.id } as const;
  const out: Order[] = [];

  // 짐이 있으면 판다. 오래 못 팔면 조금씩 싸게 부른다
  if (totalCount(trader.inv) > 0) {
    const factor = Math.max(ECONOMY.priceFloor, T.askMarkdown * (1 - T.stuckMarkdown * trader.stuckDays));
    for (const good of GOODS) {
      const n = count(trader.inv, good);
      if (n === 0) continue;
      const limit = limitPrice(here, good, factor);
      const o = accounts.place(owner, here.id, good, 'sell', n, limit);
      if (o) out.push(o);
    }
    return out;
  }

  const plan = bestPlan(trader, state, days);
  trader.plan = plan ? { good: plan.good, to: plan.to } : null;
  if (!plan) return out;
  const limit = limitPrice(here, plan.good, T.bidMarkup);
  const o = accounts.place(owner, here.id, plan.good, 'buy', Math.min(T.capacity, Math.floor(trader.gold / limit)), limit);
  if (o) out.push(o);
  return out;
}

function bestPlan(trader: Trader, state: EconomyState, days: number[][]): { good: GoodId; to: number; margin: number } | null {
  const here = state.towns[trader.town]!;
  let best: { good: GoodId; to: number; margin: number } | null = null;
  for (const good of GOODS) {
    for (const there of state.towns) {
      const d = days[here.id]![there.id]!;
      if (there.id === here.id || !Number.isFinite(d)) continue;
      // 가는 길에 상하는 건 안 옮긴다
      const life = shelfLife(good);
      if (life !== null && life <= d + 1) continue;
      const margin =
        there.refPrice[good] * T.askMarkdown - here.refPrice[good] * T.bidMarkup - (d * T.costPerDay) / T.capacity;
      if (margin > T.minMargin && (!best || margin > best.margin)) best = { good, to: there.id, margin };
    }
  }
  return best;
}

/** 장날 뒤: 샀으면 떠나고, 길 위면 하루 간다 */
export function traderDay(trader: Trader, state: EconomyState, days: number[][], rng: Rng): void {
  if (trader.travel) {
    trader.travel.daysLeft--;
    if (trader.travel.daysLeft <= 0) {
      trader.town = trader.travel.to;
      trader.travel = null;
    }
    return;
  }
  const loaded = totalCount(trader.inv) > 0;
  if (loaded && trader.plan && trader.plan.to !== trader.town) {
    const d = days[trader.town]![trader.plan.to]!;
    trader.travel = { from: trader.town, to: trader.plan.to, days: d, daysLeft: d };
    trader.plan = null;
    trader.stuckDays = 0;
    return;
  }
  trader.stuckDays = loaded ? trader.stuckDays + 1 : 0;
  // 할 일이 없으면 가끔 다른 마을로 옮겨 본다
  if (!loaded && !trader.plan && rng.next() < 0.1) {
    const others = state.towns.filter((t) => t.id !== trader.town && Number.isFinite(days[trader.town]![t.id]!));
    const to = others[rng.int(0, others.length - 1)];
    if (to) {
      const d = days[trader.town]![to.id]!;
      trader.travel = { from: trader.town, to: to.id, days: d, daysLeft: d };
    }
  }
  if (trader.gold > T.taxThreshold) {
    const tax = Math.floor((trader.gold - T.taxThreshold) * ECONOMY.worker.taxRate);
    trader.gold -= tax;
    state.towns[trader.town]!.treasury += tax;
  }
}
