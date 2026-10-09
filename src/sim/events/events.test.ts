// 사건: 일정 규칙(기획서 "사건"), 효과, 반응 사건, 시즌 넘김.
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { advanceDay, applyCommand, createEconomy, moneySupply, type EconomyState } from '../economy';
import { CYCLE_DAYS, seasonOfDay, SPRING, WINTER, type Season } from '../season';
import { buildNeighbors, generateWorld, townTravelDays, type WorldMap } from '../worldgen';
import {
  activate,
  giveOutBigOrders,
  badGoods,
  bigOrdersToday,
  bannedGoods,
  blockedTiles,
  createSeason,
  demandModifier,
  eligibleTowns,
  eventDef,
  produceFactor,
  reactiveEvents,
  salesTax,
  tollAt,
} from './index';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);
const E = ECONOMY.events;

function world(seed: number): { map: WorldMap; state: EconomyState } {
  const map = generateWorld(seed);
  return { map, state: createEconomy(map, seed) };
}

describe('사건 일정 (시드 40개 × 시즌 3개)', () => {
  const seasons = SEEDS.flatMap((seed) => {
    const { map, state } = world(seed);
    return [1, 2, 3].map((n) => ({ seed, map, state, season: createSeason(state, map, n, 1 + (n - 1) * CYCLE_DAYS) }));
  });

  it('시즌에 6~10개, 하루에 최대 1개', () => {
    for (const { seed, season } of seasons) {
      expect(season.schedule.length, `시드 ${seed}`).toBeGreaterThanOrEqual(E.perSeason[0]);
      expect(season.schedule.length).toBeLessThanOrEqual(E.perSeason[1]);
      expect(new Set(season.schedule.map((s) => s.day)).size).toBe(season.schedule.length);
    }
  });

  it('시즌 첫날과 마지막 2일에는 큰 사건이 없다', () => {
    for (const { season } of seasons) {
      const last = season.startDay + season.length - 1;
      for (const s of season.schedule) {
        expect(s.day).toBeGreaterThanOrEqual(season.startDay + E.quietFirstDays);
        expect(s.day).toBeLessThanOrEqual(last - E.quietLastDays);
      }
    }
  });

  it('같은 물품에 악재가 연달아 두 번 오지 않는다', () => {
    for (const { seed, season } of seasons) {
      const bad = season.schedule.map((s) => badGoods(eventDef(s.event))).filter((g) => g.length > 0);
      for (let i = 1; i < bad.length; i++) {
        expect(bad[i]!.some((g) => bad[i - 1]!.includes(g)), `시드 ${seed}`).toBe(false);
      }
    }
  });

  it('계절, 자원지, 특색, 규모 조건에 맞는 마을에서만 일어난다', () => {
    for (const { map, state, season } of seasons) {
      const nbs = buildNeighbors(map.tiles);
      for (const s of season.schedule) {
        expect(eligibleTowns(eventDef(s.event), state, map, nbs, s.day)).toContain(s.town);
        const def = eventDef(s.event);
        if (def.seasons) expect(def.seasons).toContain(seasonOfDay(s.day, state.startSeason));
      }
    }
  });

  it('징조는 사건 1~3일 전, 절반쯤의 사건에만 돈다. 큰 주문 사건은 늘 4~7일 전에 돈다 (0.0.7)', () => {
    let withOmen = 0;
    let total = 0;
    for (const { season } of seasons) {
      for (const s of season.schedule) {
        const def = eventDef(s.event);
        const lead = def.omenLead ?? E.omenLead;
        // 시즌 첫날보다 앞설 수는 없다
        const early = s.omenDay !== null && s.omenDay === season.startDay;
        if (def.omenShare === 1) {
          expect(s.omenDay, s.event).not.toBeNull();
          if (!early) expect(s.day - s.omenDay!).toBeGreaterThanOrEqual(lead[0]);
          expect(s.day - s.omenDay!).toBeLessThanOrEqual(lead[1]);
          continue;
        }
        total++;
        if (s.omenDay === null) continue;
        withOmen++;
        expect(def.omen).not.toBeNull();
        expect(s.day - s.omenDay).toBeGreaterThanOrEqual(early ? 0 : 1);
        expect(s.day - s.omenDay).toBeLessThanOrEqual(lead[1]);
      }
    }
    expect(withOmen / total).toBeGreaterThan(0.25);
    expect(withOmen / total).toBeLessThan(0.6);
  });

  it('같은 시드, 같은 시즌 번호면 같은 일정. 시즌이 바뀌면 다른 일정', () => {
    const { map, state } = world(777);
    expect(createSeason(state, map, 2, 145)).toEqual(createSeason(state, map, 2, 145));
    expect(createSeason(state, map, 3, 289).schedule).not.toEqual(createSeason(state, map, 2, 145).schedule);
  });
});

describe('사건 효과 (가격은 직접 바꾸지 않고 시뮬 숫자만)', () => {
  const town = (state: EconomyState, kind: 'fish' | 'forest' | 'ore') =>
    state.towns.find((t) => t.tier === 'town' && t.nodes.some((n) => n.kind === kind))!.id;

  it('폭풍: 그 마을 생선 생산 0, 목재 수요가 는다. 끝나면 돌아온다', () => {
    const { map, state } = world(20261008);
    const id = town(state, 'fish');
    const before = demandModifier(state, id, 'wood');
    activate(state, map, 'storm', id, state.day + 1);
    expect(produceFactor(state, id, 'fish')).toBe(0);
    expect(demandModifier(state, id, 'wood').extra).toBeGreaterThan(before.extra);
    // 다른 마을은 그대로
    const other = state.towns.find((t) => t.id !== id)!.id;
    expect(produceFactor(state, other, 'fish')).toBe(1);
    advanceDay(state, map);
    advanceDay(state, map);
    expect(produceFactor(state, id, 'fish')).toBe(1);
  });

  it('폭풍인 날 그 마을 어부는 고기를 못 잡는다 (가진 생선이 늘지 않는다)', () => {
    const { map, state } = world(20261008);
    const id = town(state, 'fish');
    activate(state, map, 'storm', id, state.day + 5);
    const fishers = state.workers.filter((w) => w.town === id && w.job === 'fisher');
    expect(fishers.length).toBeGreaterThan(0);
    const fish = () => fishers.reduce((s, w) => s + w.inv.filter((l) => l.good === 'fish').reduce((a, l) => a + l.qty, 0), 0);
    const before = fish();
    advanceDay(state, map);
    expect(fish()).toBeLessThanOrEqual(before);
  });

  it('짐승 병: 그 마을 장에서 고기를 팔 수 없다 (맡긴 고기는 돌려받는다)', () => {
    const { map, state } = world(20261008);
    const id = town(state, 'forest');
    activate(state, map, 'animalSickness', id, state.day + 1);
    expect(bannedGoods(state, id).has('meat')).toBe(true);
    const report = advanceDay(state, map);
    expect(report.markets[id]!.meat.volume).toBe(0);
  });

  it('세금 인상: 판 값의 일부가 금고로 가고, 돈은 새지 않는다', () => {
    const { map, state } = world(4242);
    for (let i = 0; i < 10; i++) advanceDay(state, map);
    for (const t of state.towns) activate(state, map, 'taxHike', t.id, state.day + 3);
    expect(salesTax(state, 0)).toBeCloseTo(0.1);
    const before = moneySupply(state);
    const r = advanceDay(state, map);
    expect(moneySupply(state)).toBe(before + r.stipend + r.arrivedGold - r.tribute - r.leftGold);
  });

  it('산적: 그 마을로 가는 여비에 통행세가 붙는다 (경제에서 빠져나간다)', () => {
    const { map, state } = world(20261008);
    const here = state.players.me!.town;
    const to = state.towns.find((t) => t.id !== here)!.id;
    activate(state, map, 'bandits', to, state.day + 3);
    expect(tollAt(state, to)).toBe(10);
    const gold = state.players.me!.gold;
    expect(applyCommand(state, map, 'me', { type: 'travel', to }).ok).toBe(true);
    const travel = state.players.me!.ledger.find((e) => e.kind === 'travel')!;
    expect(travel.kind === 'travel' && gold - state.players.me!.gold).toBe(travel.kind === 'travel' ? travel.fee + 10 : 0);
    expect(state.players.me!.ledger.some((e) => e.kind === 'toll' && e.gold === 10)).toBe(true);
  });

  it('다리 붕괴·산사태: 길 칸이 막히고 이동 일수는 같거나 늘어난다', () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 15)) {
      const { map, state } = world(seed);
      const season = createSeason(state, map, 1, 1);
      for (const s of season.schedule.filter((x) => x.tiles?.length)) {
        const st = createEconomy(map, seed);
        activate(st, map, s.event, s.town, st.day + 1, { tiles: s.tiles });
        const blocked = blockedTiles(st);
        for (const t of s.tiles!) expect(map.tiles[t]!.road).toBe(true);
        const normal = townTravelDays(map, 2);
        const now = townTravelDays(map, 2, blocked);
        normal.forEach((row, a) => row.forEach((d, b) => expect(now[a]![b]!).toBeGreaterThanOrEqual(d)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('대상단: 그 마을 장에서 그 물품을 한꺼번에 사들인다 (금고로)', () => {
    const { map, state } = world(99999);
    for (let i = 0; i < 10; i++) advanceDay(state, map);
    const id = 0;
    activate(state, map, 'grandCaravan', id, state.day, { good: 'grain' });
    const usual = state.towns[id]!.lastMarket.grain.demand;
    const r = advanceDay(state, map);
    expect(r.markets[id]!.grain.demand).toBeGreaterThanOrEqual(usual + 25);
  });

  it('새 광맥: 그 마을 광맥이 한 칸 커진다', () => {
    const { map, state } = world(20261008);
    const id = town(state, 'ore');
    const node = state.towns[id]!.nodes.find((n) => n.kind === 'ore')!;
    const tiles = node.tiles;
    activate(state, map, 'newVein', id, state.day + 10);
    expect(node.tiles).toBe(tiles + 1);
    expect(state.towns[id]!.recentEvents.some((e) => e.kind === 'newVein')).toBe(true);
  });
});

describe('큰 주문 (0.0.7 "큰 벌이는 사건에서")', () => {
  it('사건 기간 동안 한 물품을 기준 가격보다 비싸게 사들이고, 주문량이 다 차면 사건이 끝난다', async () => {
    const { createCart, loadGoods } = await import('../cart');
    const { basePrice } = await import('../economy/goods');
    const seed = SEEDS[0]!;
    const { map, state } = world(seed);
    for (let d = 0; d < 10; d++) advanceDay(state, map);
    const town = state.players.me!.town;
    const ev = activate(state, map, 'shipyard', town, state.day + 7);
    expect(ev.orders).toEqual([{ good: 'wood', left: 200, price: Math.round(basePrice('wood') * 1.6) }]);
    // 다른 큰 주문이 일정대로 함께 열려 있을 수 있어 이 사건 것만 본다
    expect(bigOrdersToday(state).filter((x) => x.event === ev).map((x) => x.order.good)).toEqual(['wood']);
    // 플레이어가 목재를 내면 큰 주문 값에 가깝게 팔린다
    state.players.me!.cart = createCart('wagon');
    state.players.me!.horses = [{ id: 1, kind: 'draft', fatigue: 0, hungry: 0, price: 220, home: 0 }];
    const n = loadGoods(state.players.me!.cart, 'wood', 20);
    expect(applyCommand(state, map, 'me', { type: 'placeSellOrder', good: 'wood', qty: n, minPrice: basePrice('wood') })).toEqual(expect.objectContaining({ ok: true }));
    const money = moneySupply(state);
    const r = advanceDay(state, map);
    const sold = state.players.me!.ledger.filter((e) => e.kind === 'sell' && e.good === 'wood');
    expect(sold.reduce((a, e) => a + (e.kind === 'sell' ? e.qty : 0), 0)).toBe(n);
    expect(sold[0]!.kind === 'sell' && sold[0]!.price).toBeGreaterThan(basePrice('wood') * 1.2);
    // 큰 주문이 낸 돈은 바깥에서 들어온 돈이다
    expect(r.outsideGold).toBeGreaterThan(0);
    expect(moneySupply(state)).toBe(money + r.stipend + r.outsideGold + r.arrivedGold - r.tribute - r.leftGold);
    expect(ev.orders![0]!.left).toBeLessThanOrEqual(200 - n);
    // 남은 양이 다 차면 그날로 끝난다
    ev.orders![0]!.left = 1;
    advanceDay(state, map);
    expect(ev.orders![0]!.left === 0 ? ev.end : -1).toBe(state.day - 1);
  });

  it('봄 구휼이 사들인 곡물은 그 마을 일꾼에게 나눠 준다 (먹을 것이 적은 일꾼부터, 0.0.9)', async () => {
    const { count } = await import('../economy/inventory');
    const { map, state } = world(SEEDS[0]!);
    const town = state.players.me!.town;
    const ev = activate(state, map, 'relief', town, state.day + 7);
    const workers = state.workers.filter((w) => w.town === town);
    const before = workers.map((w) => count(w.inv, 'grain'));
    const total = before.reduce((a, b) => a + b, 0);
    expect(giveOutBigOrders(state, [{ event: ev.id, good: 'grain', qty: 30 }])).toBe(30);
    const after = workers.map((w) => count(w.inv, 'grain'));
    expect(after.reduce((a, b) => a + b, 0)).toBe(total + 30);
    // 가장 적게 가졌던 일꾼이 가장 많이 받는다
    const least = before.indexOf(Math.min(...before));
    expect(after[least]! - before[least]!).toBe(Math.max(...after.map((a, i) => a - before[i]!)));
    // 나눠 주지 않는 큰 주문(조선소 목재)은 그대로 사라진다
    const ship = activate(state, map, 'shipyard', town, state.day + 7);
    expect(giveOutBigOrders(state, [{ event: ship.id, good: 'wood', qty: 10 }])).toBe(0);
  });

  it('큰 주문 사건은 시즌에 몇 번 있고, 징조가 늘 먼저 돈다', () => {
    const counts = SEEDS.slice(0, 20).map((seed) => {
      const { map, state } = world(seed);
      const season = createSeason(state, map, 1, 1);
      return season.schedule.filter((s) => eventDef(s.event).effects.some((e) => e.kind === 'bigOrder')).length;
    });
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(avg).toBeGreaterThanOrEqual(1.5);
    expect(avg).toBeLessThanOrEqual(4.5);
  });

  describe('겨울에 큰 주문이 더 자주 (0.0.8)', () => {
    // 시작 계절 4개 × 시드 20개의 첫 시즌 일정에서 큰 주문이 어느 계절에 있나
    const runs = ([0, 1, 2, 3] as Season[]).flatMap((start) =>
      SEEDS.slice(0, 20).map((seed) => {
        const map = generateWorld(seed);
        const state = createEconomy(map, seed, { startSeason: start });
        const big = createSeason(state, map, 1, 1).schedule.filter((s) => eventDef(s.event).effects.some((e) => e.kind === 'bigOrder'));
        return { map, big: big.map((s) => ({ ...s, season: seasonOfDay(s.day, state.startSeason) })) };
      }),
    );

    it('시즌 전체로는 평균 2~4번 (어느 계절에 시작해도)', () => {
      for (let start = 0; start < 4; start++) {
        const part = runs.slice(start * 20, start * 20 + 20);
        const avg = part.reduce((a, r) => a + r.big.length, 0) / part.length;
        expect(avg, `시작 계절 ${start}`).toBeGreaterThanOrEqual(2);
        expect(avg, `시작 계절 ${start}`).toBeLessThanOrEqual(4);
      }
    });

    it('겨울에 있는 큰 주문이 다른 어느 계절보다 많다 (겨울 비중 30% 넘게)', () => {
      const bySeason = [0, 0, 0, 0];
      for (const r of runs) for (const b of r.big) bySeason[b.season]!++;
      const total = bySeason.reduce((a, b) => a + b, 0);
      for (const s of [0, 1, 2]) expect(bySeason[WINTER]).toBeGreaterThan(bySeason[s]! * 1.3);
      expect(bySeason[WINTER]! / total).toBeGreaterThan(0.3);
    });

    it('봄 구휼은 봄에만, 곡물을 기준가 1.5배에 200개 사들여 나눠 주고 징조가 8~12일 전에 돈다 (0.0.9)', () => {
      const relief = runs.flatMap((r) => r.big).filter((b) => b.event === 'relief');
      // 시즌 절반쯤에 한 번
      expect(relief.length / runs.length).toBeGreaterThan(0.3);
      for (const b of relief) {
        expect(b.season).toBe(SPRING);
        expect(b.omenDay).not.toBeNull();
        expect(b.day - b.omenDay!).toBeGreaterThanOrEqual(Math.min(8, b.day - 1));
        expect(b.day - b.omenDay!).toBeLessThanOrEqual(12);
      }
      expect(eventDef('relief').effects).toEqual([{ kind: 'bigOrder', good: 'grain', qty: 200, factor: 1.5, giveOut: true }]);
    });

    it('겨울 축제는 겨울에 도시에서만, 혼례 잔치는 겨울에 없다', () => {
      const all = runs.flatMap((r) => r.big.map((b) => ({ ...b, tier: r.map.towns[b.town]!.tier })));
      const winterFestival = all.filter((b) => b.event === 'winterFestival');
      expect(winterFestival.length).toBeGreaterThan(0);
      for (const b of winterFestival) expect([b.season, b.tier]).toEqual([WINTER, 'city']);
      expect(all.filter((b) => b.event === 'festival' && b.season === WINTER)).toEqual([]);
    });
  });
});

describe('하루 흐름에서', () => {
  it('일정대로 사건이 시작되어 신문에 실리고 시즌 기록에 남는다', () => {
    const { map, state } = world(20261008);
    const first = state.season!.schedule[0]!;
    let news: string[] = [];
    while (state.day <= first.day) news = advanceDay(state, map).news;
    expect(news.length).toBeGreaterThan(0);
    expect(state.season!.log.some((e) => e.event === first.event && e.day === first.day)).toBe(true);
  });

  it('징조 소문은 징조 날에 사건이 날 마을에서 생긴다 (퍼지는 건 src/sim/rumors)', () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 10)) {
      const { map, state } = world(seed);
      const omen = state.season!.schedule.find((s) => s.omenDay !== null);
      if (!omen) continue;
      while (state.day <= omen.omenDay!) advanceDay(state, map);
      const r = state.rumorMill.live.find((x) => x.fact.kind === 'omen' && x.fact.event === omen.event && x.day === omen.omenDay);
      expect(r?.origin).toBe(omen.town);
      expect(r?.truth).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('시즌이 끝나면 다음 시즌 일정을 새로 짠다 (세계는 이어진다)', () => {
    const { map, state } = world(1);
    for (let i = 0; i < CYCLE_DAYS + 1; i++) advanceDay(state, map);
    expect(state.season!.number).toBe(2);
    expect(state.season!.startDay).toBe(CYCLE_DAYS + 1);
    for (const s of state.season!.schedule) expect(s.day).toBeGreaterThan(CYCLE_DAYS);
  });
});

describe('반응 사건', () => {
  it('값이 며칠째 너무 낮으면 그 일꾼들이 일을 줄인다', () => {
    const { map, state } = world(20261008);
    const town = state.towns.find((t) => state.workers.some((w) => w.town === t.id && w.job === 'fisher'))!;
    town.refPrice.fish = 1;
    let news: string[] = [];
    for (let i = 0; i < ECONOMY.events.reactive.streakDays; i++) news = reactiveEvents(state, map, []);
    expect(news.some((n) => n.includes('그물을 거뒀'))).toBe(true);
    expect(produceFactor(state, town.id, 'fish')).toBeLessThan(1);
  });

  it('플레이어가 한 물품을 싹쓸이하면 품귀 기사가 난다', () => {
    const { map, state } = world(20261008);
    state.towns[0]!.lastMarket.salt = { ...state.towns[0]!.lastMarket.salt, volume: 12 };
    const buys = state.towns.map(() => ({}));
    buys[0] = { salt: 12 };
    const news = reactiveEvents(state, map, buys);
    expect(news.some((n) => n.includes('소금'))).toBe(true);
  });

  it('반응 사건은 하루에 하나뿐이다', () => {
    const { map, state } = world(20261008);
    for (const t of state.towns) for (const g of ['fish', 'grain', 'wood', 'ore'] as const) t.refPrice[g] = 1;
    for (let i = 0; i < ECONOMY.events.reactive.streakDays - 1; i++) reactiveEvents(state, map, []);
    expect(reactiveEvents(state, map, []).length).toBeLessThanOrEqual(1);
  });
});
