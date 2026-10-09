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
  s.players.me!.town = producer;
});

describe('원정 기회', () => {
  it('자원지가 있는 마을에 머물면 하루 1개씩, 최대 6개까지 쌓인다', () => {
    for (let d = 1; d <= 10; d++) {
      advanceDay(s, map);
      expect(s.players.me!.expeditionChances).toBe(Math.min(d, ECONOMY.expedition.maxChances));
    }
  });

  it('도시에는 자원지가 없어 쌓이지 않는다', () => {
    s.players.me!.town = city;
    for (let d = 0; d < 5; d++) advanceDay(s, map);
    expect(s.players.me!.expeditionChances).toBe(0);
  });

  it('떠나면 사라지고, 길 위에서는 쌓이지 않는다', () => {
    for (let d = 0; d < 4; d++) advanceDay(s, map);
    expect(s.players.me!.expeditionChances).toBe(4);
    const to = map.towns.find((t) => t.id !== producer)!.id;
    expect(applyCommand(s, map, 'me', { type: 'travel', to }).ok).toBe(true);
    expect(s.players.me!.expeditionChances).toBe(0);
    advanceDay(s, map);
    if (s.players.me!.travel) expect(s.players.me!.expeditionChances).toBe(0);
  });
});

describe('피로', () => {
  it('하룻밤 자면 조금 회복한다', () => {
    s.players.me!.fatigue = 8;
    advanceDay(s, map);
    expect(s.players.me!.fatigue).toBe(8 - ECONOMY.fatigue.nightlyRecovery);
  });

  it('음식을 먹으면 짐에서 하나 줄고, 신선할수록 많이 회복한다', () => {
    s.players.me!.fatigue = 9;
    loadGoods(s.players.me!.cart, 'meat', 1, 0);
    loadGoods(s.players.me!.cart, 'fish', 1, 2.5);
    expect(applyCommand(s, map, 'me', { type: 'eat', good: 'meat' }).ok).toBe(true);
    expect(s.players.me!.fatigue).toBe(9 - ECONOMY.fatigue.meal.fresh);
    expect(cartCount(s.players.me!.cart, 'meat')).toBe(0);
    applyCommand(s, map, 'me', { type: 'eat', good: 'fish' });
    expect(s.players.me!.fatigue).toBe(9 - ECONOMY.fatigue.meal.fresh - ECONOMY.fatigue.meal.soon);
  });

  it('먹을 수 없는 것, 없는 음식, 지치지 않았을 때, 하루 끼니를 넘길 때는 못 먹는다', () => {
    // 등짐엔 곡물(2×2)이 하나만 들어가므로 큰 수레로 시험한다
    s.players.me!.cart = createCart('wagon');
    loadGoods(s.players.me!.cart, 'wood', 1);
    loadGoods(s.players.me!.cart, 'grain', 10);
    expect(applyCommand(s, map, 'me', { type: 'eat', good: 'grain' })).toEqual({ ok: false, error: 'notTired' });
    s.players.me!.fatigue = 10;
    expect(applyCommand(s, map, 'me', { type: 'eat', good: 'wood' })).toEqual({ ok: false, error: 'notFood' });
    expect(applyCommand(s, map, 'me', { type: 'eat', good: 'salted' })).toEqual({ ok: false, error: 'notEnoughGoods' });
    for (let i = 0; i < ECONOMY.fatigue.mealsPerDay; i++) expect(applyCommand(s, map, 'me', { type: 'eat', good: 'grain' }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'eat', good: 'grain' })).toEqual({ ok: false, error: 'tooManyMeals' });
    advanceDay(s, map);
    s.players.me!.fatigue = 5;
    expect(applyCommand(s, map, 'me', { type: 'eat', good: 'grain' }).ok).toBe(true);
  });

  it('여관: 돈을 내고 많이 회복한다. 하루 한 번, 여관비는 경제에서 빠져나간다', () => {
    s.players.me!.fatigue = 9;
    const money = moneySupply(s);
    const gold = s.players.me!.gold;
    expect(applyCommand(s, map, 'me', { type: 'restAtInn' }).ok).toBe(true);
    const inn = ECONOMY.fatigue.inn.town;
    expect(s.players.me!.gold).toBe(gold - inn.fee);
    expect(s.players.me!.fatigue).toBe(9 - inn.recovery);
    expect(moneySupply(s)).toBe(money - inn.fee);
    expect(applyCommand(s, map, 'me', { type: 'restAtInn' })).toEqual({ ok: false, error: 'alreadyRested' });
  });

  it('도시 여관은 비싸지만 더 많이 회복한다. 길 위에는 여관이 없다', () => {
    s.players.me!.town = city;
    s.players.me!.fatigue = 10;
    applyCommand(s, map, 'me', { type: 'restAtInn' });
    expect(s.players.me!.fatigue).toBe(10 - ECONOMY.fatigue.inn.city.recovery);
    s.players.me!.restedToday = false;
    s.players.me!.travel = { from: city, to: producer, days: 2, daysLeft: 2 };
    expect(applyCommand(s, map, 'me', { type: 'restAtInn' })).toEqual({ ok: false, error: 'traveling' });
  });
});

describe('시작 조건', () => {
  it('모두 같은 돈으로, 시작 마을은 4곳에 고르게 랜덤', () => {
    const counts = new Array<number>(map.towns.length).fill(0);
    for (let seed = 1; seed <= 80; seed++) {
      const e = createEconomy(map, seed);
      expect(e.players.me!.gold).toBe(ECONOMY.player.startGold);
      expect(e.players.me!.cart.type).toBe('pack');
      expect(e.players.me!.cart.pieces).toEqual([]);
      counts[e.players.me!.town]!++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(8);
  });
});
