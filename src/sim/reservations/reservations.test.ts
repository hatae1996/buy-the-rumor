// 예약 주문 (0.1.0 작업 3, 질문 88 답): 날마다 그 마을 장날에 들어가는 신청과 도착하면 팔기.
import { describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { dayNotices } from '../notify';
import { generateWorld } from '../worldgen';

const SEED = 20261008;
const map = generateWorld(SEED);
const [A, B] = [0, 1];

/** 나는 B 마을에 있고, A 마을에 창고가 있다 (b1은 A에 있다) */
function setup(): EconomyState {
  const s = createEconomy(map, SEED, { warmupDays: 10, players: [{ id: 'me' }, { id: 'b1' }] });
  const p = s.players.me!;
  p.town = B;
  p.gold = 1000;
  p.cart = createCart('handcart');
  p.warehouses.push({ town: A, board: createCart('warehouse'), owed: 0, owedDays: 0, since: s.day });
  s.players.b1!.town = A;
  s.players.b1!.cart = createCart('handcart');
  return s;
}
const store = (s: EconomyState) => s.players.me!.warehouses[0]!.board;
const reserve = (s: EconomyState, r: { town?: number; good?: 'ore' | 'salt'; side: 'buy' | 'sell'; qty: number; limit: number; until?: number }) =>
  applyCommand(s, map, 'me', { type: 'reserveOrder', town: r.town ?? A, good: r.good ?? 'ore', side: r.side, qty: r.qty, limit: r.limit, until: r.until ?? s.day + 5 });

describe('여러 날 가는 신청', () => {
  it('내가 없어도 그 마을 창고 짐으로 그 마을 장날에 판다. 알리는 것은 내 거래와 체결 값뿐', () => {
    const s = setup();
    loadGoods(store(s), 'ore', 6);
    const memory = JSON.stringify(s.players.me!.memory);
    expect(reserve(s, { side: 'sell', qty: 6, limit: 1 }).ok).toBe(true);
    const day = s.day;
    advanceDay(s, map);
    const sold = s.players.me!.ledger.filter((e) => e.kind === 'sell');
    expect(sold.length).toBeGreaterThan(0);
    expect(sold[0]).toMatchObject({ town: A, good: 'ore', by: 'store', reserved: true });
    // 남은 양이 줄고, 다 팔렸으면 예약이 사라진다
    const n = sold.reduce((a, e) => a + (e.kind === 'sell' ? e.qty : 0), 0);
    const left = playerView(s, map, 'me').reservations;
    if (n === 6) expect(left).toEqual([]);
    else expect(left[0]).toMatchObject({ qty: 6 - n });
    // A 마을 시세는 내 기억에 들어가지 않는다
    expect(JSON.stringify(s.players.me!.memory[A] ?? null)).toBe(JSON.stringify(JSON.parse(memory)[A] ?? null));
    const notes = dayNotices(s, s.players.me!, map, day, [], null);
    expect(notes.filter((x) => x.kind === 'reservation')).toEqual([expect.objectContaining({ text: expect.stringContaining('예약 주문:') })]);
    expect(notes.some((x) => x.kind === 'market')).toBe(false);
  });

  it('예약이라고 다른 값을 받지 않는다: 같은 장날 같은 물건은 같은 값', () => {
    const s = setup();
    loadGoods(store(s), 'ore', 5);
    loadGoods(s.players.b1!.cart, 'ore', 5);
    reserve(s, { side: 'sell', qty: 5, limit: 1 });
    applyCommand(s, map, 'b1', { type: 'placeSellOrder', good: 'ore', qty: 5, minPrice: 1 });
    advanceDay(s, map);
    const price = (id: string) => {
      const e = s.players[id]!.ledger.find((x) => x.kind === 'sell');
      return e?.kind === 'sell' ? e.price : null;
    };
    expect(price('me')).not.toBeNull();
    expect(price('me')).toBe(price('b1'));
  });

  it('짐이나 돈, 받을 곳이 없는 날은 건너뛰고(빚이 되지 않는다), 마감 날이 지나면 사라진다', () => {
    const s = setup();
    // 팔 짐이 없다
    expect(reserve(s, { side: 'sell', qty: 3, limit: 1, until: s.day + 1 }).ok).toBe(true);
    // B에는 창고가 없고 나는 B에 있지만, A의 사기는 A 창고로 받는다. 돈이 없다
    s.players.me!.gold = 0;
    expect(reserve(s, { side: 'buy', qty: 3, limit: 50, until: s.day + 1 }).ok).toBe(true);
    advanceDay(s, map);
    expect(s.players.me!.ledger.filter((e) => e.kind === 'buy' || e.kind === 'sell')).toEqual([]);
    expect(s.players.me!.gold).toBeGreaterThanOrEqual(0);
    expect(s.players.me!.reservations).toHaveLength(2);
    advanceDay(s, map);
    advanceDay(s, map);
    expect(s.players.me!.reservations).toEqual([]);
  });

  it('사기는 그 마을 창고로 받는다. 가진 돈만큼만 맡긴다', () => {
    const s = setup();
    const price = Math.round(s.towns[A]!.refPrice.ore * 3);
    s.players.me!.gold = price * 2;
    expect(reserve(s, { side: 'buy', qty: 10, limit: price }).ok).toBe(true);
    advanceDay(s, map);
    const got = cartCount(store(s), 'ore');
    expect(got).toBeGreaterThan(0);
    expect(got).toBeLessThanOrEqual(2);
    expect(s.players.me!.ledger.find((e) => e.kind === 'buy')).toMatchObject({ by: 'store', reserved: true });
    expect(s.players.me!.reservations[0]).toMatchObject({ qty: 10 - got });
  });

  it('창고가 없는 마을은 수레가 그 마을에 와 있을 때만 들어간다', () => {
    const s = setup();
    s.players.me!.warehouses = [];
    loadGoods(s.players.me!.cart, 'ore', 4);
    expect(reserve(s, { side: 'sell', qty: 4, limit: 1 }).ok).toBe(true);
    advanceDay(s, map);
    expect(s.players.me!.ledger.some((e) => e.kind === 'sell')).toBe(false);
    s.players.me!.town = A;
    advanceDay(s, map);
    expect(s.players.me!.ledger.find((e) => e.kind === 'sell')).toMatchObject({ town: A, reserved: true });
  });

  it('열리기 전에는 못 넣고, 다섯 개까지, 마감 날은 오늘부터 시즌 마지막 날까지', () => {
    const s = setup();
    s.players.me!.unlocks = {};
    expect(reserve(s, { side: 'sell', qty: 1, limit: 1 })).toEqual({ ok: false, error: 'locked' });
    s.players.me!.unlocks.reservation = 1;
    expect(reserve(s, { side: 'sell', qty: 1, limit: 1, until: s.day - 1 })).toEqual({ ok: false, error: 'badDeadline' });
    expect(reserve(s, { side: 'sell', qty: 1, limit: 1, until: s.day + 999 })).toEqual({ ok: false, error: 'badDeadline' });
    for (let i = 0; i < 5; i++) expect(reserve(s, { side: 'sell', qty: 1, limit: 1 }).ok).toBe(true);
    expect(reserve(s, { side: 'sell', qty: 1, limit: 1 })).toEqual({ ok: false, error: 'tooManyReservations' });
    const id = s.players.me!.reservations[0]!.id;
    expect(applyCommand(s, map, 'me', { type: 'cancelReservation', reservationId: id }).ok).toBe(true);
    expect(s.players.me!.reservations).toHaveLength(4);
  });
});

describe('도착하면 팔기', () => {
  it('길을 가는 동안 걸어 두면, 도착한 뒤 첫 장날에 수레 짐을 내고 사라진다', () => {
    const s = setup();
    loadGoods(s.players.me!.cart, 'ore', 5);
    expect(applyCommand(s, map, 'me', { type: 'reserveOnArrival', good: 'ore', qty: 'all', minPrice: 1 })).toEqual({ ok: false, error: 'notTraveling' });
    expect(applyCommand(s, map, 'me', { type: 'travel', to: A }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'reserveOnArrival', good: 'ore', qty: 'all', minPrice: 1 }).ok).toBe(true);
    expect(s.players.me!.reservations[0]).toMatchObject({ kind: 'onArrival', town: A });
    for (let d = 0; d < 20 && s.players.me!.reservations.length; d++) advanceDay(s, map);
    expect(s.players.me!.reservations).toEqual([]);
    const sold = s.players.me!.ledger.filter((e) => e.kind === 'sell');
    expect(sold.length).toBeGreaterThan(0);
    expect(sold[0]).toMatchObject({ town: A, reserved: true });
  });
});
