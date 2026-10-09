// 수가 정해진 것은 하루 끝 추첨 (질문 86 답, 0.1.0): 말, 여관 게시판 일꾼.
import { describe, expect, it } from 'vitest';
import { GROWTH } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { moneySupply } from '../economy/stats';
import { hasBuilding } from '../growth/buildings';
import { buyPrice, horseMorning, stableAt, stableTowns } from '../horses';
import { dayNotices } from '../notify';
import { activate, bigOrderQty } from '../events';
import { generateWorld } from '../worldgen';
import { resolveDraws } from './draws';

const SEED = 20261008;
const map = generateWorld(SEED);
const IDS = ['me', 'b1', 'b2'];

/** 셋이 마구간 마을에 모였다 (마구간에 말을 직접 넣는다) */
function atStable(stock = { pony: 0, draft: 1, swift: 0 }): { s: EconomyState; town: number } {
  const s = createEconomy(map, SEED, { players: IDS.map((id) => ({ id })) });
  horseMorning(s, map);
  const town = stableTowns(map)[0]!;
  stableAt(s, town)!.stock = { ...stock };
  for (const id of IDS) {
    s.players[id]!.town = town;
    s.players[id]!.gold = 1000;
  }
  return { s, town };
}

/** 셋이 여관과 일꾼이 넉넉한 마을에 모였다 */
function atInn(): { s: EconomyState; town: number } {
  const s = createEconomy(map, SEED, { warmupDays: 20, players: IDS.map((id) => ({ id })) });
  const town = map.towns
    .filter((t) => hasBuilding(s, map, t.id, 'inn') && t.tier === 'town')
    .map((t) => ({ id: t.id, n: s.workers.filter((w) => w.town === t.id).length }))
    .sort((a, b) => b.n - a.n)[0]!.id;
  for (const id of IDS) {
    s.players[id]!.town = town;
    s.players[id]!.gold = 1000;
  }
  return { s, town };
}

const ask = (s: EconomyState, id: string, kind: 'pony' | 'draft' | 'swift' = 'draft') => applyCommand(s, map, id, { type: 'buyHorse', kind });

describe('말 사기는 신청, 그날 밤 추첨', () => {
  it('신청하면 값을 맡기고 바로 받지 않는다. 거두면 그대로 돌려받는다', () => {
    const { s, town } = atStable();
    const price = buyPrice(stableAt(s, town)!, 'draft')!;
    const money = moneySupply(s);
    expect(ask(s, 'me').ok).toBe(true);
    expect(s.players.me!.horses).toEqual([]);
    expect(s.players.me!.gold).toBe(1000 - price);
    expect(moneySupply(s)).toBe(money);
    const v = playerView(s, map, 'me');
    expect(v.draws).toEqual([expect.objectContaining({ kind: 'horse', horse: 'draft', town, reserved: price })]);
    expect(v.reserved).toBe(price);
    // 남이 낸 신청은 보이지 않는다
    expect(playerView(s, map, 'b1').draws).toEqual([]);
    expect(applyCommand(s, map, 'me', { type: 'cancelDraw', drawId: v.draws[0]!.id }).ok).toBe(true);
    expect(s.players.me!.gold).toBe(1000);
    expect(s.draws).toEqual([]);
  });

  it('혼자 신청하면 다음 날 받는다 (장부와 알림)', () => {
    const { s, town } = atStable();
    expect(ask(s, 'me').ok).toBe(true);
    const day = s.day;
    advanceDay(s, map);
    expect(s.players.me!.horses).toEqual([expect.objectContaining({ kind: 'draft', home: town })]);
    expect(s.players.me!.ledger).toContainEqual(expect.objectContaining({ day, kind: 'horse', what: 'buy' }));
    expect(stableAt(s, town)!.stock.draft).toBe(0);
  });

  it('한 필을 셋이 신청하면 한 사람만 받고, 떨어진 사람은 돈이 그대로이고 알림을 받는다', () => {
    const { s, town } = atStable();
    const money = moneySupply(s);
    for (const id of IDS) expect(ask(s, id).ok).toBe(true);
    resolveDraws(s, map);
    const winners = IDS.filter((id) => s.players[id]!.horses.length === 1);
    expect(winners).toHaveLength(1);
    expect(stableAt(s, town)!.stock.draft).toBe(0);
    for (const id of IDS.filter((x) => x !== winners[0])) {
      const p = s.players[id]!;
      expect(p.gold).toBe(1000);
      expect(p.ledger).toEqual([expect.objectContaining({ kind: 'draw', what: 'horse', town, horse: 'draft' })]);
      expect(dayNotices(s, p, map, s.day, [], null)).toContainEqual(expect.objectContaining({ kind: 'people', text: expect.stringContaining('뽑히지 않았어요') }));
    }
    // 말값은 마을 금고로 갔다 (돈이 새지 않는다)
    expect(moneySupply(s)).toBe(money);
    expect(s.draws).toEqual([]);
  });

  it('누가 먼저 신청했든 결과가 같다', () => {
    const winner = (order: string[]) => {
      const { s } = atStable();
      for (const id of order) ask(s, id);
      resolveDraws(s, map);
      return IDS.find((id) => s.players[id]!.horses.length)!;
    };
    expect(winner(['me', 'b1', 'b2'])).toBe(winner(['b2', 'b1', 'me']));
    expect(winner(['b1', 'me', 'b2'])).toBe(winner(['b2', 'me', 'b1']));
  });

  it('날마다 다른 사람이 뽑힌다 (같은 날 낸 사람은 같은 기회)', () => {
    const wins: Record<string, number> = { me: 0, b1: 0, b2: 0 };
    for (let day = 1; day <= 90; day++) {
      const { s } = atStable();
      s.day = day;
      for (const id of IDS) ask(s, id);
      resolveDraws(s, map);
      wins[IDS.find((id) => s.players[id]!.horses.length)!]!++;
    }
    for (const id of IDS) expect(wins[id]).toBeGreaterThan(15);
  });

  it('남은 수만큼 준다', () => {
    const { s } = atStable({ pony: 0, draft: 2, swift: 0 });
    for (const id of IDS) ask(s, id);
    resolveDraws(s, map);
    expect(IDS.filter((id) => s.players[id]!.horses.length === 1)).toHaveLength(2);
  });

  it('가진 말과 신청한 말을 합쳐 두 필까지. 떠나면 신청을 거두고 돈을 돌려받는다', () => {
    const { s } = atStable({ pony: 3, draft: 0, swift: 0 });
    expect(ask(s, 'me', 'pony').ok).toBe(true);
    expect(ask(s, 'me', 'pony').ok).toBe(true);
    expect(ask(s, 'me', 'pony')).toEqual({ ok: false, error: 'tooManyHorses' });
    const to = map.towns.find((t) => t.id !== s.players.me!.town)!.id;
    expect(applyCommand(s, map, 'me', { type: 'travel', to }).ok).toBe(true);
    expect(s.draws).toEqual([]);
    // 여비만 나갔다
    const fee = s.players.me!.ledger.find((e) => e.kind === 'travel');
    expect(s.players.me!.gold).toBe(1000 - (fee?.kind === 'travel' ? fee.fee : 0));
  });

  it('그 사이 값이 내렸으면 뽑는 때 값만 받는다', () => {
    const { s, town } = atStable({ pony: 0, draft: 1, swift: 0 });
    const stable = stableAt(s, town)!;
    const high = buyPrice(stable, 'draft')!;
    expect(ask(s, 'me').ok).toBe(true);
    // 누군가 되팔아 남은 수가 늘었다
    stable.stock.draft = 3;
    const low = buyPrice(stable, 'draft')!;
    expect(low).toBeLessThan(high);
    resolveDraws(s, map);
    expect(s.players.me!.gold).toBe(1000 - low);
    expect(s.players.me!.horses[0]!.price).toBe(low);
  });
});

describe('게시판 일꾼도 하루 끝 추첨', () => {
  it('한 자리에 여럿이 신청하면 한 사람만 데려간다. 떨어진 사람은 맡긴 일당을 돌려받는다', () => {
    const { s, town } = atInn();
    const offer = playerView(s, map, 'me').hireBoard.find((o) => o.role === 'porter')!;
    for (const id of IDS) expect(applyCommand(s, map, id, { type: 'hire', role: 'porter' }).ok).toBe(true);
    expect(s.players.me!.gold).toBe(1000 - offer.wage * GROWTH.hire.advanceDays);
    // 같은 자리는 하루 한 번만 신청한다
    expect(applyCommand(s, map, 'me', { type: 'hire', role: 'porter' })).toEqual({ ok: false, error: 'alreadyRequested' });
    const workers = s.workers.length;
    resolveDraws(s, map);
    const winners = IDS.filter((id) => s.players[id]!.hires.length === 1);
    expect(winners).toHaveLength(1);
    expect(s.players[winners[0]!]!.hires[0]).toMatchObject({ role: 'porter', name: offer.name, town });
    expect(s.workers.length).toBe(workers - 1);
    for (const id of IDS.filter((x) => x !== winners[0])) {
      expect(s.players[id]!.gold).toBe(1000);
      expect(s.players[id]!.ledger).toEqual([expect.objectContaining({ kind: 'draw', what: 'hire', role: 'porter' })]);
    }
  });

  it('다른 자리(짐꾼, 마부)는 따로 뽑는다', () => {
    const { s } = atInn();
    applyCommand(s, map, 'me', { type: 'hire', role: 'porter' });
    applyCommand(s, map, 'b1', { type: 'hire', role: 'carter' });
    resolveDraws(s, map);
    expect(s.players.me!.hires.map((h) => h.role)).toEqual(['porter']);
    expect(s.players.b1!.hires.map((h) => h.role)).toEqual(['carter']);
  });
});

describe('세계의 숫자는 플레이어 수에 비례 (0.1.0)', () => {
  it('큰 주문 양: 한 사람이면 사건 표의 양, 사람이 늘면 비례해서 는다 (기본량 + 한 사람 몫 × 플레이어 수)', () => {
    expect(bigOrderQty(200, 1)).toBe(200);
    expect(bigOrderQty(200, 10)).toBe(1100);
    expect(bigOrderQty(200, 0)).toBe(200);
    const s = createEconomy(map, SEED, { players: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })) });
    const ev = activate(s, map, 'shipyard', 0, s.day + 5);
    expect(ev.orders).toEqual([expect.objectContaining({ good: 'wood', left: 1100 })]);
  });

  it('시즌 말 수는 플레이어 수에 비례한다', () => {
    const total = (n: number) => {
      const s = createEconomy(map, SEED, { players: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })) });
      horseMorning(s, map);
      return s.horses.arrivals.reduce((a, x) => a + x.count, 0) + s.horses.arrived.reduce((a, x) => a + x.count, 0);
    };
    // 입고 날 수는 그대로라 한 번에 풀리는 수가 는다 (사람이 많아도 시즌 안에 다 풀린다)
    const one = total(1);
    expect(total(5)).toBeGreaterThanOrEqual(one * 4);
    expect(total(50)).toBeGreaterThanOrEqual(one * 40);
  });
});
