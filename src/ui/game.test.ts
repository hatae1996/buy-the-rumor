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
  });

  it('여행 중 비운 사이 도착하면 알려 준다', () => {
    const g = Game.fresh(0, SEED, { apprentice: false });
    expect(g.dispatch({ type: 'travel', to: 2 }).ok).toBe(true);
    const s = g.catchUp(DAY_MS * 10)!;
    expect(s.arrivedAt).toBe(2);
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
