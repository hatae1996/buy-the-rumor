import { describe, expect, it } from 'vitest';
import { DAY_MS, Game } from './game';

const SEED = 20261008;

describe('실제 시간과 장날', () => {
  it('하루가 다 지나기 전에는 장날이 열리지 않는다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    expect(g.catchUp(DAY_MS - 1)).toBeNull();
    expect(g.view().day).toBe(1);
    expect(g.msUntilMarket(DAY_MS - 1000)).toBe(1000);
  });

  it('앱을 다시 열면 지나간 날만큼 돌리고, 남은 시간은 이어서 센다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    const s = g.catchUp(DAY_MS * 2 + 1000)!;
    expect(s.days).toBe(2);
    expect(s.fromDay).toBe(1);
    expect(s.toDay).toBe(3);
    expect(g.view().day).toBe(3);
    expect(g.msUntilMarket(DAY_MS * 2 + 1000)).toBe(DAY_MS - 1000);
  });

  it('아주 오래 비워도 한 번에 45일까지만 돌린다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    expect(g.catchUp(DAY_MS * 400)!.days).toBe(45);
    expect(g.view().day).toBe(46);
  }, 60000);

  it('여행 중 비운 사이 도착하면 알려 준다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    expect(g.dispatch({ type: 'travel', to: 2 }).ok).toBe(true);
    const s = g.catchUp(DAY_MS * 10)!;
    expect(s.arrivedAt).toBe(2);
  });

  it('도착 예상 시간이 되면 정말 도착해 있다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    // 식량이 떨어지면 길이 늦어진다 (0.1.2). 넉넉히 싣고 떠난다
    expect(g.dispatch({ type: 'buyRations', qty: 10 }).ok).toBe(true);
    expect(g.dispatch({ type: 'travel', to: 2 }).ok).toBe(true);
    const t = 1000;
    const loc = g.view().location;
    if (loc.kind !== 'road') throw new Error('길 위가 아니다');
    const ms = g.msUntilArrival(loc.daysLeft, t)!;
    expect(ms).toBe(DAY_MS - t + (loc.daysLeft - 1) * DAY_MS);
    g.catchUp(t + ms - 1);
    expect(g.view().location.kind).toBe('road');
    expect(g.catchUp(t + ms)!.arrivedAt).toBe(2);
  });

  it('견습 중에는 도착 시각을 실제 시간으로 셈하지 않는다', () => {
    const g = Game.fresh(0, SEED);
    expect(g.msUntilArrival(2, 0)).toBeNull();
  });

  it('명령이 성공하면 화면에 알린다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    let calls = 0;
    g.subscribe(() => calls++);
    g.dispatch({ type: 'placeBuyOrder', good: 'grain', qty: 1, maxPrice: 5 });
    g.dispatch({ type: 'placeBuyOrder', good: 'grain', qty: 0, maxPrice: 5 });
    expect(calls).toBe(1);
  });
});

describe('견습 마을은 시간이 멈춰 있다', () => {
  it('실제 시간이 지나도 날이 가지 않고, 하루 보내기로만 넘어간다', () => {
    const g = Game.fresh(0, SEED);
    expect(g.inApprentice).toBe(true);
    expect(g.catchUp(DAY_MS * 5)).toBeNull();
    expect(g.view().day).toBe(1);
    const s = g.passApprenticeDay(DAY_MS * 5)!;
    expect(s.toDay).toBe(2);
  });

  it('견습이 아니면 하루 보내기를 쓸 수 없다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    expect(g.passApprenticeDay(0)).toBeNull();
    expect(g.view().day).toBe(1);
  });
});

describe('봇 상인 (0.1.0)', () => {
  it('새 판에는 봇 상인 10명이 같은 시장에 앉고, 날이 가면 장사한다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    expect(g.view().rivals).toHaveLength(10);
    const where = () => g.view().rivals.map((r) => JSON.stringify(r.location));
    const before = where();
    g.catchUp(DAY_MS * 8);
    // 장사하는 봇은 마을을 옮겨 다닌다
    const after = where();
    expect(after.filter((x, i) => x !== before[i]).length).toBeGreaterThan(0);
  }, 60000);

  it('개발용으로 봇 수를 0~20명으로 정한다', () => {
    expect(Game.fresh(0, SEED, { apprentice: false, bots: 0 }).view().rivals).toHaveLength(0);
    expect(Game.fresh(0, SEED, { apprentice: false, bots: 99 }).view().rivals).toHaveLength(20);
  });
});

describe('시즌 끝과 다음 시즌 (0.1.0)', () => {
  it('시즌 마지막 장날에서 멈추고 결산을 보여 주며, 다음 시즌은 새 세계에서 증서만 들고 시작한다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false, bots: 2 });
    let t = 0;
    for (let i = 0; i < 10 && !g.seasonOver; i++) g.catchUp((t += DAY_MS * 45));
    expect(g.seasonOver).toBe(true);
    const v = g.view();
    expect(v.settlement?.season).toBe(1);
    expect(v.day).toBe(126);
    // 결산 뒤에는 날이 가지 않고 장사도 안 된다
    expect(g.catchUp(t + DAY_MS * 10)).toBeNull();
    expect(g.passDay(t)).toBeNull();
    expect(g.dispatch({ type: 'restAtInn' })).toEqual({ ok: false, error: 'seasonOver' });
    expect(g.dispatch({ type: 'setCompany', name: '시험 상단', crest: 'owl' }).ok).toBe(true);
    const cert = g.view().certificate;
    const next = g.startNextSeason(t)!;
    expect(next.seed).not.toBe(g.seed);
    expect(next.seasonOver).toBe(false);
    const nv = next.view();
    expect(nv.day).toBe(1);
    expect(nv.seasonInfo?.number).toBe(2);
    expect(nv.certificate).toEqual(cert);
    expect(nv.apprentice).toBeNull();
    expect(nv.rivals).toHaveLength(2);
  }, 120000);
});
