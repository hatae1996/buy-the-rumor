// 사건: 일정 규칙(기획서 "사건"), 효과, 반응 사건, 시즌 넘김.
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { advanceDay, applyCommand, createEconomy, moneySupply, type EconomyState } from '../economy';
import { CYCLE_DAYS, seasonOfDay } from '../season';
import { buildNeighbors, generateWorld, townTravelDays, type WorldMap } from '../worldgen';
import {
  activate,
  badGoods,
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

  it('징조는 사건 1~3일 전, 절반쯤의 사건에만 돈다', () => {
    let withOmen = 0;
    let total = 0;
    for (const { season } of seasons) {
      for (const s of season.schedule) {
        total++;
        if (s.omenDay === null) continue;
        withOmen++;
        expect(eventDef(s.event).omen).not.toBeNull();
        expect(s.day - s.omenDay).toBeGreaterThanOrEqual(1);
        expect(s.day - s.omenDay).toBeLessThanOrEqual(E.omenLead[1]);
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
    const here = state.player.town;
    const to = state.towns.find((t) => t.id !== here)!.id;
    activate(state, map, 'bandits', to, state.day + 3);
    expect(tollAt(state, to)).toBe(10);
    const gold = state.player.gold;
    expect(applyCommand(state, map, { type: 'travel', to }).ok).toBe(true);
    const travel = state.player.ledger.find((e) => e.kind === 'travel')!;
    expect(travel.kind === 'travel' && gold - state.player.gold).toBe(travel.kind === 'travel' ? travel.fee + 10 : 0);
    expect(state.player.ledger.some((e) => e.kind === 'toll' && e.gold === 10)).toBe(true);
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

describe('하루 흐름에서', () => {
  it('일정대로 사건이 시작되어 신문에 실리고 시즌 기록에 남는다', () => {
    const { map, state } = world(20261008);
    const first = state.season!.schedule[0]!;
    let news: string[] = [];
    while (state.day <= first.day) news = advanceDay(state, map).news;
    expect(news.length).toBeGreaterThan(0);
    expect(state.season!.log.some((e) => e.event === first.event && e.day === first.day)).toBe(true);
  });

  it('그 마을에 있으면 징조 소문을 듣는다', () => {
    for (const seed of SEEDS) {
      const { map, state } = world(seed);
      const omen = state.season!.schedule.find((s) => s.omenDay !== null);
      if (!omen) continue;
      state.player.town = omen.town;
      while (state.day <= omen.omenDay!) advanceDay(state, map);
      expect(state.player.rumors.some((r) => r.day === omen.omenDay && r.town === omen.town)).toBe(true);
      return;
    }
    throw new Error('징조가 있는 시드가 없다');
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
