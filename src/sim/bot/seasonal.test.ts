// 시간차 장사 (0.0.7): 많이 나는 철에 사서 창고에 두었다가 적게 나는 철에 판다. 창고는 수레보다 높이 쌓는다.
import { describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { CART, GROWTH } from '../constants';
import { applyCommand, createEconomy, playerView, type Command } from '../economy';
import { AUTUMN, SPRING, SUMMER, WINTER } from '../season';
import { generateWorld } from '../worldgen';
import { createGrowthMind } from './growth';
import { seasonsOf, timeShiftStep } from './seasonal';

describe('철 따라 값이 움직이는 물품', () => {
  it('생산이 많은 철이 싼 철, 적은 철이 비싼 철. 철이 안 바뀌거나 빨리 상하면 하지 않는다', () => {
    // 곡물은 봄이 가장 비싸다 (보릿고개, 0.0.8)
    expect(seasonsOf('grain')).toEqual({ cheap: AUTUMN, dear: SPRING });
    expect(seasonsOf('salt')).toEqual({ cheap: SUMMER, dear: WINTER });
    expect(seasonsOf('leather')).toEqual({ cheap: AUTUMN, dear: SPRING });
    expect(seasonsOf('wood')).toBeNull();
    expect(seasonsOf('ore')).toBeNull();
    // 생선은 4일, 고기는 5일이면 상한다
    expect(seasonsOf('fish')).toBeNull();
    expect(seasonsOf('meat')).toBeNull();
  });
});

describe('창고는 높이 쌓는다', () => {
  it('같은 물품 한 조각에 수레의 stackFactor배까지', () => {
    const w = createCart('warehouse');
    const c = createCart('handcart');
    expect(loadGoods(w, 'salt', 9999)).toBe(15 * CART.goods.salt.stack * GROWTH.warehouse.stackFactor);
    expect(loadGoods(c, 'salt', 1)).toBe(1);
    expect(c.pieces[0]!.lots[0]!.qty).toBe(1);
  });
});

describe('봇의 시간차 장사', () => {
  it('싼 철에 값이 싸면 창고를 빌리고, 사서 넣는다. 가진 돈의 일부만 쓴다', () => {
    const seed = 20261008;
    const map = generateWorld(seed);
    const s = createEconomy(map, seed, { warmupDays: 20 });
    s.players.me!.gold = 1000;
    s.players.me!.cart = createCart('handcart');
    // 소금이 싼 여름 날로 맞추고, 이 마을 소금 값을 싸게 둔다
    while (playerView(s, map, 'me').season !== SUMMER) s.day++;
    const here = s.players.me!.town;
    s.towns[here]!.refPrice.salt = 3;
    s.towns[here]!.lastMarket.salt = { ...s.towns[here]!.lastMarket.salt, supply: 50 };
    const g = createGrowthMind();
    const step = (): Command | null => {
      const c = timeShiftStep(playerView(s, map, 'me'), 100, g, (x) => x);
      if (c) expect(applyCommand(s, map, 'me', c)).toEqual(expect.objectContaining({ ok: true }));
      return c;
    };
    expect(step()).toEqual({ type: 'rentWarehouse' });
    const buy = step();
    expect(buy).toEqual(expect.objectContaining({ type: 'placeBuyOrder', good: 'salt' }));
    expect(buy!.type === 'placeBuyOrder' && buy!.qty * buy!.maxPrice).toBeLessThanOrEqual(1000 * 0.4 + 1);
    // 산 소금이 수레에 오면 창고에 넣는다
    // 신청을 거두고(잡아 둔 수레 자리를 푼다) 산 것처럼 수레에 싣는다
    for (const o of [...s.orders]) expect(applyCommand(s, map, 'me', { type: 'cancelOrder', orderId: o.id }).ok).toBe(true);
    loadGoods(s.players.me!.cart, 'salt', 20);
    expect(step()).toEqual({ type: 'storeGoods', good: 'salt', qty: 20 });
    expect(cartCount(s.players.me!.warehouses[0]!.board, 'salt')).toBe(20);
  });

  it('비싼 철에 산 값보다 충분히 오르면 창고 짐을 장에 낸다', () => {
    const seed = 20261008;
    const map = generateWorld(seed);
    const s = createEconomy(map, seed, { warmupDays: 20 });
    s.players.me!.gold = 1000;
    expect(applyCommand(s, map, 'me', { type: 'rentWarehouse' }).ok).toBe(true);
    loadGoods(s.players.me!.warehouses[0]!.board, 'salt', 30);
    while (playerView(s, map, 'me').season !== WINTER) s.day++;
    s.towns[s.players.me!.town]!.refPrice.salt = 9;
    const g = createGrowthMind();
    g.shiftCost.salt = 3;
    const c = timeShiftStep(playerView(s, map, 'me'), 100, g, (x) => x);
    expect(c).toEqual(expect.objectContaining({ type: 'placeStoreSellOrder', good: 'salt', qty: 30 }));
  });
});
