import { describe, expect, it } from 'vitest';
import { generateWorld } from '../worldgen';
import { applyCommand } from './commands';
import { createEconomy } from './create';
import { advanceDay } from './day';
import { playerView } from './view';

const map = generateWorld(20261008);

describe('플레이어에게 보이는 것', () => {
  it('지금 있는 마을 시세만 정확히 보이고, 다른 마을은 본 적 있는 날짜의 기억뿐', () => {
    const s = createEconomy(map, 20261008);
    for (let d = 0; d < 5; d++) advanceDay(s, map);
    const v = playerView(s);
    expect(v.market?.town).toBe(0);
    expect(Object.keys(v.memory)).toEqual(['0']);
    // 화면에 넘기는 값 어디에도 다른 마을의 실제 상태가 없다
    const json = JSON.stringify(v);
    expect(json).not.toContain('treasury');
    expect(json).not.toContain('refPrice');
  });

  it('길 위에서는 시장이 안 보인다', () => {
    const s = createEconomy(map, 20261008);
    applyCommand(s, map, { type: 'travel', to: 1 });
    const v = playerView(s);
    expect(v.market).toBeNull();
    expect(v.location.kind).toBe('road');
  });

  it('맡긴 돈과 짐이 따로 보인다', () => {
    const s = createEconomy(map, 20261008);
    applyCommand(s, map, { type: 'placeBuyOrder', good: 'grain', qty: 4, maxPrice: 10 });
    const v = playerView(s);
    expect(v.reserved).toBe(40);
    expect(v.orders).toEqual([{ id: expect.any(Number), good: 'grain', side: 'buy', qty: 4, limit: 10 }]);
  });

  it('전에 본 시세를 기억해 오르내림을 보여 줄 수 있다', () => {
    const s = createEconomy(map, 20261008);
    advanceDay(s, map);
    expect(playerView(s).market?.previous).toBeNull();
    advanceDay(s, map);
    expect(playerView(s).market?.previous).not.toBeNull();
  });
});
