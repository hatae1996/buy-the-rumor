// 봇의 큰 주문 노리기 (0.0.7): 징조를 들으면 그 사건이 사들일 물품을 미리 모아 가고, 주문이 열리면 주문 값에 판다.
import { describe, expect, it } from 'vitest';
import { createCart, loadGoods } from '../cart';
import { applyCommand, createEconomy, playerView, type Command } from '../economy';
import { activate } from '../events';
import { addNote } from '../rumors';
import { generateWorld } from '../worldgen';
import { bigOrderSell, bigPlanStep, holdForBigOrder, updateBigPlan } from './bigOrder';
import { botProfile } from './profiles';

const SEED = 20261008;
const map = generateWorld(SEED);

function setup() {
  const s = createEconomy(map, SEED, { warmupDays: 20 });
  s.players.me!.cart = createCart('handcart');
  s.players.me!.gold = 1000;
  return s;
}

describe('징조를 듣고 노린다', () => {
  it('큰 주문 사건의 징조면 그 마을과 사들일 물품을 노린다. 다른 징조는 노리지 않는다', () => {
    const s = setup();
    const town = map.towns.find((t) => t.id !== s.players.me!.town)!.id;
    addNote(s, s.players.me!, { town: s.players.me!.town, text: '"시험"', via: 'gossip', from: '우물가 마르타', gossip: 1, rumor: null, importance: 5, claim: { kind: 'omen', event: 'landslide', town, from: s.day, until: s.day + 5 } });
    expect(updateBigPlan(playerView(s, map, 'me'), null, botProfile('trader'))).toBeNull();
    addNote(s, s.players.me!, { town: s.players.me!.town, text: '"시험"', via: 'gossip', from: '우물가 마르타', gossip: 1, rumor: null, importance: 5, claim: { kind: 'omen', event: 'army', town, from: s.day, until: s.day + 12 } });
    const plan = updateBigPlan(playerView(s, map, 'me'), null, botProfile('trader'))!;
    expect(plan).toMatchObject({ event: 'army', town, goods: ['salted', 'leather'] });
    expect(plan.start).toBeGreaterThan(s.day);
    // 원정만 하는 봇은 장사하지 않으니 노리지 않는다
    expect(updateBigPlan(playerView(s, map, 'me'), null, botProfile('gatherer'))).toBeNull();
  });
});

describe('모으고 판다', () => {
  it('여기서 그 물품이 주문 값보다 한참 싸면 사 모은다', () => {
    const s = setup();
    const here = s.players.me!.town;
    const town = map.towns.find((t) => t.id !== here)!.id;
    s.towns[here]!.refPrice.leather = 8;
    s.towns[here]!.lastMarket.leather = { ...s.towns[here]!.lastMarket.leather, supply: 20 };
    const plan = { event: 'army' as const, town, goods: ['leather' as const], price: { leather: 26 }, start: s.day + 8, latest: s.day + 12, until: s.day + 20 };
    const days = map.towns.map(() => map.towns.map(() => 1));
    const r = bigPlanStep(playerView(s, map, 'me'), plan, days, (c) => c);
    expect(r.command).toEqual(expect.objectContaining({ type: 'placeBuyOrder', good: 'leather' }));
    expect(r.trip).toEqual({ goods: ['leather'], to: town, go: false });
  });

  it('모은 물건은 주문이 열리기 전엔 팔지 않고, 주문 마을에서 주문이 열리면 주문 값 가까이에 판다', () => {
    const s = setup();
    const here = s.players.me!.town;
    loadGoods(s.players.me!.cart, 'leather', 20);
    const plan = { event: 'army' as const, town: here, goods: ['leather' as const], price: { leather: 26 }, start: s.day, latest: s.day + 4, until: s.day + 10 };
    expect(holdForBigOrder(playerView(s, map, 'me'), plan, 'leather')).toBe(true);
    activate(s, map, 'army', here, s.day + 5);
    const v = playerView(s, map, 'me');
    expect(holdForBigOrder(v, plan, 'leather')).toBe(false);
    const c = bigOrderSell(v, plan, new Set(), (vv, g) => vv.haul.filter((l) => l.good === g).reduce((a, l) => a + l.qty, 0), (x: Command) => x);
    expect(c).toEqual(expect.objectContaining({ type: 'placeSellOrder', good: 'leather', qty: 20 }));
    expect(applyCommand(s, map, 'me', c!).ok).toBe(true);
  });
});
