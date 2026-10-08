// 두 번째 행렬 (기획서 "성장", 0.0.5): 마부 + 말 + 수레, 지시서대로 장날에 신청하고 다음 마을로, 알아서 싣기 80%.
import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { CART, GROWTH } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { hasBuilding } from '../growth/buildings';
import type { Horse } from '../horses';
import { netWorth } from '../ranking';
import { generateWorld } from '../worldgen';
import { autoLoadRoom } from './index';

const SEED = 20261008;
const map = generateWorld(SEED);
let s: EconomyState;
const ok = (cmd: Parameters<typeof applyCommand>[2]) => expect(applyCommand(s, map, cmd)).toEqual(expect.objectContaining({ ok: true }));
const horse = (id: number, kind: Horse['kind'] = 'draft'): Horse => ({ id, kind, fatigue: 0, hungry: 0, price: 220, home: 0 });

/** 수레방이 있고 일꾼이 넉넉한 마을 */
function shopTown(st: EconomyState): number {
  return map.towns
    .filter((t) => hasBuilding(st, map, t.id, 'cartShop'))
    .map((t) => ({ id: t.id, n: st.workers.filter((w) => w.town === t.id).length }))
    .sort((a, b) => b.n - a.n)[0]!.id;
}

beforeEach(() => {
  s = createEconomy(map, SEED, { warmupDays: 20 });
  s.player.town = shopTown(s);
  s.player.gold = 3000;
  s.player.cart = createCart('handcart');
  s.player.horses = [horse(901)];
});

describe('꾸리기', () => {
  it('마부, 내 말, 이 마을 수레방에서 산 수레로 꾸린다', () => {
    expect(applyCommand(s, map, { type: 'formCaravan', horseIds: [901], cart: 'wagon' })).toEqual({ ok: false, error: 'noCarter' });
    ok({ type: 'hire', role: 'carter' });
    const gold = s.player.gold;
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    expect(s.player.gold).toBe(gold - CART.types.wagon.price);
    expect(s.player.horses).toEqual([]);
    expect(s.player.caravan).toMatchObject({ town: s.player.town, horses: [expect.objectContaining({ id: 901 })] });
  });

  it('말 2필 제한은 두 행렬 합이다. 마차(2필)를 쓰면 두 번째 행렬을 못 만든다', () => {
    ok({ type: 'hire', role: 'carter' });
    s.player.cart = createCart('carriage');
    s.player.horses = [horse(901), horse(902)];
    expect(applyCommand(s, map, { type: 'formCaravan', horseIds: [902], cart: 'wagon' })).toEqual({ ok: false, error: 'needHorse' });
    s.player.cart = createCart('handcart');
    ok({ type: 'formCaravan', horseIds: [902], cart: 'wagon' });
    // 이미 두 필 (내 행렬 1 + 두 번째 행렬 1)
    s.horses.stables.forEach((st) => (st.stock.pony = 3));
    const stableTown = s.horses.stables[0]?.town;
    if (stableTown !== undefined) {
      s.player.town = stableTown;
      expect(applyCommand(s, map, { type: 'buyHorse', kind: 'pony' })).toEqual({ ok: false, error: 'tooManyHorses' });
    }
  });

  it('행렬 짐과 말도 순자산에 든다', () => {
    ok({ type: 'hire', role: 'carter' });
    const before = netWorth(s);
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    // 수레값만큼 돈이 줄고 말은 그대로 (행렬로 옮겼을 뿐)
    expect(netWorth(s)).toBe(before - CART.types.wagon.price);
  });
});

describe('지시서', () => {
  it('지시서 마을로 가서 장날에 사고, 다음 마을로 가서 판다 (마부는 지시를 바꾸지 않는다)', () => {
    const home = s.player.town;
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const other = map.towns.find((t) => t.id !== home)!.id;
    // 이 마을 장에 어제 가장 많이 나온 물건을 산다
    const good = (Object.keys(s.towns[home]!.lastMarket) as (keyof typeof s.towns[0]['lastMarket'])[]).sort(
      (a, b) => s.towns[home]!.lastMarket[b].supply - s.towns[home]!.lastMarket[a].supply,
    )[0]!;
    const buyPrice = Math.round(s.towns[home]!.refPrice[good] * 2) + 5;
    ok({
      type: 'setCaravanPlan',
      plan: {
        stops: [
          { town: home, buys: [{ good, qty: 6, maxPrice: buyPrice }], sells: [] },
          { town: other, buys: [], sells: [{ good, qty: 'all', minPrice: 1 }] },
        ],
        repeat: false,
      },
    });
    advanceDay(s, map);
    const bought = s.player.ledger.filter((e) => e.kind === 'buy' && e.by === 'caravan');
    expect(bought.length).toBeGreaterThan(0);
    expect(s.player.caravan!.travel?.to).toBe(other);
    for (let d = 0; d < 12 && !s.player.ledger.some((e) => e.kind === 'sell' && e.by === 'caravan'); d++) advanceDay(s, map);
    expect(s.player.ledger.some((e) => e.kind === 'sell' && e.by === 'caravan' && e.town === other)).toBe(true);
    expect(s.player.ledger.some((e) => e.kind === 'caravan' && e.what === 'arrive' && e.town === other)).toBe(true);
  });

  it('알아서 싣기는 칸의 80%까지만', () => {
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const c = s.player.caravan!;
    const slots = CART.types.wagon.rows.join('').split('').filter((x) => x === '#').length;
    const room = autoLoadRoom(c, 'salt');
    loadGoods(c.cart, 'salt', room);
    const used = c.cart.pieces.reduce((a, p) => a + CART.goods[p.good].shape.length, 0);
    expect(used).toBeLessThanOrEqual(Math.floor(slots * GROWTH.caravan.autoLoadShare));
    expect(autoLoadRoom(c, 'salt')).toBe(0);
  });

  it('지시서가 이상하면 받지 않는다', () => {
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    expect(applyCommand(s, map, { type: 'setCaravanPlan', plan: { stops: [], repeat: true } })).toEqual({ ok: false, error: 'badPlan' });
    expect(
      applyCommand(s, map, { type: 'setCaravanPlan', plan: { stops: [{ town: 99, buys: [], sells: [] }], repeat: true } }),
    ).toEqual({ ok: false, error: 'badPlan' });
  });
});

describe('불러들이기와 풀기, 마부가 떠나면', () => {
  it('불러들이면 내가 있는 마을로 오고, 와 있으면 짐을 주고받고 풀 수 있다', () => {
    const home = s.player.town;
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const other = map.towns.find((t) => t.id !== home)!.id;
    ok({ type: 'setCaravanPlan', plan: { stops: [{ town: other, buys: [], sells: [] }], repeat: false } });
    advanceDay(s, map);
    expect(s.player.caravan!.travel).not.toBeNull();
    ok({ type: 'recallCaravan' });
    for (let d = 0; d < 20 && !(playerView(s, map).caravan?.here); d++) advanceDay(s, map);
    expect(playerView(s, map).caravan!.here).toBe(true);
    loadGoods(s.player.cart, 'ore', 3);
    ok({ type: 'transferGoods', from: 'cart', to: 'caravan', good: 'ore', qty: 3 });
    expect(applyCommand(s, map, { type: 'disbandCaravan' })).toEqual({ ok: false, error: 'boardNotEmpty' });
    ok({ type: 'transferGoods', from: 'caravan', to: 'cart', good: 'ore', qty: 3 });
    ok({ type: 'disbandCaravan' });
    expect(s.player.caravan).toBeNull();
    expect(s.player.horses.map((h) => h.id)).toEqual([901]);
    expect(cartCount(s.player.cart, 'ore')).toBe(3);
  });

  it('마부가 떠나면(일당을 못 받음) 행렬은 그 자리에 멈춘다', () => {
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const other = map.towns.find((t) => t.id !== s.player.town)!.id;
    ok({ type: 'setCaravanPlan', plan: { stops: [{ town: other, buys: [], sells: [] }], repeat: true } });
    s.player.gold = 0;
    advanceDay(s, map);
    expect(s.player.hires.some((h) => h.role === 'carter')).toBe(false);
    expect(s.player.caravan!.plan).toBeNull();
  });
});
