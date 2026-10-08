import { beforeEach, describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { generateWorld } from '../worldgen';
import { applyCommand } from './commands';
import { createEconomy } from './create';
import { advanceDay } from './day';
import { cartCount, createCart, loadGoods } from '../cart';
import type { EconomyState } from './state';
import { moneySupply } from './stats';

const map = generateWorld(20261008);
const producer = map.towns.find((t) => t.tier === 'town')!.id;
const city = map.towns.find((t) => t.tier === 'city')!.id;
let s: EconomyState;

beforeEach(() => {
  s = createEconomy(map, 20261008);
  s.player.town = producer;
});

describe('원정 기회', () => {
  it('자원지가 있는 마을에 머물면 하루 1개씩, 최대 6개까지 쌓인다', () => {
    for (let d = 1; d <= 10; d++) {
      advanceDay(s, map);
      expect(s.player.expeditionChances).toBe(Math.min(d, ECONOMY.expedition.maxChances));
    }
  });

  it('도시에는 자원지가 없어 쌓이지 않는다', () => {
    s.player.town = city;
    for (let d = 0; d < 5; d++) advanceDay(s, map);
    expect(s.player.expeditionChances).toBe(0);
  });

  it('떠나면 사라지고, 길 위에서는 쌓이지 않는다', () => {
    for (let d = 0; d < 4; d++) advanceDay(s, map);
    expect(s.player.expeditionChances).toBe(4);
    const to = map.towns.find((t) => t.id !== producer)!.id;
    expect(applyCommand(s, map, { type: 'travel', to }).ok).toBe(true);
    expect(s.player.expeditionChances).toBe(0);
    advanceDay(s, map);
    if (s.player.travel) expect(s.player.expeditionChances).toBe(0);
  });
});

describe('피로', () => {
  it('하룻밤 자면 조금 회복한다', () => {
    s.player.fatigue = 8;
    advanceDay(s, map);
    expect(s.player.fatigue).toBe(8 - ECONOMY.fatigue.nightlyRecovery);
  });

  it('음식을 먹으면 짐에서 하나 줄고, 신선할수록 많이 회복한다', () => {
    s.player.fatigue = 9;
    loadGoods(s.player.cart, 'meat', 1, 0);
    loadGoods(s.player.cart, 'fish', 1, 2.5);
    expect(applyCommand(s, map, { type: 'eat', good: 'meat' }).ok).toBe(true);
    expect(s.player.fatigue).toBe(9 - ECONOMY.fatigue.meal.fresh);
    expect(cartCount(s.player.cart, 'meat')).toBe(0);
    applyCommand(s, map, { type: 'eat', good: 'fish' });
    expect(s.player.fatigue).toBe(9 - ECONOMY.fatigue.meal.fresh - ECONOMY.fatigue.meal.soon);
  });

  it('먹을 수 없는 것, 없는 음식, 지치지 않았을 때, 하루 끼니를 넘길 때는 못 먹는다', () => {
    // 등짐엔 곡물(2×2)이 하나만 들어가므로 큰 수레로 시험한다
    s.player.cart = createCart('wagon');
    loadGoods(s.player.cart, 'wood', 1);
    loadGoods(s.player.cart, 'grain', 10);
    expect(applyCommand(s, map, { type: 'eat', good: 'grain' })).toEqual({ ok: false, error: 'notTired' });
    s.player.fatigue = 10;
    expect(applyCommand(s, map, { type: 'eat', good: 'wood' })).toEqual({ ok: false, error: 'notFood' });
    expect(applyCommand(s, map, { type: 'eat', good: 'salted' })).toEqual({ ok: false, error: 'notEnoughGoods' });
    for (let i = 0; i < ECONOMY.fatigue.mealsPerDay; i++) expect(applyCommand(s, map, { type: 'eat', good: 'grain' }).ok).toBe(true);
    expect(applyCommand(s, map, { type: 'eat', good: 'grain' })).toEqual({ ok: false, error: 'tooManyMeals' });
    advanceDay(s, map);
    s.player.fatigue = 5;
    expect(applyCommand(s, map, { type: 'eat', good: 'grain' }).ok).toBe(true);
  });

  it('여관: 돈을 내고 많이 회복한다. 하루 한 번, 여관비는 경제에서 빠져나간다', () => {
    s.player.fatigue = 9;
    const money = moneySupply(s);
    const gold = s.player.gold;
    expect(applyCommand(s, map, { type: 'restAtInn' }).ok).toBe(true);
    const inn = ECONOMY.fatigue.inn.town;
    expect(s.player.gold).toBe(gold - inn.fee);
    expect(s.player.fatigue).toBe(9 - inn.recovery);
    expect(moneySupply(s)).toBe(money - inn.fee);
    expect(applyCommand(s, map, { type: 'restAtInn' })).toEqual({ ok: false, error: 'alreadyRested' });
  });

  it('도시 여관은 비싸지만 더 많이 회복한다. 길 위에는 여관이 없다', () => {
    s.player.town = city;
    s.player.fatigue = 10;
    applyCommand(s, map, { type: 'restAtInn' });
    expect(s.player.fatigue).toBe(10 - ECONOMY.fatigue.inn.city.recovery);
    s.player.restedToday = false;
    s.player.travel = { from: city, to: producer, days: 2, daysLeft: 2 };
    expect(applyCommand(s, map, { type: 'restAtInn' })).toEqual({ ok: false, error: 'traveling' });
  });
});

describe('시작 조건', () => {
  it('모두 같은 돈으로, 시작 마을은 4곳에 고르게 랜덤', () => {
    const counts = new Array<number>(map.towns.length).fill(0);
    for (let seed = 1; seed <= 80; seed++) {
      const e = createEconomy(map, seed);
      expect(e.player.gold).toBe(ECONOMY.player.startGold);
      expect(e.player.cart.type).toBe('pack');
      expect(e.player.cart.pieces).toEqual([]);
      counts[e.player.town]!++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(8);
  });
});
