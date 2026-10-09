// 여관 고용 게시판 (기획서 "성장", 0.0.5): 일꾼은 마을 NPC에서, 일당은 일손 사정에 따라, 못 주면 떠난다.
import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { CART, GROWTH, HORSES } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { isGatherJob } from '../economy/jobs';
import { netWorth } from '../ranking';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { candidate, gathererYield, wageFor } from './index';

const SEED = 20261008;
const map = generateWorld(SEED);
let s: EconomyState;
const ok = (cmd: Parameters<typeof applyCommand>[3]) => expect(applyCommand(s, map, 'me', cmd)).toEqual(expect.objectContaining({ ok: true }));

/** 일꾼이 가장 많은 생산 마을 */
function busiestTown(st: EconomyState): number {
  return st.towns
    .filter((t) => t.tier === 'town')
    .map((t) => ({ id: t.id, n: st.workers.filter((w) => w.town === t.id).length }))
    .sort((a, b) => b.n - a.n)[0]!.id;
}

beforeEach(() => {
  s = createEconomy(map, SEED, { warmupDays: 20 });
  s.players.me!.town = busiestTown(s);
  s.players.me!.gold = 1000;
  s.players.me!.cart = createCart('handcart');
});

describe('고용 게시판', () => {
  it('마을 일꾼 중에서 데려오고, 데려간 만큼 마을 일꾼이 준다. 하루치 일당은 미리', () => {
    const board = playerView(s, map, 'me').hireBoard;
    expect(board.map((o) => o.role).sort()).toEqual(['carter', 'gatherer', 'porter']);
    const before = s.workers.filter((w) => w.town === s.players.me!.town).length;
    const offer = board.find((o) => o.role === 'gatherer')!;
    expect(isGatherJob(offer.job)).toBe(true);
    ok({ type: 'hire', role: 'gatherer' });
    expect(s.workers.filter((w) => w.town === s.players.me!.town).length).toBe(before - 1);
    expect(s.players.me!.gold).toBe(1000 - offer.wage * GROWTH.hire.advanceDays);
    expect(s.players.me!.hires[0]).toMatchObject({ role: 'gatherer', name: offer.name, job: offer.job, town: s.players.me!.town });
  });

  it('일손이 모자랄수록 일당이 오른다', () => {
    const w = candidate(s, s.players.me!.town, 'porter')!;
    const base = wageFor(s, s.players.me!.town, 'porter', w.job);
    // 그 일 하는 사람을 한 명만 남긴다
    const same = s.workers.filter((x) => x.town === s.players.me!.town && x.job === w.job);
    s.workers = s.workers.filter((x) => !same.slice(1).includes(x));
    expect(wageFor(s, s.players.me!.town, 'porter', w.job)).toBeGreaterThan(base);
    expect(wageFor(s, s.players.me!.town, 'porter', w.job)).toBeLessThanOrEqual(GROWTH.hire.porter.wage * GROWTH.hire.wageFactor[1]);
  });

  it('마을에 일꾼이 너무 적으면 게시판에 아무도 없다', () => {
    s.workers = s.workers.filter((w) => w.town !== s.players.me!.town).concat(s.workers.filter((w) => w.town === s.players.me!.town).slice(0, GROWTH.hire.minLeft));
    expect(playerView(s, map, 'me').hireBoard).toEqual([]);
    expect(applyCommand(s, map, 'me', { type: 'hire', role: 'porter' })).toEqual({ ok: false, error: 'noWorker' });
  });
});

describe('일당과 떠남', () => {
  it('밤마다 일당을 내고, 못 내면 떠나서 다시 그 마을 일꾼이 된다', () => {
    ok({ type: 'hire', role: 'porter' });
    const h = s.players.me!.hires[0]!;
    const gold = s.players.me!.gold;
    advanceDay(s, map);
    expect(s.players.me!.gold).toBeLessThanOrEqual(gold - h.wage);
    s.players.me!.gold = 0;
    advanceDay(s, map);
    expect(s.players.me!.hires).toEqual([]);
    expect(s.workers.some((w) => w.id === h.worker.id && w.town === h.town)).toBe(true);
    expect(s.players.me!.ledger.some((e) => e.kind === 'hire' && e.what === 'quit')).toBe(true);
  });
});

describe('채집꾼', () => {
  it('평균 결과로 매일 원정해 그 마을 창고에 넣는다. 창고가 없으면 버린다', () => {
    ok({ type: 'hire', role: 'gatherer' });
    advanceDay(s, map);
    const first = s.players.me!.ledger.filter((e) => e.kind === 'gathered');
    expect(first.length).toBeGreaterThan(0);
    for (const e of first) if (e.kind === 'gathered') expect(e.goods).toEqual([]);
    ok({ type: 'rentWarehouse' });
    for (let d = 0; d < 3; d++) advanceDay(s, map);
    const stored = s.players.me!.warehouses[0]!.board.pieces.reduce((a, p) => a + p.lots.reduce((b, l) => b + l.qty, 0), 0);
    expect(stored).toBeGreaterThan(0);
  });

  it('맡긴 일은 효율이 낮다: 마을 일꾼 하루 몫보다 적다', () => {
    ok({ type: 'hire', role: 'gatherer' });
    const h = s.players.me!.hires[0]!;
    let total = 0;
    for (let i = 0; i < 200; i++) total += gathererYield(JSON.parse(JSON.stringify(s)), h, createRng(i)).reduce((a, g) => a + g.qty, 0);
    expect(total / 200).toBeGreaterThan(0);
    expect(GROWTH.gathererShare).toBeLessThan(1);
  });
});

describe('짐꾼', () => {
  it('내 행렬에 손수레 하나: 짐을 옮겨 싣고, 순자산에 들고, 무거우면 떠날 수 없다', () => {
    ok({ type: 'hire', role: 'porter' });
    const id = s.players.me!.hires[0]!.id;
    loadGoods(s.players.me!.cart, 'salt', 6);
    const before = netWorth(s, s.players.me!);
    ok({ type: 'transferGoods', from: 'cart', to: `porter:${id}`, good: 'salt', qty: 4 });
    expect(cartCount(s.players.me!.cart, 'salt')).toBe(2);
    expect(netWorth(s, s.players.me!)).toBe(before);
    expect(applyCommand(s, map, 'me', { type: 'dismissHire', hireId: id })).toEqual({ ok: false, error: 'boardNotEmpty' });
    // 손수레를 사람이 끄는 무게보다 무겁게
    loadGoods(s.players.me!.hires[0]!.board!, 'ore', 30);
    const to = map.towns.find((t) => t.id !== s.players.me!.town)!.id;
    expect(playerView(s, map, 'me').hires[0]!.board!.weight).toBeGreaterThan(CART.types.handcart.humanPull);
    expect(applyCommand(s, map, 'me', { type: 'travel', to })).toEqual({ ok: false, error: 'overweight' });
  });

  it('원정에서 내 수레에 다 못 실은 짐은 짐꾼 수레에 싣는다', () => {
    ok({ type: 'hire', role: 'porter' });
    s.players.me!.cart = createCart('pack');
    loadGoods(s.players.me!.cart, 'salt', 27);
    s.players.me!.expedition = { town: s.players.me!.town, rng: 1, deck: [], card: 'log', left: 0, haul: [{ good: 'wood', qty: 2 }], rumors: [], log: [], flags: [], guide: false, markDays: {} };
    ok({ type: 'endExpedition' });
    expect(s.players.me!.lastExpedition!.leftBehind).toEqual([]);
    expect(cartCount(s.players.me!.hires[0]!.board!, 'wood')).toBe(2);
  });
});

describe('여관', () => {
  it('묵으면 말도 쉰다 (0.0.5 시안)', () => {
    s.players.me!.horses = [{ id: 1, kind: 'pony', fatigue: 6, hungry: 0, price: 90, home: 0 }];
    s.players.me!.fatigue = 0;
    ok({ type: 'restAtInn' });
    expect(s.players.me!.horses[0]!.fatigue).toBe(6 - HORSES.fatigue.rest.recovery);
  });

  it('정보원 일당은 게시판 값이다', () => {
    ok({ type: 'hireInformant' });
    const gold = s.players.me!.gold;
    advanceDay(s, map);
    expect(gold - s.players.me!.gold).toBeGreaterThanOrEqual(GROWTH.hire.informant.wage);
  });
});

describe('짐꾼 수레로 장사하기 (0.0.6)', () => {
  it('내 수레에 다 안 들어가는 사기 신청은 짐꾼 수레로 나눠 싣고, 장날 뒤 짐꾼 수레에 들어온다', () => {
    ok({ type: 'hire', role: 'porter' });
    const v0 = playerView(s, map, 'me');
    // 손수레(무게 70)에 소금(무게 2)은 35개까지. 짐꾼 수레가 있으면 더 살 수 있다
    expect(v0.buyRoom.salt).toBeGreaterThan(v0.cart.room.salt);
    const qty = Math.min(v0.buyRoom.salt, 45);
    const before = s.orders.length;
    ok({ type: 'placeBuyOrder', good: 'salt', qty, maxPrice: 20 });
    const mine = s.orders.slice(before);
    expect(mine.length).toBe(2);
    expect(mine.reduce((a, o) => a + o.qty, 0)).toBe(qty);
    expect(mine.some((o) => o.owner.kind === 'player' && o.owner.porter !== undefined)).toBe(true);
  });

  it('짐꾼 수레 짐도 장에 낼 수 있다 (내 수레 짐부터)', () => {
    ok({ type: 'hire', role: 'porter' });
    const h = s.players.me!.hires[0]!;
    loadGoods(s.players.me!.cart, 'salt', 5);
    loadGoods(h.board!, 'salt', 10);
    expect(playerView(s, map, 'me').haul.filter((l) => l.good === 'salt').reduce((a, l) => a + l.qty, 0)).toBe(15);
    const before = s.orders.length;
    ok({ type: 'placeSellOrder', good: 'salt', qty: 12, minPrice: 1 });
    const mine = s.orders.slice(before);
    expect(mine.map((o) => o.qty)).toEqual([5, 7]);
    expect(cartCount(s.players.me!.cart, 'salt')).toBe(0);
    expect(cartCount(h.board!, 'salt')).toBe(3);
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'salt', qty: 4, minPrice: 1 })).toEqual({ ok: false, error: 'notEnoughGoods' });
  });

  it('내 수레 몫은 끄는 무게까지만 잡고, 넘치는 몫이 짐꾼 수레로 간다 (무거워서 못 떠나는 일이 없게)', () => {
    ok({ type: 'hire', role: 'porter' });
    ok({ type: 'placeBuyOrder', good: 'ore', qty: 30, maxPrice: 20 });
    const main = s.orders.filter((o) => o.owner.kind === 'player' && o.owner.porter === undefined).reduce((a, o) => a + o.qty, 0);
    // 광석 무게 3: 손수레 70이면 23개까지
    expect(main * 3).toBeLessThanOrEqual(CART.types.handcart.humanPull);
  });
});
