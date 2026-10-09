// 봇의 두 번째 행렬 (0.0.8): 큰 주문 도구. 징조를 들으면 꾸려서 한 번짜리 지시로 사 모아 주문 마을에 팔고, 쉬면 푼다.
import { beforeEach, describe, expect, it } from 'vitest';
import { createCart, loadGoods } from '../cart';
import { advanceDay, applyCommand, createEconomy, playerView, type Command, type EconomyState } from '../economy';
import { hasBuilding } from '../growth/buildings';
import type { Horse } from '../horses';
import { addNote } from '../rumors';
import { generateWorld } from '../worldgen';
import type { BigPlan } from './bigOrder';
import { caravanBigStep, createCaravanMind, type CaravanMind } from './caravanBig';
import { botProfile } from './profiles';

const SEED = 20261008;
const map = generateWorld(SEED);
const trader = botProfile('trader');
const days = map.towns.map(() => map.towns.map(() => 2));
let s: EconomyState;
let mind: CaravanMind;

const horse = (id: number): Horse => ({ id, kind: 'draft', fatigue: 0, hungry: 0, price: 220, home: 0 });
/** 봇이 고른 명령 하나를 보내고 돌려준다 */
const step = (own: BigPlan | null = null, profile = trader): Command | null => {
  const c = caravanBigStep(playerView(s, map, 'me'), profile, mind, own, days, (x) => x);
  if (c) expect(applyCommand(s, map, 'me', c)).toEqual(expect.objectContaining({ ok: true }));
  return c;
};
/** 군대 보급 징조를 듣는다 (가죽과 염장 식품을 사들인다) */
const hearArmy = (town: number) =>
  addNote(s, s.players.me!, { town: s.players.me!.town, text: '"시험"', via: 'gossip', from: '우물가 마르타', gossip: 1, rumor: null, importance: 5, claim: { kind: 'omen', event: 'army', town, from: s.day, until: s.day + 12 } });

beforeEach(() => {
  s = createEconomy(map, SEED, { warmupDays: 20 });
  // 수레방과 여관이 있는 마을
  s.players.me!.town = map.towns.find((t) => hasBuilding(s, map, t.id, 'cartShop') && hasBuilding(s, map, t.id, 'inn'))!.id;
  s.players.me!.gold = 3000;
  s.players.me!.cart = createCart('handcart');
  s.players.me!.horses = [horse(901)];
  mind = createCaravanMind();
});

describe('꾸리기', () => {
  it('노릴 큰 주문이 없으면 꾸리지 않는다', () => {
    expect(step()).toBeNull();
    expect(s.players.me!.hires).toEqual([]);
  });

  it('징조를 들었는데 싸게 사 모을 곳을 모르면 꾸리지 않는다 (마부 일당만 나간다)', () => {
    hearArmy(map.towns.find((t) => t.id !== s.players.me!.town)!.id);
    expect(step()).toBeNull();
  });

  it('징조를 듣고, 싸게 사 모을 곳을 알면 마부를 데려오고 남는 말로 행렬을 꾸린다', () => {
    const [order, source] = map.towns.filter((t) => t.id !== s.players.me!.town).map((t) => t.id);
    hearArmy(order!);
    s.players.me!.memory[source!] = { day: s.day, prices: { ...playerView(s, map, 'me').market!.price, leather: 6 }, previous: null };
    expect(step()).toEqual({ type: 'hire', role: 'carter' });
    expect(step()).toEqual(expect.objectContaining({ type: 'formCaravan', horseIds: [901] }));
    expect(mind.target).toMatchObject({ event: 'army', town: order });
    expect(mind.formed).toBe(s.day);
  });

  it('말이 없으면, 말을 사고도 꾸릴 돈이 남을 때만 마구간에서 산다 (꾸리지 못한 말은 먹이만 먹는다)', () => {
    // 말을 되팔 때 잃는 값까지 쳐도 남을 만큼 싸게 사 모을 곳 (0.0.9)
    const [order, source] = map.towns.filter((t) => t.id !== s.players.me!.town).map((t) => t.id);
    hearArmy(order!);
    s.players.me!.memory[source!] = { day: s.day, prices: { ...playerView(s, map, 'me').market!.price, leather: 2 }, previous: null };
    s.players.me!.horses = [];
    // 시즌이 없는 시험 세계라 마구간을 직접 연다
    s.horses.stables.push({ town: s.players.me!.town, stock: { pony: 0, draft: 1, swift: 0 } });
    const price = playerView(s, map, 'me').stable!.horses.find((h) => h.kind === 'draft')!.price!;
    s.players.me!.gold = trader.growth!.caravanGold + price - 1;
    expect(step()).toBeNull();
    s.players.me!.gold = trader.growth!.caravanGold + price + 50;
    expect(step()).toEqual({ type: 'buyHorse', kind: 'draft' });
    // 산 뒤에는 같은 마을에서 마부를 데려와 꾸린다
    expect(step()).toEqual({ type: 'hire', role: 'carter' });
    expect(step()).toEqual(expect.objectContaining({ type: 'formCaravan' }));
  });

  it('보통 사람은 행렬을 꾸리지 않는다', () => {
    const [order, source] = map.towns.filter((t) => t.id !== s.players.me!.town).map((t) => t.id);
    hearArmy(order!);
    s.players.me!.memory[source!] = { day: s.day, prices: { ...playerView(s, map, 'me').market!.price, leather: 6 }, previous: null };
    expect(step(null, botProfile('casual'))).toBeNull();
  });
});

describe('한 번짜리 지시', () => {
  /** 행렬을 꾸려 둔다 */
  const form = () => {
    expect(applyCommand(s, map, 'me', { type: 'hire', role: 'carter' }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'formCaravan', horseIds: [901], cart: 'wagon' }).ok).toBe(true);
  };

  it('빈 행렬은 기억하는 시세가 싼 마을에서 사 모아 주문 마을에서 판다 (반복 끔)', () => {
    form();
    const here = s.players.me!.town;
    const [order, source] = map.towns.filter((t) => t.id !== here).map((t) => t.id);
    hearArmy(order!);
    const prices = { ...playerView(s, map, 'me').market!.price, leather: 5 };
    s.players.me!.memory[source!] = { day: s.day, prices, previous: null };
    const c = step();
    expect(c).toMatchObject({ type: 'setCaravanPlan', plan: { repeat: false } });
    const stops = s.players.me!.caravan!.plan!.stops;
    // 싼 마을에서 장날 사흘에 걸쳐 사 모은다
    expect(stops.map((x) => x.town)).toEqual([source, source, source, order]);
    expect(stops[0]!.buys[0]!.good).toBe('leather');
    // 주문 값(가죽 16 × 1.6 = 26)의 0.9배 이상에만 판다
    expect(stops.at(-1)!.sells).toEqual([{ good: 'leather', qty: 'all', minPrice: 23 }]);
  });

  it('모아 둔 짐이 있으면 바로 주문 마을로 가서 판다', () => {
    form();
    const order = map.towns.find((t) => t.id !== s.players.me!.town)!.id;
    hearArmy(order);
    loadGoods(s.players.me!.caravan!.cart, 'salted', 4);
    expect(step()).toEqual({
      type: 'setCaravanPlan',
      plan: { stops: [{ town: order, buys: [], sells: [{ good: 'salted', qty: 'all', minPrice: 37 }] }], repeat: false },
    });
  });

  it('주문 마을에서 주문이 열릴 가장 늦은 날이 지나도 안 팔렸으면 그만두고 남은 짐을 판다 (헛징조, 0.0.9)', () => {
    form();
    const here = s.players.me!.town;
    hearArmy(here);
    loadGoods(s.players.me!.caravan!.cart, 'leather', 10);
    // 주문 마을에 있으니 주문 값 가까이에 판다
    expect(step()).toMatchObject({ type: 'setCaravanPlan', plan: { stops: [{ town: here, sells: [{ good: 'leather', minPrice: 23 }] }] } });
    // 징조 + 12일(가장 늦게 열릴 날)이 지나도 그대로 남았다
    s.players.me!.caravan!.plan = null;
    s.day = mind.target!.latest + 2;
    s.players.me!.memory[here] = { day: s.day, prices: { ...playerView(s, map, 'me').market!.price, leather: 10 }, previous: null };
    expect(step()).toEqual({
      type: 'setCaravanPlan',
      plan: { stops: [{ town: here, buys: [], sells: [{ good: 'leather', qty: 'all', minPrice: 8 }] }], repeat: false },
    });
    expect(mind.dropped).toEqual([`army:${here}`]);
    expect(mind.target).toBeNull();
  });

  it('한 번짜리 지시가 끝나면 행렬은 그 마을에서 멈추고 다시 돌지 않는다', () => {
    form();
    const here = s.players.me!.town;
    expect(applyCommand(s, map, 'me', { type: 'setCaravanPlan', plan: { stops: [{ town: here, buys: [], sells: [] }], repeat: false } }).ok).toBe(true);
    advanceDay(s, map);
    expect(s.players.me!.caravan!.plan).toBeNull();
    for (let d = 0; d < 3; d++) advanceDay(s, map);
    expect(s.players.me!.caravan!.town).toBe(here);
    expect(s.players.me!.caravan!.travel).toBeNull();
  });
});

describe('쉬면 푼다', () => {
  it('노릴 것 없이 오래 쉬면 행렬을 풀고, 마부를 내보낸다', () => {
    expect(applyCommand(s, map, 'me', { type: 'hire', role: 'carter' }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'formCaravan', horseIds: [901], cart: 'handcart' }).ok).toBe(true);
    expect(step()).toBeNull();
    mind.idleSince = s.day - 10;
    expect(step()).toEqual({ type: 'disbandCaravan' });
    const carter = s.players.me!.hires.find((h) => h.role === 'carter')!;
    expect(step()).toEqual({ type: 'dismissHire', hireId: carter.id });
    expect(s.players.me!.horses.map((h) => h.id)).toEqual([901]);
  });
});
