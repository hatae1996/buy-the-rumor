// 마을이 늘어난 세계 (0.1.1 표준 세계): 마을마다 일꾼·금고가 생기고, 세계에 몇 개로 정한 것은 마을 수에 비례한다.
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { createSeason, eventDef } from '../events';
import { CYCLE_DAYS } from '../season';
import { generateWorld, townScale, townsForPlayers } from '../worldgen';
import { measureBalance } from './balance';
import { createEconomy } from './create';
import { moneySupply, population } from './stats';

const SEED = 20261008;

describe.each([6, 8, 12])('마을 %i곳 세계', (towns) => {
  const map = generateWorld(SEED, { towns });
  const state = createEconomy(map, SEED);

  it('마을마다 장과 금고가 있고, 생산 마을마다 일꾼이 산다', () => {
    expect(state.towns).toHaveLength(towns);
    for (const t of map.towns) {
      expect(state.towns[t.id]!.treasury).toBeGreaterThan(0);
      if (t.tier === 'town') expect(population(state, t.id), t.name).toBeGreaterThan(0);
    }
  });

  it('도시는 맡는 생산 마을 수만큼 커진다 (주민 수요와 금고, 마을 4곳 맵이면 그대로)', () => {
    const cities = map.towns.filter((t) => t.tier === 'city').length;
    const scale = (towns - cities) / cities / 3;
    for (const t of state.towns.filter((x) => x.tier === 'city')) {
      expect(t.scale ?? 1).toBeCloseTo(scale);
      expect(t.treasury).toBe(Math.round(ECONOMY.citizens.startTreasury * ECONOMY.city.treasuryFactor * scale));
    }
    expect(createEconomy(generateWorld(SEED), SEED).towns.every((t) => t.scale === undefined)).toBe(true);
  });

  it('NPC 상단은 마을 4곳에 5상단 비율, 이름이 겹치지 않는다', () => {
    expect(state.traders).toHaveLength(Math.round(ECONOMY.traders.count * townScale(towns)));
    expect(new Set(state.traders.map((t) => t.name)).size).toBe(state.traders.length);
  });

  it('시즌 큰 사건 수도 마을 수에 비례한다', () => {
    const scale = townScale(towns);
    for (const n of [1, 2, 3]) {
      const season = createSeason(state, map, n, 1 + (n - 1) * CYCLE_DAYS);
      expect(season.schedule.length).toBeGreaterThanOrEqual(Math.round(ECONOMY.events.perSeason[0] * scale) - 2);
      expect(season.schedule.length).toBeLessThanOrEqual(Math.round(ECONOMY.events.perSeason[1] * scale));
      // 도시가 여럿이어도 도시 사건이 일정을 덮지 않는다
      const city = season.schedule.filter((e) => eventDef(e.event).needs?.tier === 'city').length;
      expect(city).toBeLessThanOrEqual(season.schedule.length / 2);
    }
  });

  it('한 시즌 돌려도 돈이 새지 않고 일꾼이 다 떠나지 않는다', () => {
    const s = createEconomy(map, SEED);
    const start = population(s);
    let money = moneySupply(s);
    measureBalance(s, map, CYCLE_DAYS, (after, r) => {
      const next = moneySupply(after);
      expect(next, `${r.day}일`).toBe(money + r.stipend + r.outsideGold + r.arrivedGold - r.tribute - r.leftGold);
      money = next;
    });
    expect(population(s)).toBeGreaterThan(start * 0.7);
  }, 60_000);
});

it('표준 세계: 20명이면 마을 8곳, 로컬 게임(나 + 봇 10명)이면 6곳', () => {
  expect(townsForPlayers(20)).toBe(8);
  expect(townsForPlayers(1 + ECONOMY.player.localBots)).toBe(6);
});
