// 경제 전체: 같은 시드면 같은 결과, 돈이 새거나 생기지 않음, 300일 넘게 돌려도 무너지거나 폭주하지 않음.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../worldgen';
import { measureBalance, type BalanceStats } from './balance';
import { advanceDay, type DayReport } from './day';
import { createEconomy } from './create';
import { GOODS, priceBounds } from './goods';
import { hungryWorkers, moneySupply, population } from './stats';
import type { EconomyState } from './state';
import { AUTUMN, CYCLE_DAYS, seasonOfDay, SPRING, SUMMER, WINTER } from '../season';

const SEEDS = [20261008, 777, 4242, 1, 99999];
const DAYS = 360;

function run(
  seed: number,
  days: number,
): { state: EconomyState; reports: DayReport[]; money: number[]; hungry: number[]; balance: BalanceStats } {
  const map = generateWorld(seed);
  const state = createEconomy(map, seed);
  const reports: DayReport[] = [];
  const money: number[] = [moneySupply(state)];
  const hungry: number[] = [];
  const balance = measureBalance(state, map, days, (s, report) => {
    reports.push(report);
    money.push(moneySupply(s));
    hungry.push(hungryWorkers(s) / Math.max(1, population(s)));
  });
  return { state, reports, money, hungry, balance };
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
        // 큰 주문(0.0.7)은 바깥 돈으로 산다
        const expected = money[i]! + r.stipend + r.outsideGold + r.arrivedGold - r.tribute - r.leftGold;
        expect(money[i + 1], `시드 ${seed}, ${r.day}일`).toBe(expected);
      });
    }
  });

  it('일꾼이 다 떠나거나 끝없이 늘지 않는다', () => {
    for (const { seed, state, reports } of runs) {
      const start = createEconomy(generateWorld(seed), seed).workers.length;
      expect(population(state), `시드 ${seed}`).toBeGreaterThanOrEqual(start * 0.4);
      expect(population(state), `시드 ${seed}`).toBeLessThanOrEqual(start * 2);
      // 생산 마을마다 일꾼이 남아 있다. 도시는 일꾼 대신 공방이 가공한다
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

  it('겨울에 일꾼이 20% 넘게 줄지 않는다 (겨울 일로 옮긴다, handoff 0.0.4)', () => {
    for (const { seed, balance } of runs) {
      expect(balance.winterDrops.length, `시드 ${seed}`).toBeGreaterThan(0);
      for (const drop of balance.winterDrops) expect(drop, `시드 ${seed}`).toBeLessThanOrEqual(0.2);
    }
  });

  // 광맥이 적은 맵(3칸 이하이거나 한 마을뿐)은 도구 재료가 모자라 20%를 넘기도 한다.
  // 맵 생성에서 광맥을 보장할지는 기획 질문 (docs/questions.md 26번). 답이 오기 전까지는 30%를 넘지 않는지만 본다
  // 0.0.7: 광맥이 적은 맵은 상단 말 수 같은 작은 차이에도 30% 근처를 오르내려서 45%로 둔다 (26번 "그대로": 도구가 귀한 맵 = 장사거리, questions.md 72번)
  // 0.0.9: 시즌이 125일로 짧아져 360일은 시즌 세 바퀴다. 세계는 시즌마다 새로 만들므로 목표(20%)는 한 시즌 안에서 잰다.
  // 광맥은 줄어들기만 해서 같은 세계를 세 시즌 돌리면 넉넉한 맵도 바닥난다 (시드 1: 230일쯤). 360일은 45% 이하만 본다
  it('도구 없이 일하는 일꾼은 한 시즌 동안 광맥이 넉넉한 맵에서 20% 이하, 광맥이 적은 맵도 45% 이하 (handoff 0.0.4)', () => {
    for (const { seed } of runs) {
      // 맵이 처음 줄 때의 광맥 (사건으로 새 광맥이 늘기 전)
      const start = createEconomy(generateWorld(seed), seed);
      const oreTowns = start.towns.filter((t) => t.nodes.some((n) => n.kind === 'ore'));
      const oreTiles = oreTowns.reduce((s, t) => s + t.nodes.find((n) => n.kind === 'ore')!.tiles, 0);
      const rich = oreTiles >= 4 && oreTowns.length >= 2;
      const season = measureBalance(start, generateWorld(seed), CYCLE_DAYS);
      expect(season.toollessShare, `시드 ${seed} (광맥 ${oreTiles}칸, ${oreTowns.length}마을)`).toBeLessThanOrEqual(rich ? 0.2 : 0.45);
    }
  });

  it('같은 세계를 360일 돌려도 도구 없이 일하는 일꾼은 45% 이하', () => {
    for (const { seed, balance } of runs) expect(balance.toollessShare, `시드 ${seed}`).toBeLessThanOrEqual(0.45);
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
    // 미리 돌린 날의 소식은 버리고, 1일째에 팔 0일 신문(날씨, 도시 시세)만 남는다 (0.1.7 답 119)
    expect(warm.news.every((n) => n.day === 0 && n.section !== undefined)).toBe(true);
    const supply = (s: EconomyState) => s.towns.reduce((a, t) => a + GOODS.reduce((b, g) => b + t.lastMarket[g].supply, 0), 0);
    expect(supply(cold)).toBe(0);
    expect(supply(warm)).toBeGreaterThan(0);
    expect(createEconomy(map, 20261008, { warmupDays: 20 })).toEqual(warm);
  });
});

describe('시작 계절 정하기 (0.0.8 시험용)', () => {
  const map = generateWorld(777);

  it('정한 계절에 플레이어가 온다 (미리 돌린 날이 있어도)', () => {
    for (const season of [SPRING, SUMMER, AUTUMN, WINTER]) {
      for (const warmupDays of [0, 20]) {
        const s = createEconomy(map, 777, { warmupDays, startSeason: season });
        expect(s.day).toBe(1);
        expect(seasonOfDay(s.day, s.startSeason)).toBe(season);
      }
    }
  });

  it('정하지 않으면 지금까지와 같은 세계 (시드로 랜덤), 정한 계절이 같으면 그 세계와 같다', () => {
    const natural = createEconomy(map, 777, { warmupDays: 20 });
    expect(createEconomy(map, 777, { warmupDays: 20, startSeason: natural.startSeason })).toEqual(natural);
  });

  it('계절 말고는 같은 시드의 시작 (시작 마을이 같다)', () => {
    const towns = [SPRING, SUMMER, AUTUMN, WINTER].map((season) => createEconomy(map, 777, { startSeason: season }).players.me!.town);
    expect(new Set(towns).size).toBe(1);
  });
});

describe('장의 깊이 (0.0.6 "벌이의 균형")', () => {
  // 도시는 물건이 모이는 큰 장이다: 한 장날에 30개를 내도 값이 무너지지 않고 시세의 0.8배 위로 절반 넘게 팔린다
  it('도시에 가죽 30개를 한꺼번에 내도 시세의 0.8배 위로 절반 넘게 팔린다', async () => {
    const { applyCommand } = await import('./commands');
    const { createCart, loadGoods } = await import('../cart');
    for (const seed of [20261008, 777]) {
      const map = generateWorld(seed);
      const s = createEconomy(map, seed, { warmupDays: 20 });
      for (let d = 0; d < 60; d++) advanceDay(s, map);
      const city = s.towns.find((t) => t.tier === 'city')!;
      const ref = city.refPrice.leather;
      s.players.me!.town = city.id;
      s.players.me!.cart = createCart('wagon');
      s.players.me!.horses = [{ id: 1, kind: 'draft', fatigue: 0, hungry: 0, price: 220, home: 0 }];
      loadGoods(s.players.me!.cart, 'leather', 30);
      expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'leather', qty: 30, minPrice: Math.round(ref * 0.8) }).ok).toBe(true);
      advanceDay(s, map);
      const sold = s.players.me!.ledger.filter((e) => e.kind === 'sell' && e.good === 'leather').reduce((a, e) => a + (e.kind === 'sell' ? e.qty : 0), 0);
      expect(sold, `시드 ${seed}`).toBeGreaterThanOrEqual(15);
    }
  });

  it('남는 마을에서도 주민이 싼 값에 사 주어 시세가 바닥(기준의 0.25배)에 오래 붙지 않는다: 가죽·생선은 절반 넘는 날이 바닥의 두 배 위', () => {
    for (const seed of [20261008, 4242]) {
      const map = generateWorld(seed);
      const s = createEconomy(map, seed, { warmupDays: 20 });
      let above = 0;
      let all = 0;
      for (let d = 0; d < 120; d++) {
        advanceDay(s, map);
        for (const t of s.towns) for (const g of ['leather', 'fish'] as const) {
          all++;
          if (t.refPrice[g] >= priceBounds(g).min * 2) above++;
        }
      }
      expect(above / all, `시드 ${seed}`).toBeGreaterThan(0.5);
    }
  });
});
