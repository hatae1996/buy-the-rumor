// 창고 (기획서 "성장", 0.0.5): 빌리기, 넣고 빼기, 보관료, 상함, 내가 없어도 그 마을 장날에 팔기.
import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { GROWTH } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { netWorth } from '../ranking';
import { generateWorld } from '../worldgen';
import { warehouseAt } from './warehouse';

const SEED = 20261008;
const map = generateWorld(SEED);
let s: EconomyState;

const ok = (cmd: Parameters<typeof applyCommand>[2]) => expect(applyCommand(s, map, cmd)).toEqual(expect.objectContaining({ ok: true }));

beforeEach(() => {
  s = createEconomy(map, SEED);
  s.player.town = map.towns.find((t) => t.tier === 'town')!.id;
  s.player.gold = 500;
  s.player.cart = createCart('wagon');
});

describe('빌리기와 넣고 빼기', () => {
  it('마을마다 하나 빌리고, 수레 짐을 넣고 뺀다', () => {
    ok({ type: 'rentWarehouse' });
    expect(s.player.gold).toBe(500 - GROWTH.warehouse.deposit);
    expect(applyCommand(s, map, { type: 'rentWarehouse' })).toEqual({ ok: false, error: 'haveWarehouse' });
    loadGoods(s.player.cart, 'ore', 6);
    ok({ type: 'storeGoods', good: 'ore', qty: 4 });
    expect(cartCount(s.player.cart, 'ore')).toBe(2);
    expect(cartCount(warehouseAt(s.player, s.player.town)!.board, 'ore')).toBe(4);
    ok({ type: 'retrieveGoods', good: 'ore', qty: 1 });
    expect(cartCount(s.player.cart, 'ore')).toBe(3);
    expect(applyCommand(s, map, { type: 'retrieveGoods', good: 'ore', qty: 9 })).toEqual({ ok: false, error: 'notEnoughGoods' });
  });

  it('다 안 들어가면 옮기지 않는다', () => {
    ok({ type: 'rentWarehouse' });
    // 창고 5×3칸에 곡물(2×2) 조각은 둘, 창고는 네 배로 쌓아 8개까지 (0.0.7). 미리 소금으로 반쯤 채워 둔다
    const w = warehouseAt(s.player, s.player.town)!;
    loadGoods(w.board, 'salt', 12 * 9);
    const stored = JSON.stringify(w.board);
    const grain = loadGoods(s.player.cart, 'grain', 12);
    expect(grain).toBeGreaterThan(4);
    const before = JSON.stringify(s.player.cart);
    expect(applyCommand(s, map, { type: 'storeGoods', good: 'grain', qty: grain })).toEqual({ ok: false, error: 'noRoom' });
    expect(JSON.stringify(s.player.cart)).toBe(before);
    expect(JSON.stringify(w.board)).toBe(stored);
  });

  it('창고 짐도 순자산에 든다', () => {
    ok({ type: 'rentWarehouse' });
    loadGoods(s.player.cart, 'salt', 3);
    const before = netWorth(s);
    ok({ type: 'storeGoods', good: 'salt', qty: 3 });
    expect(netWorth(s)).toBe(before);
  });
});

describe('보관료와 상함', () => {
  it('밤마다 보관료를 내고, 못 내면 밀려 꺼낼 수 없고, 오래 밀리면 짐을 거둬 간다', () => {
    ok({ type: 'rentWarehouse' });
    loadGoods(s.player.cart, 'salt', 3);
    ok({ type: 'storeGoods', good: 'salt', qty: 3 });
    const gold = s.player.gold;
    advanceDay(s, map);
    expect(s.player.gold).toBeLessThanOrEqual(gold - GROWTH.warehouse.rentPerDay);
    s.player.gold = 0;
    advanceDay(s, map);
    expect(warehouseAt(s.player, s.player.town)!.owed).toBe(GROWTH.warehouse.rentPerDay);
    expect(applyCommand(s, map, { type: 'retrieveGoods', good: 'salt', qty: 1 })).toEqual({ ok: false, error: 'warehouseOwed' });
    for (let d = 0; d < GROWTH.warehouse.maxOwedDays + 1; d++) {
      s.player.gold = 0;
      advanceDay(s, map);
    }
    expect(s.player.warehouses).toEqual([]);
    expect(s.player.ledger.some((e) => e.kind === 'warehouse' && e.what === 'seized')).toBe(true);
  });

  it('음식은 창고에서도 상한다', () => {
    ok({ type: 'rentWarehouse' });
    loadGoods(s.player.cart, 'fish', 2);
    ok({ type: 'storeGoods', good: 'fish', qty: 2 });
    for (let d = 0; d < 6; d++) advanceDay(s, map);
    expect(cartCount(warehouseAt(s.player, s.player.town)!.board, 'fish')).toBe(0);
  });
});

describe('내가 없어도 그 마을 장날에 팔기', () => {
  it('창고 짐으로 낸 팔기 신청은 떠나도 남고, 장날에 맞춰지면 돈이 나에게 온다', () => {
    const home = s.player.town;
    s.player.cart = createCart('handcart');
    ok({ type: 'rentWarehouse' });
    loadGoods(s.player.cart, 'salt', 5);
    ok({ type: 'storeGoods', good: 'salt', qty: 5 });
    ok({ type: 'placeStoreSellOrder', town: home, good: 'salt', qty: 5, minPrice: 1 });
    const to = map.towns.find((t) => t.id !== home)!.id;
    ok({ type: 'travel', to });
    expect(s.orders.filter((o) => o.owner.kind === 'store')).toHaveLength(1);
    const gold = s.player.gold;
    advanceDay(s, map);
    const sold = s.player.ledger.filter((e) => e.kind === 'sell' && e.town === home && e.good === 'salt');
    expect(sold.length).toBeGreaterThan(0);
    expect(s.player.gold).toBeGreaterThan(gold - GROWTH.warehouse.rentPerDay - 30);
    expect(playerView(s, map).warehouses[0]!.count).toBe(5 - sold.reduce((a, e) => a + (e.kind === 'sell' ? e.qty : 0), 0));
  });

  it('창고가 없거나 짐이 모자라면 낼 수 없다', () => {
    expect(applyCommand(s, map, { type: 'placeStoreSellOrder', town: s.player.town, good: 'salt', qty: 1, minPrice: 1 })).toEqual({
      ok: false,
      error: 'noWarehouse',
    });
    ok({ type: 'rentWarehouse' });
    expect(applyCommand(s, map, { type: 'placeStoreSellOrder', town: s.player.town, good: 'salt', qty: 1, minPrice: 1 })).toEqual({
      ok: false,
      error: 'notEnoughGoods',
    });
  });
});
