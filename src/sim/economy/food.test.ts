// 길의 식량 (0.1.2): 이동하는 날마다 사람 1명당 1, 먼저 상할 것부터, 떨어지면 지치고 느려진다.
import { describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { ECONOMY, FOOD } from '../constants';
import { generateWorld } from '../worldgen';
import { applyCommand } from './commands';
import { createEconomy } from './create';
import { advanceDay } from './day';
import { eatFrom, rationPrice } from './food';
import { moneySupply } from './stats';
import type { EconomyState } from './state';
import { playerView } from './view';

const SEED = 20261008;
const map = generateWorld(SEED);

function world(): EconomyState {
  const s = createEconomy(map, SEED);
  s.players.me!.cart = createCart('handcart');
  s.players.me!.gold = 500;
  return s;
}

/** 길 위에 올려 둔다 (위험 없는 길) */
function onRoad(s: EconomyState, days: number): void {
  const me = s.players.me!;
  const to = map.towns.find((t) => t.id !== me.town)!.id;
  me.travel = { from: me.town, to, days, daysLeft: days, risk: { rough: 0, rockfall: 0, banditsFrom: false, banditsTo: false } };
}

describe('길의 식량', () => {
  it('이동하는 날마다 사람 하나에 식량 하나. 마을에 머무는 날은 먹지 않는다', () => {
    const s = world();
    const me = s.players.me!;
    loadGoods(me.cart, 'rations', 5);
    advanceDay(s, map);
    expect(cartCount(me.cart, 'rations')).toBe(5);
    onRoad(s, 3);
    advanceDay(s, map);
    expect(cartCount(me.cart, 'rations')).toBe(5 - FOOD.perPersonPerDay);
    expect(me.ledger.at(-1)).toMatchObject({ kind: 'roadFood', short: 0 });
    expect(playerView(s, map, 'me').food).toMatchObject({ have: 4, perDay: 1 });
  });

  it('먼저 상할 것부터 먹는다 (생선 → 여행 식량 → 곡물)', () => {
    const cart = createCart('wagon');
    loadGoods(cart, 'grain', 2);
    loadGoods(cart, 'rations', 2);
    loadGoods(cart, 'fish', 1, 2);
    const { eaten, short } = eatFrom([cart], 3);
    expect(short).toBe(0);
    expect(eaten).toEqual([
      { good: 'fish', qty: 1 },
      { good: 'rations', qty: 2 },
    ]);
    expect(cartCount(cart, 'grain')).toBe(2);
  });

  it('떨어지면 피로가 크게 오르고, 배고픈 날이 쌓이면 남은 길이 늘어난다. 짐은 잃지 않는다', () => {
    const s = world();
    const me = s.players.me!;
    loadGoods(me.cart, 'salt', 6);
    onRoad(s, 9);
    me.fatigue = 0;
    advanceDay(s, map);
    expect(me.fatigue).toBeGreaterThanOrEqual(FOOD.hungryFatigue - ECONOMY.fatigue.nightlyRecovery);
    expect(me.ledger.find((e) => e.kind === 'roadFood')).toMatchObject({ short: 1 });
    // 0.25일씩 네 번이면 하루 늦어진다
    const per = FOOD.hungrySlowDays;
    for (let d = 1; d < Math.round(1 / per); d++) advanceDay(s, map);
    expect(me.travel!.daysLeft).toBe(9 - Math.round(1 / per) + 1);
    expect(cartCount(me.cart, 'salt')).toBe(6);
  });

  it('짐꾼도 먹는다', () => {
    const s = world();
    const me = s.players.me!;
    me.hires.push({ id: 99, role: 'porter', name: '짐꾼', town: me.town, hiredDay: 0, board: createCart('handcart') } as never);
    loadGoods(me.cart, 'rations', 4);
    onRoad(s, 3);
    advanceDay(s, map);
    expect(cartCount(me.cart, 'rations')).toBe(2);
  });

  it('잡화점 여행 식량: 값은 그 마을 곡물·염장 시세를 따르고, 돈은 마을 금고로, 실을 수 있는 만큼', () => {
    const s = world();
    const me = s.players.me!;
    const price = rationPrice(s, me.town);
    const ref = s.towns[me.town]!.refPrice;
    expect(price).toBe(Math.max(1, Math.round(((ref.grain + ref.salted) / 2) * FOOD.rations.priceFactor)));
    const money = moneySupply(s);
    const treasury = s.towns[me.town]!.treasury;
    expect(applyCommand(s, map, 'me', { type: 'buyRations', qty: 6 }).ok).toBe(true);
    expect(cartCount(me.cart, 'rations')).toBe(6);
    expect(me.gold).toBe(500 - 6 * price);
    expect(s.towns[me.town]!.treasury - treasury).toBe(6 * price);
    expect(moneySupply(s)).toBe(money);
    // 여행 식량은 한 칸에 4개: 6개면 2칸
    expect(me.cart.pieces.filter((p) => p.good === 'rations')).toHaveLength(2);
    // 장날에는 낼 수 없다
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'rations' as never, qty: 1, minPrice: 1 }).ok).toBe(false);
    // 길 위에서는 못 산다
    onRoad(s, 2);
    expect(applyCommand(s, map, 'me', { type: 'buyRations', qty: 1 })).toEqual({ ok: false, error: 'traveling' });
  });
});
