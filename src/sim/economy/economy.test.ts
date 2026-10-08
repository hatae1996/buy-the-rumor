// 경제 전체: 같은 시드면 같은 결과, 돈이 새거나 생기지 않음, 300일 넘게 돌려도 무너지거나 폭주하지 않음.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../worldgen';
import { advanceDay, type DayReport } from './day';
import { createEconomy } from './create';
import { GOODS, priceBounds } from './goods';
import { hungryWorkers, moneySupply, population } from './stats';
import type { EconomyState } from './state';

const SEEDS = [20261008, 777, 4242, 1, 99999];
const DAYS = 360;

function run(seed: number, days: number): { state: EconomyState; reports: DayReport[]; money: number[]; hungry: number[] } {
  const map = generateWorld(seed);
  const state = createEconomy(map, seed);
  const reports: DayReport[] = [];
  const money: number[] = [moneySupply(state)];
  const hungry: number[] = [];
  for (let d = 0; d < days; d++) {
    reports.push(advanceDay(state, map));
    money.push(moneySupply(state));
    hungry.push(hungryWorkers(state) / Math.max(1, population(state)));
  }
  return { state, reports, money, hungry };
}

describe('같은 시드면 같은 경제', () => {
  it('100일 뒤 상태가 똑같다', () => {
    expect(run(20261008, 100).state).toEqual(run(20261008, 100).state);
  });

  it('중간에 JSON으로 저장했다 불러와 이어 돌려도 똑같다 (앱을 껐다 켜도 같은 세계)', () => {
    const seed = 777;
    const map = generateWorld(seed);
    const a = createEconomy(map, seed);
    for (let d = 0; d < 80; d++) advanceDay(a, map);
    const b: EconomyState = JSON.parse(JSON.stringify(a));
    for (let d = 0; d < 40; d++) {
      advanceDay(a, map);
      advanceDay(b, map);
    }
    expect(b).toEqual(a);
  });
});

describe(`${DAYS}일 안정성 (시드 ${SEEDS.length}개)`, () => {
  const runs = SEEDS.map((seed) => ({ seed, ...run(seed, DAYS) }));

  it('돈은 정해진 곳으로만 들어오고 나간다 (장날 정산에서 새거나 생기지 않음)', () => {
    for (const { seed, reports, money } of runs) {
      reports.forEach((r, i) => {
        const expected = money[i]! + r.stipend + r.arrivedGold - r.tribute - r.leftGold;
        expect(money[i + 1], `시드 ${seed}, ${r.day}일`).toBe(expected);
      });
    }
  });

  it('일꾼이 다 떠나거나 끝없이 늘지 않는다', () => {
    for (const { seed, state, reports } of runs) {
      const start = createEconomy(generateWorld(seed), seed).workers.length;
      expect(population(state), `시드 ${seed}`).toBeGreaterThanOrEqual(start * 0.4);
      expect(population(state), `시드 ${seed}`).toBeLessThanOrEqual(start * 2);
      // 생산 마을마다 일꾼이 남아 있다 (도시는 일꾼 없이 주민 수요만 있다)
      for (const t of state.towns.filter((t) => t.tier === 'town')) {
        expect(population(state, t.id), `시드 ${seed}, 마을 ${t.id}`).toBeGreaterThan(0);
      }
      for (const t of state.towns.filter((t) => t.tier === 'city')) expect(population(state, t.id)).toBe(0);
      expect(reports.length).toBe(DAYS);
    }
  });

  it('통화량이 폭주하거나 말라붙지 않는다', () => {
    for (const { seed, money } of runs) {
      const settled = money[30]!;
      for (const m of money.slice(30)) {
        expect(m, `시드 ${seed}`).toBeGreaterThan(settled * 0.5);
        expect(m, `시드 ${seed}`).toBeLessThan(settled * 2);
      }
    }
  });

  it('굶는 일꾼은 대체로 적다 (겨울 끝 무렵 잠깐 늘어도 평균은 낮다)', () => {
    for (const { seed, hungry } of runs) {
      const avg = hungry.reduce((a, b) => a + b, 0) / hungry.length;
      expect(avg, `시드 ${seed}`).toBeLessThan(0.15);
    }
  });

  it('장이 계속 선다: 마을마다 한 달에 거래가 있다', () => {
    for (const { seed, reports } of runs) {
      for (let from = 0; from < DAYS; from += 30) {
        const month = reports.slice(from, from + 30);
        month[0]!.markets.forEach((_, town) => {
          const volume = month.reduce((s, r) => s + GOODS.reduce((a, g) => a + r.markets[town]![g].volume, 0), 0);
          expect(volume, `시드 ${seed}, 마을 ${town}, ${from}일부터`).toBeGreaterThan(0);
        });
      }
    }
  });

  it('시세는 늘 정해진 범위 안의 숫자다', () => {
    for (const { state } of runs) {
      for (const t of state.towns) {
        for (const g of GOODS) {
          const { min, max } = priceBounds(g);
          expect(Number.isFinite(t.refPrice[g])).toBe(true);
          expect(t.refPrice[g]).toBeGreaterThanOrEqual(min);
          expect(t.refPrice[g]).toBeLessThanOrEqual(max);
        }
      }
    }
  });
});

describe('미리 돌린 세계', () => {
  it('첫날부터 장에 물건이 돈다', () => {
    const map = generateWorld(20261008);
    const cold = createEconomy(map, 20261008);
    const warm = createEconomy(map, 20261008, { warmupDays: 20 });
    expect(warm.day).toBe(1);
    expect(warm.news).toEqual([]);
    const supply = (s: EconomyState) => s.towns.reduce((a, t) => a + GOODS.reduce((b, g) => b + t.lastMarket[g].supply, 0), 0);
    expect(supply(cold)).toBe(0);
    expect(supply(warm)).toBeGreaterThan(0);
    expect(createEconomy(map, 20261008, { warmupDays: 20 })).toEqual(warm);
  });
});
