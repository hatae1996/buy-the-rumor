// 봇의 시간차 장사 (0.0.7, 기획서 "벌이의 균형 - 시간차 장사"): 싼 철에 사서 창고에 두었다가 비싼 철에 판다.
// 봇은 어느 철에 무엇이 많이 나는지(생산 계절)를 안다: 사람이 계절을 겪으며 아는 것과 같다.
// 많이 나는 철 = 싼 철, 적게 나는 철 = 비싼 철. 철이 거의 안 바뀌는 물품(목재, 광석)과 빨리 상하는 물품은 하지 않는다.
import { ECONOMY, GROWTH } from '../constants';
import type { Command, GoodId, PlayerView } from '../economy';
import { basePrice, GOODS, shelfLife } from '../economy';
import type { Season } from '../season';
import type { GrowthMind } from './growth';

/** 물품을 거두는 일 (생산 계절을 본다) */
const PRODUCER: Partial<Record<GoodId, keyof typeof ECONOMY.seasonYield>> = {
  fish: 'fisher',
  meat: 'hunter',
  leather: 'hunter',
  grain: 'farmer',
  wood: 'woodcutter',
  ore: 'miner',
  salt: 'salter',
};

/** 많이 나는 철과 적게 나는 철의 생산 차이가 이만큼은 되어야 철 따라 값이 움직인다고 본다 */
const MIN_SWING = 1.3;
/** 이보다 빨리 상하는 물품은 철을 넘겨 두지 않는다 (일) */
const MIN_SHELF = 50;
/** 싼 철에 기준 가격의 이 배 아래면 산다 */
const BUY_BELOW = 0.65;
/** 산 값의 이 배가 되면 판다 (비싼 철이면 SELL_DEAR배). 비싼 철이 끝나 가면 값을 따지지 않고 판다 */
const SELL_GAIN = 1.8;
const SELL_DEAR = 1.3;
const CLEAR_DAYS = 5;
/** 시간차 장사에는 가진 돈의 이 비율까지만 쓴다 (장사 밑천과 보관료는 남긴다) */
const BUDGET_SHARE = 0.4;

/** 이 물품의 싼 철과 비싼 철. 철 따라 값이 움직이지 않으면 null */
export function seasonsOf(good: GoodId): { cheap: Season; dear: Season } | null {
  const job = PRODUCER[good];
  if (!job) return null;
  const life = shelfLife(good);
  if (life !== null && life < MIN_SHELF) return null;
  const y: readonly number[] = ECONOMY.seasonYield[job];
  const max = Math.max(...y);
  const min = Math.min(...y);
  if (max < MIN_SWING * Math.max(min, 0.1)) return null;
  return { cheap: y.indexOf(max) as Season, dear: y.indexOf(min) as Season };
}

const roomOf = (view: PlayerView, town: number, good: GoodId) => view.warehouses.find((w) => w.town === town)?.room[good] ?? 0;
const countIn = (view: PlayerView, town: number, good: GoodId) =>
  view.warehouses.find((w) => w.town === town)?.pieces.filter((p) => p.good === good).reduce((s, p) => s + p.qty, 0) ?? 0;

/**
 * 시간차 장사 한 걸음: 비싼 철이면 창고 짐을 장에 내고, 싼 철이면 사서 창고에 넣는다.
 * 비상금(reserve)과 여비는 남긴다
 */
export function timeShiftStep(view: PlayerView, reserve: number, g: GrowthMind, once: (c: Command) => Command | null): Command | null {
  // 1. 팔기: 창고 짐 중 지금이 비싼 철인 것 (이 마을이면 지금 시세, 아니면 기억하는 시세로)
  for (const w of view.warehouses) {
    if (w.owed > 0) continue;
    const prices = view.market?.town === w.town ? view.market.price : view.day - (view.memory[w.town]?.day ?? -Infinity) <= 10 ? view.memory[w.town]!.prices : null;
    for (const good of GOODS) {
      const s = seasonsOf(good);
      const n = countIn(view, w.town, good);
      if (!s || n === 0 || view.orders.some((o) => o.from === 'store' && o.town === w.town && o.good === good)) continue;
      const cost = g.shiftCost[good] ?? basePrice(good) * BUY_BELOW;
      const price = prices?.[good] ?? 0;
      // 돈이 모자라면 값을 따지지 않고 판다 (보관료를 못 내 창고를 빼앗기지 않게)
      const broke = view.gold < reserve / 2;
      const ending = view.season === s.dear && view.seasonDaysLeft <= CLEAR_DAYS;
      const gain = price >= cost * (view.season === s.dear ? SELL_DEAR : SELL_GAIN);
      if (!gain && !ending && !broke) continue;
      if (view.season === s.cheap && !broke) continue;
      const minPrice = Math.max(1, Math.round((price || basePrice(good)) * (ending || broke ? 0.7 : 0.9)));
      const c = once({ type: 'placeStoreSellOrder', town: w.town, good, qty: n, minPrice });
      if (c) return c;
    }
  }

  // 2. 사기: 지금 마을에서, 지금이 싼 철이고 값이 싸면
  if (view.location.kind !== 'town' || !view.market) return null;
  const here = view.location.town;
  for (const good of GOODS) {
    const s = seasonsOf(good);
    if (!s || view.season !== s.cheap) continue;
    const price = view.market.price[good];
    if (price > basePrice(good) * BUY_BELOW || view.market.yesterday[good].supply === 0) continue;
    // 창고가 없으면 빌린다
    if (!view.warehouses.some((w) => w.town === here)) {
      if (view.gold < reserve + GROWTH.warehouse.deposit + GROWTH.warehouse.rentPerDay * 30) continue;
      const c = once({ type: 'rentWarehouse' });
      if (c) {
        g.rentedOn[here] = view.day;
        g.firsts.warehouse ??= view.day;
        return c;
      }
      continue;
    }
    // 수레(짐꾼 수레 포함)에 실린 것은 창고로
    const inCart = view.cargo.filter((l) => l.good === good).reduce((a, l) => a + l.qty, 0);
    const room = roomOf(view, here, good);
    if (inCart > 0 && room > 0) {
      const c = once({ type: 'storeGoods', good, qty: Math.min(inCart, room) });
      if (c) return c;
    }
    for (const h of view.hires) {
      const n = h.board?.pieces.filter((p) => p.good === good).reduce((a, p) => a + p.qty, 0) ?? 0;
      if (n > 0 && room > 0) {
        const c = once({ type: 'transferGoods', from: `porter:${h.id}`, to: 'warehouse', good, qty: Math.min(n, room) });
        if (c) return c;
      }
    }
    // 창고 남은 자리만큼 산다 (수레로 받아 다음 날 창고에 넣는다). 쓸 돈은 가진 돈의 일부, 비상금은 남긴다
    const maxPrice = Math.max(1, Math.round(price * 1.1));
    const held = countIn(view, here, good);
    const spent = held * (g.shiftCost[good] ?? price);
    const budget = Math.min(view.gold - reserve, (view.gold + spent) * BUDGET_SHARE - spent);
    const want = Math.min(room - inCart, view.cart.room[good], Math.floor(budget / maxPrice));
    if (want <= 0 || view.orders.some((o) => o.side === 'buy' && o.good === good)) continue;
    const c = once({ type: 'placeBuyOrder', good, qty: want, maxPrice });
    if (c) {
      // 산 값을 기억한다 (가진 양과 섞어서)
      g.shiftCost[good] = held + want > 0 ? ((g.shiftCost[good] ?? price) * held + price * want) / (held + want) : price;
      return c;
    }
  }
  return null;
}
