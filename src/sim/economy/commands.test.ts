import { beforeEach, describe, expect, it } from 'vitest';
import { generateWorld, townTravelDays } from '../worldgen';
import { seasonOfDay } from '../season';
import { applyCommand } from './commands';
import { createEconomy } from './create';
import { advanceDay } from './day';
import { cartCount, createCart, loadGoods } from '../cart';
import type { EconomyState } from './state';
import { moneySupply } from './stats';

const map = generateWorld(20261008);
let s: EconomyState;

beforeEach(() => {
  s = createEconomy(map, 20261008);
  // 시작 마을은 랜덤이다. 아래 테스트는 0번 마을에서 시작한다고 보고 쓴다
  s.players.me!.town = 0;
});

describe('플레이어 명령', () => {
  it('사자 신청은 돈을 맡기고, 취소하면 그대로 돌려준다', () => {
    const gold = s.players.me!.gold;
    const r = applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'ore', qty: 5, maxPrice: 7 });
    expect(r.ok).toBe(true);
    expect(s.players.me!.gold).toBe(gold - 35);
    expect(moneySupply(s)).toBe(moneySupply(createEconomy(map, 20261008)));
    applyCommand(s, map, 'me', { type: 'cancelOrder', orderId: r.ok ? r.orderId! : -1 });
    expect(s.players.me!.gold).toBe(gold);
    expect(s.orders).toHaveLength(0);
  });

  it('팔자 신청은 짐을 맡긴다. 없는 물건은 못 판다', () => {
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'ore', qty: 1, minPrice: 5 })).toEqual({
      ok: false,
      error: 'notEnoughGoods',
    });
    loadGoods(s.players.me!.cart, 'ore', 10);
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'ore', qty: 4, minPrice: 5 }).ok).toBe(true);
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(6);
  });

  it('잘못된 값은 받지 않는다', () => {
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'grain', qty: 0, maxPrice: 5 }).ok).toBe(false);
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'grain', qty: 1.5, maxPrice: 5 }).ok).toBe(false);
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'grain', qty: 1, maxPrice: -1 }).ok).toBe(false);
    // 등짐 9칸에 광석 30개(조각 하나에 3개)는 안 들어간다
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'ore', qty: 30, maxPrice: 1 })).toEqual({ ok: false, error: 'noRoom' });
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'tools', qty: 10, maxPrice: 100 })).toEqual({
      ok: false,
      error: 'notEnoughGold',
    });
  });

  it('장날에 정산된다: 정한 값보다 비싸게 사지 않고, 산 물건이 짐에 들어온다', () => {
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'salted', qty: 2, maxPrice: 40 }).ok).toBe(true);
    const gold = s.players.me!.gold + 2 * 40;
    advanceDay(s, map);
    const bought = s.players.me!.ledger.filter((e) => e.kind === 'buy');
    const qty = bought.reduce((a, e) => a + (e.kind === 'buy' ? e.qty : 0), 0);
    expect(cartCount(s.players.me!.cart, 'salted')).toBe(qty);
    for (const e of bought) if (e.kind === 'buy') expect(e.price).toBeLessThanOrEqual(40);
    // 못 채운 만큼은 돌려받는다
    const paid = bought.reduce((a, e) => a + (e.kind === 'buy' ? e.qty * e.price : 0), 0);
    expect(s.players.me!.gold).toBe(gold - paid);
    expect(s.orders).toHaveLength(0);
  });

  it('지금 있는 마을 시세는 날짜와 함께 기억한다', () => {
    advanceDay(s, map);
    expect(s.players.me!.memory[0]?.day).toBe(1);
    expect(s.players.me!.memory[1]).toBeUndefined();
  });

  it('이동: 여비를 내고, 낸 신청은 거두고, 걸리는 날만큼 지나야 도착한다', () => {
    loadGoods(s.players.me!.cart, 'ore', 5);
    applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'ore', qty: 5, minPrice: 99 });
    const days = townTravelDays(map, seasonOfDay(s.day, s.startSeason))[0]![2]!;
    const gold = s.players.me!.gold;
    expect(applyCommand(s, map, 'me', { type: 'travel', to: 2 }).ok).toBe(true);
    expect(s.orders).toHaveLength(0);
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(5);
    expect(s.players.me!.gold).toBeLessThan(gold);
    // 가는 길에는 장에 신청할 수 없다
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'grain', qty: 1, maxPrice: 9 })).toEqual({
      ok: false,
      error: 'traveling',
    });
    for (let d = 1; d < days; d++) {
      advanceDay(s, map);
      expect(s.players.me!.travel).not.toBeNull();
    }
    advanceDay(s, map);
    expect(s.players.me!.travel).toBeNull();
    expect(s.players.me!.town).toBe(2);
  });

  it('지금 있는 마을로는 못 간다', () => {
    expect(applyCommand(s, map, 'me', { type: 'travel', to: 0 })).toEqual({ ok: false, error: 'sameTown' });
  });

  it('내일이면 상할 물건은 장에 낼 수 없다 (산 사람이 바로 버리게 되므로)', () => {
    loadGoods(s.players.me!.cart, 'fish', 2, 2.5);
    loadGoods(s.players.me!.cart, 'fish', 3, 0);
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'fish', qty: 4, minPrice: 1 })).toEqual({
      ok: false,
      error: 'spoiling',
    });
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'fish', qty: 3, minPrice: 1 }).ok).toBe(true);
    // 맡긴 것은 신선한 묶음이다
    expect(s.orders[0]!.lots.every((l) => l.age === 0)).toBe(true);
  });

  it('장날에 산 음식은 적어도 하루는 간다', () => {
    for (let d = 0; d < 40; d++) {
      applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'meat', qty: 2, maxPrice: 40 });
      applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'fish', qty: 2, maxPrice: 40 });
      const before = s.players.me!.ledger.length;
      advanceDay(s, map);
      const today = s.players.me!.ledger.slice(before);
      const bought = today.some((e) => e.kind === 'buy');
      if (bought) expect(today.some((e) => e.kind === 'spoil')).toBe(false);
      // 다음 날을 위해 짐을 비운다
      s.players.me!.cart = createCart('pack');
    }
  });

  it('짐 속 생선은 사흘이면 상하고 장부에 적힌다', () => {
    loadGoods(s.players.me!.cart, 'fish', 4);
    for (let d = 0; d < 3; d++) advanceDay(s, map);
    expect(cartCount(s.players.me!.cart, 'fish')).toBe(0);
    expect(s.players.me!.ledger.some((e) => e.kind === 'spoil' && e.good === 'fish' && e.qty === 4)).toBe(true);
  });
});

describe('수레와 장날', () => {
  it('사자 신청은 수레 자리를 미리 잡는다: 자리가 없으면 신청할 수 없다', () => {
    loadGoods(s.players.me!.cart, 'salt', 24);
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'tools', qty: 1, maxPrice: 99 })).toEqual({
      ok: false,
      error: 'noRoom',
    });
  });

  it('안 팔린 물건은 그사이 수레를 꽉 채워도 제자리로 돌아온다', () => {
    loadGoods(s.players.me!.cart, 'leather', 4);
    // 아무도 안 살 값으로 내놓는다
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'leather', qty: 4, minPrice: 999 }).ok).toBe(true);
    expect(cartCount(s.players.me!.cart, 'leather')).toBe(0);
    advanceDay(s, map);
    expect(cartCount(s.players.me!.cart, 'leather')).toBe(4);
    expect(s.players.me!.cart.pieces.every((p) => p.incoming.length === 0)).toBe(true);
  });

  it('신청을 취소하면 잡아 둔 자리도 풀린다', () => {
    const r = applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'ore', qty: 3, maxPrice: 5 });
    expect(s.players.me!.cart.pieces).toHaveLength(1);
    applyCommand(s, map, 'me', { type: 'cancelOrder', orderId: r.ok ? r.orderId! : -1 });
    expect(s.players.me!.cart.pieces).toHaveLength(0);
  });

  it('무게를 넘으면 출발할 수 없다', () => {
    loadGoods(s.players.me!.cart, 'ore', 12);
    expect(applyCommand(s, map, 'me', { type: 'travel', to: 1 })).toEqual({ ok: false, error: 'overweight' });
    const piece = s.players.me!.cart.pieces[0]!;
    expect(applyCommand(s, map, 'me', { type: 'discardCartPiece', pieceId: piece.id }).ok).toBe(true);
    expect(s.players.me!.ledger.at(-1)).toMatchObject({ kind: 'discard', good: 'ore', qty: 3 });
    expect(applyCommand(s, map, 'me', { type: 'travel', to: 1 }).ok).toBe(true);
  });

  it('짐 조각을 옮기고 돌리고 정리하는 것도 명령이다', () => {
    loadGoods(s.players.me!.cart, 'wood', 1);
    const wood = s.players.me!.cart.pieces[0]!;
    expect(applyCommand(s, map, 'me', { type: 'rotateCartPiece', pieceId: wood.id }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'moveCartPiece', pieceId: wood.id, x: 5, y: 5, rot: 0 })).toEqual({
      ok: false,
      error: 'cantPlace',
    });
    expect(applyCommand(s, map, 'me', { type: 'packCart' }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'rotateCartPiece', pieceId: 999 })).toEqual({ ok: false, error: 'noPiece' });
  });
});
