// 한 세계의 여러 플레이어 (0.1.0): 신청과 짐이 섞이지 않고, 같은 장날엔 같은 값, 돈이 새지 않고, 같은 시드면 같은 결과.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../worldgen';
import { createRng, mixSeed } from '../rng';
import { botProfile } from '../bot/profiles';
import { botStep, createMind } from '../bot/bot';
import { cartCount, createCart, loadGoods } from '../cart';
import { applyCommand } from './commands';
import { createEconomy } from './create';
import { advanceDay } from './day';
import { playerList, playerOrder } from './players';
import type { EconomyState } from './state';
import { moneySupply } from './stats';
import { playerView } from './view';

const seed = 20261008;
const map = generateWorld(seed);
const three = () => createEconomy(map, seed, { players: [{ id: 'me' }, { id: 'b1' }, { id: 'b2' }] });

/** 셋을 같은 마을에 모은다 */
function together(s: EconomyState, town = 0): void {
  for (const p of playerList(s)) {
    p.town = town;
    p.cart = createCart('handcart');
  }
}

describe('여러 플레이어 세계', () => {
  it('플레이어마다 따로 시작한다 (들어온 차례, 시작 마을)', () => {
    const s = three();
    expect(playerList(s).map((p) => [p.id, p.seq])).toEqual([
      ['me', 0],
      ['b1', 1],
      ['b2', 2],
    ]);
    for (const p of playerList(s)) {
      expect(p.town).toBeGreaterThanOrEqual(0);
      expect(p.town).toBeLessThan(map.towns.length);
      expect(p.visited).toEqual([p.town]);
      expect(p.record).not.toBeNull();
    }
    expect(() => createEconomy(map, seed, { players: [{ id: 'a' }, { id: 'a' }] })).toThrow();
  });

  it('플레이어를 따로 적지 않으면 로컬 플레이어 한 사람 세계다', () => {
    expect(createEconomy(map, seed)).toEqual(createEconomy(map, seed, { players: [{ id: 'me' }] }));
  });

  it('플레이어가 늘어도 미리 돌린 세계(마을, 일꾼)와 첫 플레이어는 같다', () => {
    // 시즌이 열린 뒤에는 말 수와 큰 주문 양이 플레이어 수에 비례해 달라진다 (draws.test.ts)
    const one = createEconomy(map, seed, { warmupDays: 30 });
    const many = createEconomy(map, seed, { warmupDays: 30, players: [{ id: 'me' }, { id: 'b1' }, { id: 'b2' }] });
    expect(many.towns).toEqual(one.towns);
    expect(many.workers).toEqual(one.workers);
    expect(many.rng).toBe(one.rng);
    // 수첩 번호는 세계에 하나인 번호표라 다를 수 있다. 내용은 같다
    const { rumors: a, ...meMany } = many.players.me!;
    const { rumors: b, ...meOne } = one.players.me!;
    expect(meMany).toEqual(meOne);
    expect(a.map((h) => h.text)).toEqual(b.map((h) => h.text));
  });

  it('밤 차례는 날마다 시드로 섞고, 세계의 난수를 쓰지 않는다', () => {
    const s = three();
    const rng = s.rng;
    const orders = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      s.day = d;
      const a = playerOrder(s).map((p) => p.id).join();
      expect(playerOrder(s).map((p) => p.id).join()).toBe(a);
      orders.add(a);
    }
    expect(orders.size).toBeGreaterThan(1);
    expect(s.rng).toBe(rng);
  });
});

describe('신청과 짐은 주인 것만', () => {
  it('남의 신청은 지울 수 없고, 내 화면에는 내 신청만 보인다', () => {
    const s = three();
    together(s);
    loadGoods(s.players.b1!.cart, 'ore', 5);
    const r = applyCommand(s, map, 'b1', { type: 'placeSellOrder', good: 'ore', qty: 5, minPrice: 3 });
    expect(r.ok).toBe(true);
    const id = r.ok ? r.orderId! : -1;
    expect(applyCommand(s, map, 'me', { type: 'cancelOrder', orderId: id })).toEqual({ ok: false, error: 'noOrder' });
    expect(playerView(s, map, 'me').orders).toEqual([]);
    expect(playerView(s, map, 'b1').orders.map((o) => o.id)).toEqual([id]);
    expect(s.orders[0]!.owner).toEqual({ kind: 'player', pid: 'b1' });
  });

  it('떠나면 내 수레 짐 신청만 거둔다 (남의 신청은 남는다)', () => {
    const s = three();
    together(s);
    loadGoods(s.players.me!.cart, 'ore', 4);
    loadGoods(s.players.b1!.cart, 'ore', 4);
    applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'ore', qty: 4, minPrice: 3 });
    applyCommand(s, map, 'b1', { type: 'placeSellOrder', good: 'ore', qty: 4, minPrice: 3 });
    const to = map.towns.find((t) => t.id !== 0)!.id;
    expect(applyCommand(s, map, 'me', { type: 'travel', to }).ok).toBe(true);
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(4);
    expect(s.orders).toHaveLength(1);
    expect(s.orders[0]!.owner).toEqual({ kind: 'player', pid: 'b1' });
  });

  it('장날에 판 돈과 산 짐은 신청 주인에게 간다', () => {
    const s = three();
    together(s);
    loadGoods(s.players.b2!.cart, 'ore', 6);
    const gold = playerList(s).map((p) => p.gold);
    applyCommand(s, map, 'b2', { type: 'placeSellOrder', good: 'ore', qty: 6, minPrice: 1 });
    advanceDay(s, map);
    const sold = s.players.b2!.ledger.filter((e) => e.kind === 'sell');
    expect(sold.length).toBeGreaterThan(0);
    const got = sold.reduce((a, e) => a + (e.kind === 'sell' ? e.qty * e.price : 0), 0);
    expect(s.players.b2!.gold).toBe(gold[2]! + got);
    expect(s.players.me!.ledger.filter((e) => e.kind === 'sell')).toEqual([]);
    expect(s.players.me!.gold).toBe(gold[0]);
    expect(s.players.b1!.gold).toBe(gold[1]);
  });
});

describe('같은 장날은 누구에게나 같은 값', () => {
  it('두 사람이 같은 물건을 같은 한도로 팔면 같은 값을 받고 양을 고르게 나눈다', () => {
    const s = three();
    together(s);
    for (const id of ['me', 'b1']) {
      loadGoods(s.players[id]!.cart, 'ore', 12);
      expect(applyCommand(s, map, id, { type: 'placeSellOrder', good: 'ore', qty: 12, minPrice: 1 }).ok).toBe(true);
    }
    advanceDay(s, map);
    const fill = (id: string) => s.players[id]!.ledger.filter((e) => e.kind === 'sell');
    const [a, b] = [fill('me'), fill('b1')];
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    const [x, y] = [a[0]!, b[0]!];
    if (x.kind !== 'sell' || y.kind !== 'sell') throw new Error();
    expect(x.price).toBe(y.price);
    expect(Math.abs(x.qty - y.qty)).toBeLessThanOrEqual(1);
  });

  it('플레이어끼리 사고팔아도 돈이 새거나 생기지 않는다', () => {
    const s = three();
    together(s);
    loadGoods(s.players.me!.cart, 'ore', 8);
    const high = Math.round(s.towns[0]!.refPrice.ore * 2);
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'ore', qty: 8, minPrice: 1 }).ok).toBe(true);
    expect(applyCommand(s, map, 'b1', { type: 'placeBuyOrder', good: 'ore', qty: 5, maxPrice: high }).ok).toBe(true);
    expect(applyCommand(s, map, 'b2', { type: 'placeBuyOrder', good: 'ore', qty: 3, maxPrice: high }).ok).toBe(true);
    for (let d = 0; d < 3; d++) {
      const before = moneySupply(s);
      const r = advanceDay(s, map);
      expect(moneySupply(s)).toBe(before + r.stipend + r.outsideGold + r.arrivedGold - r.tribute - r.leftGold);
    }
    expect(s.players.b1!.ledger.some((e) => e.kind === 'buy')).toBe(true);
  });
});

describe('같은 시드, 같은 명령이면 같은 결과', () => {
  /** 봇 셋이 한 세계에서 n일 (서버가 그대로 돌릴 수 있는지) */
  function play(days: number, saveAt?: number): EconomyState {
    let s = createEconomy(map, seed, { warmupDays: 10, players: [{ id: 'me' }, { id: 'b1' }, { id: 'b2' }] });
    const profiles = [botProfile('casual'), botProfile('trader'), botProfile('gatherer')];
    const minds = profiles.map(() => createMind());
    const rngs = profiles.map((_, i) => createRng(mixSeed(seed, 0xb07, i)));
    for (const p of playerList(s)) p.cart = createCart('handcart');
    for (let d = 0; d < days; d++) {
      if (d === saveAt) s = JSON.parse(JSON.stringify(s)) as EconomyState;
      playerList(s).forEach((p, i) => {
        for (let k = 0; k < 20; k++) {
          const cmd = botStep(playerView(s, map, p.id), map, profiles[i]!, minds[i]!, rngs[i]!);
          if (!cmd) break;
          applyCommand(s, map, p.id, cmd);
        }
      });
      advanceDay(s, map);
    }
    return s;
  }

  it('봇 셋이 30일을 두 번 돌리면 똑같고, 중간에 저장했다 불러와도 똑같다', () => {
    const a = play(30);
    expect(play(30)).toEqual(a);
    expect(play(30, 12)).toEqual(a);
    // 셋 다 무언가를 했다
    for (const p of playerList(a)) expect(p.ledger.length).toBeGreaterThan(0);
  }, 60000);
});
