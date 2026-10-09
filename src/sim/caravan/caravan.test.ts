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
import { restWage } from '../hire';
import { moneySupply } from '../economy/stats';

const SEED = 20261008;
const map = generateWorld(SEED);
let s: EconomyState;
const ok = (cmd: Parameters<typeof applyCommand>[3]) => expect(applyCommand(s, map, 'me', cmd)).toEqual(expect.objectContaining({ ok: true }));
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
  s.players.me!.town = shopTown(s);
  s.players.me!.gold = 3000;
  s.players.me!.cart = createCart('handcart');
  s.players.me!.horses = [horse(901)];
});

describe('꾸리기', () => {
  it('마부, 내 말, 이 마을 수레방에서 산 수레로 꾸린다', () => {
    expect(applyCommand(s, map, 'me', { type: 'formCaravan', horseIds: [901], cart: 'wagon' })).toEqual({ ok: false, error: 'noCarter' });
    ok({ type: 'hire', role: 'carter' });
    const gold = s.players.me!.gold;
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    expect(s.players.me!.gold).toBe(gold - CART.types.wagon.price);
    expect(s.players.me!.horses).toEqual([]);
    expect(s.players.me!.caravan).toMatchObject({ town: s.players.me!.town, horses: [expect.objectContaining({ id: 901 })] });
  });

  it('말 2필 제한은 두 행렬 합이다. 마차(2필)를 쓰면 두 번째 행렬을 못 만든다', () => {
    ok({ type: 'hire', role: 'carter' });
    s.players.me!.cart = createCart('carriage');
    s.players.me!.horses = [horse(901), horse(902)];
    expect(applyCommand(s, map, 'me', { type: 'formCaravan', horseIds: [902], cart: 'wagon' })).toEqual({ ok: false, error: 'needHorse' });
    s.players.me!.cart = createCart('handcart');
    ok({ type: 'formCaravan', horseIds: [902], cart: 'wagon' });
    // 이미 두 필 (내 행렬 1 + 두 번째 행렬 1)
    s.horses.stables.forEach((st) => (st.stock.pony = 3));
    const stableTown = s.horses.stables[0]?.town;
    if (stableTown !== undefined) {
      s.players.me!.town = stableTown;
      expect(applyCommand(s, map, 'me', { type: 'buyHorse', kind: 'pony' })).toEqual({ ok: false, error: 'tooManyHorses' });
    }
  });

  it('행렬 짐과 말도 순자산에 든다', () => {
    ok({ type: 'hire', role: 'carter' });
    const before = netWorth(s, s.players.me!);
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    // 수레값만큼 돈이 줄고 말은 그대로 (행렬로 옮겼을 뿐)
    expect(netWorth(s, s.players.me!)).toBe(before - CART.types.wagon.price);
  });
});

describe('지시서', () => {
  it('지시서 마을로 가서 장날에 사고, 다음 마을로 가서 판다 (마부는 지시를 바꾸지 않는다)', () => {
    const home = s.players.me!.town;
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
    const bought = s.players.me!.ledger.filter((e) => e.kind === 'buy' && e.by === 'caravan');
    expect(bought.length).toBeGreaterThan(0);
    expect(s.players.me!.caravan!.travel?.to).toBe(other);
    for (let d = 0; d < 12 && !s.players.me!.ledger.some((e) => e.kind === 'sell' && e.by === 'caravan'); d++) advanceDay(s, map);
    expect(s.players.me!.ledger.some((e) => e.kind === 'sell' && e.by === 'caravan' && e.town === other)).toBe(true);
    expect(s.players.me!.ledger.some((e) => e.kind === 'caravan' && e.what === 'arrive' && e.town === other)).toBe(true);
  });

  it('알아서 싣기는 칸의 80%까지만', () => {
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const c = s.players.me!.caravan!;
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
    expect(applyCommand(s, map, 'me', { type: 'setCaravanPlan', plan: { stops: [], repeat: true } })).toEqual({ ok: false, error: 'badPlan' });
    expect(
      applyCommand(s, map, 'me', { type: 'setCaravanPlan', plan: { stops: [{ town: 99, buys: [], sells: [] }], repeat: true } }),
    ).toEqual({ ok: false, error: 'badPlan' });
  });
});

describe('불러들이기와 풀기, 마부가 떠나면', () => {
  it('불러들이면 내가 있는 마을로 오고, 와 있으면 짐을 주고받고 풀 수 있다', () => {
    const home = s.players.me!.town;
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const other = map.towns.find((t) => t.id !== home)!.id;
    ok({ type: 'setCaravanPlan', plan: { stops: [{ town: other, buys: [], sells: [] }], repeat: false } });
    advanceDay(s, map);
    expect(s.players.me!.caravan!.travel).not.toBeNull();
    ok({ type: 'recallCaravan' });
    for (let d = 0; d < 20 && !(playerView(s, map, 'me').caravan?.here); d++) advanceDay(s, map);
    expect(playerView(s, map, 'me').caravan!.here).toBe(true);
    loadGoods(s.players.me!.cart, 'ore', 3);
    ok({ type: 'transferGoods', from: 'cart', to: 'caravan', good: 'ore', qty: 3 });
    expect(applyCommand(s, map, 'me', { type: 'disbandCaravan' })).toEqual({ ok: false, error: 'boardNotEmpty' });
    ok({ type: 'transferGoods', from: 'caravan', to: 'cart', good: 'ore', qty: 3 });
    ok({ type: 'disbandCaravan' });
    expect(s.players.me!.caravan).toBeNull();
    expect(s.players.me!.horses.map((h) => h.id)).toEqual([901]);
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(3);
  });

  it('마부가 떠나면(일당을 못 받음) 행렬은 그 자리에 멈춘다', () => {
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon' });
    const other = map.towns.find((t) => t.id !== s.players.me!.town)!.id;
    ok({ type: 'setCaravanPlan', plan: { stops: [{ town: other, buys: [], sells: [] }], repeat: true } });
    s.players.me!.gold = 0;
    advanceDay(s, map);
    expect(s.players.me!.hires.some((h) => h.role === 'carter')).toBe(false);
    expect(s.players.me!.caravan!.plan).toBeNull();
  });
});

describe('수레 빌리기와 마부 일당 (0.0.9, questions.md 77번)', () => {
  const wageLine = () => s.players.me!.ledger.filter((e) => e.kind === 'hire' && e.what === 'wage' && e.day === s.day - 1).reduce((a, e) => a + (e.kind === 'hire' ? e.fee : 0), 0);

  it('빌려서 꾸리면 수레값이 나가지 않고, 밤마다 하루 값을 빌린 수레방 마을에 낸다', () => {
    const home = s.players.me!.town;
    ok({ type: 'hire', role: 'carter' });
    const gold = s.players.me!.gold;
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon', rent: true });
    expect(s.players.me!.gold).toBe(gold);
    expect(s.players.me!.caravan!.rent).toEqual({ town: home, perDay: CART.rentPerDay.wagon, owed: 0 });
    expect(playerView(s, map, 'me').upkeep.parts).toContainEqual({ what: '빌린 수레', perDay: CART.rentPerDay.wagon });
    const money = moneySupply(s);
    const r = advanceDay(s, map);
    const rent = s.players.me!.ledger.filter((e) => e.kind === 'caravan' && e.what === 'rent');
    expect(rent).toEqual([expect.objectContaining({ town: home, fee: CART.rentPerDay.wagon })]);
    // 돈은 새거나 생기지 않는다 (빌린 값은 마을 금고로)
    expect(moneySupply(s)).toBe(money + r.stipend + r.outsideGold + r.arrivedGold - r.tribute - r.leftGold);
  });

  it('못 낸 값은 밀리고, 풀 때 다 내야 한다. 풀면 돌려받는 돈은 없다', () => {
    ok({ type: 'hire', role: 'carter' });
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon', rent: true });
    // 마부가 떠나지 않을 만큼만 남긴다 (쉬는 날 일당은 내고 수레 값은 밀린다)
    s.players.me!.gold = 4;
    advanceDay(s, map);
    advanceDay(s, map);
    const owed = s.players.me!.caravan!.rent!.owed;
    expect(owed).toBeGreaterThan(0);
    s.players.me!.gold = owed - 1;
    expect(applyCommand(s, map, 'me', { type: 'disbandCaravan' })).toEqual({ ok: false, error: 'notEnoughGold' });
    s.players.me!.gold = owed + 100;
    ok({ type: 'disbandCaravan' });
    expect(s.players.me!.gold).toBe(100);
    expect(s.players.me!.caravan).toBeNull();
    expect(s.players.me!.horses.map((h) => h.id)).toEqual([901]);
    expect(s.players.me!.ledger.at(-1)).toMatchObject({ kind: 'caravan', what: 'disband', rented: true, fee: owed });
  });

  it('등짐은 빌릴 수 없고, 첫 밤 값을 낼 돈은 있어야 한다', () => {
    ok({ type: 'hire', role: 'carter' });
    s.players.me!.horses = [horse(901, 'pony')];
    expect(applyCommand(s, map, 'me', { type: 'formCaravan', horseIds: [901], cart: 'pack', rent: true })).toEqual({ ok: false, error: 'badPlan' });
    s.players.me!.gold = CART.rentPerDay.handcart - 1;
    expect(applyCommand(s, map, 'me', { type: 'formCaravan', horseIds: [901], cart: 'handcart', rent: true })).toEqual({ ok: false, error: 'notEnoughGold' });
  });

  it('마부 일당: 행렬이 길에 있거나 장날 신청을 낸 날은 다, 쉬는 날은 적게', () => {
    const home = s.players.me!.town;
    ok({ type: 'hire', role: 'carter' });
    const carter = s.players.me!.hires.find((h) => h.role === 'carter')!;
    // 행렬을 맡기 전: 쉬는 날
    advanceDay(s, map);
    expect(wageLine()).toBe(restWage(carter));
    expect(restWage(carter)).toBe(Math.max(1, Math.round((carter.wage * GROWTH.hire.carter.restWage) / GROWTH.hire.carter.wage)));
    ok({ type: 'formCaravan', horseIds: [901], cart: 'wagon', rent: true });
    // 지시 없이 서 있는 날: 쉬는 날
    advanceDay(s, map);
    expect(wageLine()).toBe(restWage(carter));
    // 장날 신청을 낸 날과 길에 있는 날: 다
    const other = map.towns.find((t) => t.id !== home)!.id;
    ok({ type: 'setCaravanPlan', plan: { stops: [{ town: home, buys: [], sells: [] }, { town: other, buys: [], sells: [] }], repeat: false } });
    advanceDay(s, map);
    expect(wageLine()).toBe(carter.wage);
    expect(s.players.me!.caravan!.travel).not.toBeNull();
    advanceDay(s, map);
    expect(wageLine()).toBe(carter.wage);
  });

  it('게시판과 수레방은 쉬는 날 일당과 빌리는 값을 보인다', () => {
    const v = playerView(s, map, 'me');
    const offer = v.hireBoard.find((o) => o.role === 'carter');
    if (offer) expect(offer.restWage).toBe(restWage(offer));
    expect(v.hireBoard.filter((o) => o.role !== 'carter').every((o) => o.restWage === null)).toBe(true);
    expect(v.carts.find((c) => c.type === 'wagon')!.rentPerDay).toBe(CART.rentPerDay.wagon);
    expect(v.carts.find((c) => c.type === 'pack')!.rentPerDay).toBeNull();
  });
});
