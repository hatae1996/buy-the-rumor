// 창고 (기획서 "성장", 0.0.5): 빌리기, 넣고 빼기, 보관료(0.0.8: 칸 수만큼), 상함, 내가 없어도 그 마을 장날에 팔기.
import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods, usedCells } from '../cart';
import { GROWTH } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { netWorth } from '../ranking';
import { generateWorld } from '../worldgen';
import { boardFee, WAREHOUSE_CELLS, WAREHOUSE_FULL_FEE, warehouseFee } from './fee';
import { warehouseAt } from './warehouse';

const SEED = 20261008;
const map = generateWorld(SEED);
let s: EconomyState;

const ok = (cmd: Parameters<typeof applyCommand>[3]) => expect(applyCommand(s, map, 'me', cmd)).toEqual(expect.objectContaining({ ok: true }));

beforeEach(() => {
  s = createEconomy(map, SEED);
  s.players.me!.town = map.towns.find((t) => t.tier === 'town')!.id;
  s.players.me!.gold = 500;
  s.players.me!.cart = createCart('wagon');
});

describe('빌리기와 넣고 빼기', () => {
  it('마을마다 하나 빌리고, 수레 짐을 넣고 뺀다', () => {
    ok({ type: 'rentWarehouse' });
    expect(s.players.me!.gold).toBe(500 - GROWTH.warehouse.deposit);
    expect(applyCommand(s, map, 'me', { type: 'rentWarehouse' })).toEqual({ ok: false, error: 'haveWarehouse' });
    loadGoods(s.players.me!.cart, 'ore', 6);
    ok({ type: 'storeGoods', good: 'ore', qty: 4 });
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(2);
    expect(cartCount(warehouseAt(s.players.me!, s.players.me!.town)!.board, 'ore')).toBe(4);
    ok({ type: 'retrieveGoods', good: 'ore', qty: 1 });
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(3);
    expect(applyCommand(s, map, 'me', { type: 'retrieveGoods', good: 'ore', qty: 9 })).toEqual({ ok: false, error: 'notEnoughGoods' });
  });

  it('다 안 들어가면 옮기지 않는다', () => {
    ok({ type: 'rentWarehouse' });
    // 창고 5×3칸에 곡물(2×2) 조각은 둘, 창고는 네 배로 쌓아 8개까지 (0.0.7). 미리 소금으로 반쯤 채워 둔다
    const w = warehouseAt(s.players.me!, s.players.me!.town)!;
    loadGoods(w.board, 'salt', 12 * 9);
    const stored = JSON.stringify(w.board);
    const grain = loadGoods(s.players.me!.cart, 'grain', 12);
    expect(grain).toBeGreaterThan(4);
    const before = JSON.stringify(s.players.me!.cart);
    expect(applyCommand(s, map, 'me', { type: 'storeGoods', good: 'grain', qty: grain })).toEqual({ ok: false, error: 'noRoom' });
    expect(JSON.stringify(s.players.me!.cart)).toBe(before);
    expect(JSON.stringify(w.board)).toBe(stored);
  });

  it('창고 짐도 순자산에 든다', () => {
    ok({ type: 'rentWarehouse' });
    loadGoods(s.players.me!.cart, 'salt', 3);
    const before = netWorth(s, s.players.me!);
    ok({ type: 'storeGoods', good: 'salt', qty: 3 });
    expect(netWorth(s, s.players.me!)).toBe(before);
  });
});

describe('보관료와 상함', () => {
  it('밤마다 보관료를 내고, 못 내면 밀려 꺼낼 수 없고, 오래 밀리면 짐을 거둬 간다', () => {
    ok({ type: 'rentWarehouse' });
    loadGoods(s.players.me!.cart, 'salt', 3);
    ok({ type: 'storeGoods', good: 'salt', qty: 3 });
    const fee = boardFee(warehouseAt(s.players.me!, s.players.me!.town)!.board);
    expect(fee).toBeGreaterThan(0);
    const gold = s.players.me!.gold;
    advanceDay(s, map);
    expect(s.players.me!.gold).toBeLessThanOrEqual(gold - fee);
    s.players.me!.gold = 0;
    advanceDay(s, map);
    expect(warehouseAt(s.players.me!, s.players.me!.town)!.owed).toBe(fee);
    s.players.me!.gold = 0;
    advanceDay(s, map);
    expect(warehouseAt(s.players.me!, s.players.me!.town)!.owed).toBe(fee * 2);
    expect(applyCommand(s, map, 'me', { type: 'retrieveGoods', good: 'salt', qty: 1 })).toEqual({ ok: false, error: 'warehouseOwed' });
    for (let d = 0; d < GROWTH.warehouse.maxOwedDays + 1; d++) {
      s.players.me!.gold = 0;
      advanceDay(s, map);
    }
    expect(s.players.me!.warehouses).toEqual([]);
    expect(s.players.me!.ledger.some((e) => e.kind === 'warehouse' && e.what === 'seized')).toBe(true);
  });

  it('보관료는 짐이 차지한 칸 수만큼: 5칸마다 1골드 (올림), 빈 창고는 0, 꽉 찬 15칸은 3 (0.0.8)', () => {
    expect(WAREHOUSE_CELLS).toBe(15);
    expect([0, 1, 5, 6, 10, 11, 15].map(warehouseFee)).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(WAREHOUSE_FULL_FEE).toBe(3);
  });

  it('빈 창고는 보관료가 없다', () => {
    ok({ type: 'rentWarehouse' });
    const rents = () => s.players.me!.ledger.filter((e) => e.kind === 'warehouse' && e.what === 'rent').length;
    const before = rents();
    advanceDay(s, map);
    expect(warehouseAt(s.players.me!, s.players.me!.town)!.owed).toBe(0);
    expect(rents()).toBe(before);
    expect(playerView(s, map, 'me').upkeep.parts.some((x) => x.what === '창고 보관료')).toBe(false);
  });

  it('곡물 조각 하나(2×2)는 4칸이라 1골드, 둘은 8칸이라 2골드, 꽉 차면 3골드', () => {
    ok({ type: 'rentWarehouse' });
    const w = warehouseAt(s.players.me!, s.players.me!.town)!;
    const view = () => playerView(s, map, 'me').warehouses[0]!;
    loadGoods(w.board, 'grain', 1);
    expect(usedCells(w.board)).toBe(4);
    expect(view()).toEqual(expect.objectContaining({ usedCells: 4, cells: 15, fee: 1 }));
    // 한 조각에 네 개까지 쌓으니 5개째에서 두 번째 조각
    loadGoods(w.board, 'grain', 4);
    expect(view()).toEqual(expect.objectContaining({ usedCells: 8, fee: 2 }));
    expect(playerView(s, map, 'me').upkeep.parts).toContainEqual({ what: '창고 보관료', perDay: 2 });
    loadGoods(w.board, 'salt', 999);
    expect(view().usedCells).toBeGreaterThan(10);
    expect(view().fee).toBe(3);
  });

  it('음식은 창고에서도 상한다', () => {
    ok({ type: 'rentWarehouse' });
    loadGoods(s.players.me!.cart, 'fish', 2);
    ok({ type: 'storeGoods', good: 'fish', qty: 2 });
    for (let d = 0; d < 6; d++) advanceDay(s, map);
    expect(cartCount(warehouseAt(s.players.me!, s.players.me!.town)!.board, 'fish')).toBe(0);
  });
});

describe('내가 없어도 그 마을 장날에 팔기', () => {
  it('창고 짐으로 낸 팔기 신청은 떠나도 남고, 장날에 맞춰지면 돈이 나에게 온다', () => {
    const home = s.players.me!.town;
    s.players.me!.cart = createCart('handcart');
    ok({ type: 'rentWarehouse' });
    loadGoods(s.players.me!.cart, 'salt', 5);
    ok({ type: 'storeGoods', good: 'salt', qty: 5 });
    ok({ type: 'placeStoreSellOrder', town: home, good: 'salt', qty: 5, minPrice: 1 });
    const to = map.towns.find((t) => t.id !== home)!.id;
    ok({ type: 'travel', to });
    expect(s.orders.filter((o) => o.owner.kind === 'store')).toHaveLength(1);
    const gold = s.players.me!.gold;
    advanceDay(s, map);
    const sold = s.players.me!.ledger.filter((e) => e.kind === 'sell' && e.town === home && e.good === 'salt');
    expect(sold.length).toBeGreaterThan(0);
    expect(s.players.me!.gold).toBeGreaterThan(gold - WAREHOUSE_FULL_FEE - 30);
    expect(playerView(s, map, 'me').warehouses[0]!.count).toBe(5 - sold.reduce((a, e) => a + (e.kind === 'sell' ? e.qty : 0), 0));
  });

  it('창고가 없거나 짐이 모자라면 낼 수 없다', () => {
    expect(applyCommand(s, map, 'me', { type: 'placeStoreSellOrder', town: s.players.me!.town, good: 'salt', qty: 1, minPrice: 1 })).toEqual({
      ok: false,
      error: 'noWarehouse',
    });
    ok({ type: 'rentWarehouse' });
    expect(applyCommand(s, map, 'me', { type: 'placeStoreSellOrder', town: s.players.me!.town, good: 'salt', qty: 1, minPrice: 1 })).toEqual({
      ok: false,
      error: 'notEnoughGoods',
    });
  });
});
