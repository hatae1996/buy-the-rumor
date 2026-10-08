// 말 (기획서 "말"): 끄는 무게와 속도, 시즌 입고, 마구간 거래, 먹이와 체력, 수레 바꾸기, 입고 소문.
import { describe, expect, it } from 'vitest';
import { createCart, loadGoods } from '../cart';
import { CART, HORSES } from '../constants';
import { advanceDay, applyCommand, citizenDemand, createEconomy, type EconomyState } from '../economy';
import { capacityOf } from '../economy/traders';
import { playerTravelDays } from '../economy/travel';
import { activate } from '../events';
import { makeRumorsToday } from '../rumors';
import { createRng } from '../rng';
import { seasonOfDay, SPRING } from '../season';
import { generateWorld, type WorldMap } from '../worldgen';
import {
  buyPrice,
  grainToday,
  horseDays,
  horseMorning,
  lacksHorses,
  maxWeight,
  scheduleArrivals,
  sellPrice,
  stableAt,
  stableTowns,
  traderHorseDeal,
  type Horse,
  type HorseKind,
} from './index';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

const horse = (kind: HorseKind, fatigue = 0): Horse => ({ id: 1, kind, fatigue, hungry: 0, price: 100, home: 0 });

/** 마구간 마을에 플레이어를 세우고, 그 마구간에 말을 채워 둔 세계 */
function atStable(seed = 20261008): { map: WorldMap; state: EconomyState; town: number } {
  const map = generateWorld(seed);
  const state = createEconomy(map, seed);
  horseMorning(state, map);
  const town = stableTowns(map)[0]!;
  state.player.town = town;
  const stable = stableAt(state, town)!;
  stable.stock = { pony: 3, draft: 3, swift: 3 };
  state.player.gold = 2000;
  return { map, state, town };
}

describe('끄는 무게와 속도', () => {
  it('말 없이 사람이 끌면 등짐 30, 손수레 70. 짐수레·마차는 말이 있어야 움직인다', () => {
    expect(maxWeight(createCart('pack'), [])).toBe(CART.types.pack.humanPull);
    expect(maxWeight(createCart('handcart'), [])).toBe(CART.types.handcart.humanPull);
    expect(lacksHorses(createCart('wagon'), [])).toBe(true);
    expect(maxWeight(createCart('wagon'), [])).toBe(0);
    expect(maxWeight(createCart('wagon'), [horse('draft')])).toBe(HORSES.kinds.draft.pull);
    expect(lacksHorses(createCart('carriage'), [horse('draft')])).toBe(true);
    expect(maxWeight(createCart('carriage'), [horse('draft'), horse('draft')])).toBe(HORSES.kinds.draft.pull * 2);
  });

  it('최대 무게는 말이 정하고, 약한 말이면 사람이 끄는 것보다 못하지 않다', () => {
    expect(maxWeight(createCart('handcart'), [horse('pony')])).toBe(Math.max(70, HORSES.kinds.pony.pull));
    expect(maxWeight(createCart('pack'), [horse('draft')])).toBe(HORSES.kinds.draft.pull);
  });

  it('다 지친 말은 절반만 끈다', () => {
    expect(maxWeight(createCart('wagon'), [horse('draft', HORSES.fatigue.max)])).toBe(HORSES.kinds.draft.pull / 2);
  });

  it('빠른 말은 길을 줄이고, 지친 말과 둘이 함께면 느린 쪽을 따른다', () => {
    expect(horseDays(3, [])).toBe(3);
    expect(horseDays(3, [horse('swift')])).toBeLessThan(3);
    expect(horseDays(3, [horse('swift', HORSES.fatigue.tiredAt)])).toBe(3);
    expect(horseDays(3, [horse('swift'), horse('draft')])).toBe(3);
    expect(horseDays(1, [horse('swift')])).toBe(1);
  });
});

describe('시즌 입고 (시드 40개)', () => {
  it('목장 근처에 마구간이 적어도 한 곳 있다', () => {
    for (const seed of SEEDS) expect(stableTowns(generateWorld(seed)).length).toBeGreaterThan(0);
  });

  it('정해진 수만 시즌 안에, 마구간 마을에, 같은 시드면 같게 풀린다', () => {
    for (const seed of SEEDS) {
      const map = generateWorld(seed);
      const towns = stableTowns(map);
      const season = { number: 1, startDay: 1, length: 144 };
      const a = scheduleArrivals(seed, season, 0, towns);
      expect(scheduleArrivals(seed, season, 0, towns)).toEqual(a);
      const spring = a.filter((x) => seasonOfDay(x.day, 0) === SPRING).length;
      const total = a.reduce((s, x) => s + x.count, 0);
      expect(total).toBeGreaterThanOrEqual(HORSES.perSeason[0]);
      expect(total).toBeLessThanOrEqual(HORSES.perSeason[1] + spring * HORSES.springExtra);
      for (const x of a) {
        expect(towns).toContain(x.town);
        expect(x.day).toBeLessThanOrEqual(season.length - HORSES.quietLastDays);
        expect(x.day).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('그날 마구간에 풀리고, 목장 화재 동안은 미뤄진다', () => {
    const map = generateWorld(20261008);
    const state = createEconomy(map, 20261008);
    horseMorning(state, map);
    const town = stableTowns(map)[0]!;
    state.horses.arrivals = [{ day: state.day + 1, town, kind: 'draft', count: 2 }];
    activate(state, map, 'ranchFire', town, state.day + 2);
    state.day += 1;
    horseMorning(state, map);
    expect(stableAt(state, town)!.stock.draft).toBe(0);
    state.day += 2;
    horseMorning(state, map);
    expect(stableAt(state, town)!.stock.draft).toBe(2);
    expect(state.horses.arrived.at(-1)).toMatchObject({ town, kind: 'draft', count: 2, day: state.day });
  });
});

describe('마구간 거래', () => {
  it('남은 수가 줄수록 비싸고, 되파는 값은 사는 값보다 싸다', () => {
    const { state, town } = atStable();
    const stable = stableAt(state, town)!;
    const full = buyPrice(stable, 'draft')!;
    stable.stock.draft = 1;
    expect(buyPrice(stable, 'draft')!).toBeGreaterThan(full);
    expect(sellPrice(stable, 'draft')).toBeLessThan(full);
    stable.stock.draft = 0;
    expect(buyPrice(stable, 'draft')).toBeNull();
  });

  it('사면 재고가 줄고 돈은 마을 금고로, 되팔면 그 마구간으로 돌아간다', () => {
    const { map, state, town } = atStable();
    const stable = stableAt(state, town)!;
    const price = buyPrice(stable, 'swift')!;
    const treasury = state.towns[town]!.treasury;
    expect(applyCommand(state, map, { type: 'buyHorse', kind: 'swift' }).ok).toBe(true);
    expect(state.player.gold).toBe(2000 - price);
    expect(stable.stock.swift).toBe(2);
    expect(state.towns[town]!.treasury).toBe(treasury + price);
    expect(state.player.horses[0]).toMatchObject({ kind: 'swift', price, home: town });
    expect(applyCommand(state, map, { type: 'sellHorse', horseId: state.player.horses[0]!.id }).ok).toBe(true);
    expect(stable.stock.swift).toBe(3);
    expect(state.player.horses).toEqual([]);
  });

  it('한 사람 최대 2필, 마구간이 없는 마을에서는 살 수 없다', () => {
    const { map, state } = atStable();
    expect(applyCommand(state, map, { type: 'buyHorse', kind: 'pony' }).ok).toBe(true);
    expect(applyCommand(state, map, { type: 'buyHorse', kind: 'pony' }).ok).toBe(true);
    expect(applyCommand(state, map, { type: 'buyHorse', kind: 'pony' })).toEqual({ ok: false, error: 'tooManyHorses' });
    const other = map.towns.find((t) => !stableTowns(map).includes(t.id))!;
    state.player.town = other.id;
    state.player.horses = [];
    expect(applyCommand(state, map, { type: 'buyHorse', kind: 'pony' })).toEqual({ ok: false, error: 'noStable' });
  });

  it('NPC 상단도 같은 재고에서 사고, 돈이 떨어지면 되판다', () => {
    const { state, town } = atStable();
    const t = state.traders[0]!;
    t.town = town;
    t.travel = null;
    t.gold = HORSES.traderBuyGold + 400;
    const before = capacityOf(t);
    traderHorseDeal(state, t);
    expect(t.horses).toHaveLength(1);
    expect(stableAt(state, town)!.stock.draft).toBe(2);
    expect(capacityOf(t)).toBeGreaterThan(before);
    t.gold = 0;
    traderHorseDeal(state, t);
    expect(t.horses).toEqual([]);
    expect(stableAt(state, town)!.stock.draft).toBe(3);
  });
});

describe('먹이와 체력', () => {
  it('마을에서는 마구간에서 먹이고, 그 곡물을 다음 장날 주민이 사 온다', () => {
    const { map, state, town } = atStable();
    applyCommand(state, map, { type: 'buyHorse', kind: 'draft' });
    const gold = state.player.gold;
    advanceDay(state, map);
    expect(state.player.gold).toBeLessThan(gold);
    expect(state.player.ledger.some((e) => e.kind === 'horseFeed' && e.fee > 0)).toBe(true);
    const t = state.towns[town]!;
    expect(t.stableGrain).toBe(HORSES.kinds.draft.feed);
    const season = seasonOfDay(state.day, state.startSeason);
    const withStable = citizenDemand(state, t, 'grain', season);
    t.stableGrain = 0;
    expect(withStable - citizenDemand(state, t, 'grain', season)).toBeCloseTo(HORSES.kinds.draft.feed);
  });

  it('하루 먹이 0.5인 조랑말은 이틀에 곡물 한 개를 먹는다 (0.0.6)', () => {
    expect(HORSES.kinds.pony.feed).toBe(0.5);
    expect(HORSES.kinds.draft.feed).toBe(1);
    expect(HORSES.kinds.swift.feed).toBe(1);
    const days = Array.from({ length: 10 }, (_, d) => grainToday('pony', d));
    expect(days.reduce((a, b) => a + b, 0)).toBe(5);
    expect(days.every((n) => n === 0 || n === 1)).toBe(true);
    expect(Array.from({ length: 10 }, (_, d) => grainToday('draft', d))).toEqual(Array(10).fill(1));
  });

  it('길 위에서는 수레 곡물을 먹고, 없으면 굶다가 마구간으로 돌아가 버린다', () => {
    const { map, state, town } = atStable();
    stableAt(state, town)!.stock.draft = 3;
    applyCommand(state, map, { type: 'buyHorse', kind: 'draft' });
    state.player.travel = { from: town, to: town, days: 99, daysLeft: 99 };
    loadGoods(state.player.cart, 'grain', 1);
    advanceDay(state, map);
    expect(state.player.horses[0]!.hungry).toBe(0);
    for (let d = 0; d < HORSES.runAwayAfterHungryDays; d++) advanceDay(state, map);
    expect(state.player.horses).toEqual([]);
    expect(stableAt(state, town)!.stock.draft).toBe(3);
    expect(state.player.ledger.some((e) => e.kind === 'horse' && e.what === 'lost')).toBe(true);
  });

  it('길을 가면 지치고, 마구간에서 쉬게 하면 낫는다 (하루 한 번)', () => {
    const { map, state, town } = atStable();
    applyCommand(state, map, { type: 'buyHorse', kind: 'pony' });
    const to = map.towns.find((t) => t.id !== town)!.id;
    expect(applyCommand(state, map, { type: 'travel', to }).ok).toBe(true);
    const tired = state.player.horses[0]!.fatigue;
    expect(tired).toBeGreaterThan(0);
    state.player.travel = null;
    expect(applyCommand(state, map, { type: 'restHorses' }).ok).toBe(true);
    expect(state.player.horses[0]!.fatigue).toBeLessThan(tired);
    expect(applyCommand(state, map, { type: 'restHorses' })).toEqual({ ok: false, error: 'alreadyRestedHorses' });
  });
});

describe('수레 바꾸기와 이동', () => {
  it('쓰던 수레를 쳐 주고 바꾸며, 짐은 옮겨 싣는다', () => {
    const { map, state } = atStable();
    loadGoods(state.player.cart, 'ore', 4);
    const gold = state.player.gold;
    expect(applyCommand(state, map, { type: 'buyCart', cart: 'wagon' }).ok).toBe(true);
    expect(state.player.cart.type).toBe('wagon');
    expect(state.player.gold).toBe(gold - (CART.types.wagon.price - Math.round(CART.types.pack.price * CART.tradeIn)));
    expect(state.player.cart.pieces.reduce((s, p) => s + p.lots.reduce((a, l) => a + l.qty, 0), 0)).toBe(4);
  });

  it('짐이 다 안 들어가면 작은 수레로 바꿀 수 없다', () => {
    const { map, state } = atStable();
    state.player.cart = createCart('wagon');
    loadGoods(state.player.cart, 'grain', 6);
    expect(applyCommand(state, map, { type: 'buyCart', cart: 'pack' })).toEqual({ ok: false, error: 'noRoom' });
    expect(state.player.cart.type).toBe('wagon');
  });

  it('짐수레는 말 없이 떠날 수 없고, 빠른 말이면 덜 걸린다', () => {
    const { map, state, town } = atStable();
    // 걸어서 가장 오래 걸리는 마을
    const walk = playerTravelDays(state, map);
    const to = map.towns.filter((t) => t.id !== town).sort((a, b) => walk[b.id]! - walk[a.id]!)[0]!.id;
    state.player.cart = createCart('wagon');
    expect(applyCommand(state, map, { type: 'travel', to })).toEqual({ ok: false, error: 'needHorse' });
    applyCommand(state, map, { type: 'buyHorse', kind: 'swift' });
    expect(applyCommand(state, map, { type: 'travel', to }).ok).toBe(true);
    expect(state.player.travel!.days).toBe(horseDays(walk[to]!, [horse('swift')]));
    if (walk[to]! >= 2) expect(state.player.travel!.days).toBeLessThan(walk[to]!);
  });
});

describe('말 입고 소문', () => {
  it('입고 며칠 전 목장 마을에서 소문이 나고, 마구간에 가서 보면 도장이 찍힌다', () => {
    const { map, state, town } = atStable();
    state.horses.arrivals = [{ day: state.day + HORSES.rumorLead, town, kind: 'draft', count: 2 }];
    const made = makeRumorsToday(state, map, createRng(1)).filter((r) => r.fact.kind === 'horse');
    expect(made).toHaveLength(1);
    expect(made[0]!.origin).toBe(town);
    state.rumorMill.live.push(...made);
    state.rumorMill.gossips = [{ id: 1, town, name: '마구간 오토', personality: 'elder', good: null }];
    state.rumorMill.gossipSeason = state.season!.number;
    state.day += 1; // 노인은 하루 늦게 안다
    advanceDay(state, map);
    const note = state.player.rumors.find((h) => h.claim?.kind === 'horse')!;
    expect(note.text).toContain('짐말');
    expect(note.text).toContain('모레');
    // 입고 날까지 마구간 마을에 머문다
    while (!state.horses.arrived.length) advanceDay(state, map);
    expect(note.stamp).toBe('right');
  });
});
