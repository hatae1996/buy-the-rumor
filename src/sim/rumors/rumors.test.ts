// 소문: 생기기, 퍼지기, 소문꾼 성격, 듣기 (기획서 "소문").
import { describe, expect, it } from 'vitest';
import { ECONOMY, RUMORS } from '../constants';
import { advanceDay, createEconomy, type EconomyState } from '../economy';
import { createRng } from '../rng';
import { generateWorld, townHops, townLinks, type WorldMap } from '../worldgen';
import {
  believes,
  createGossips,
  hearFromGossips,
  knownCopy,
  makeRumorsToday,
  rumorNight,
  spreadReach,
  tell,
  type Gossip,
  type RumorFact,
  type WorldRumor,
} from './index';

const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 3);

function world(seed: number, warmupDays = 0): { map: WorldMap; state: EconomyState } {
  const map = generateWorld(seed);
  return { map, state: createEconomy(map, seed, { warmupDays }) };
}

/** 시험용 소문 하나를 세계에 넣는다 */
function addRumor(
  state: EconomyState,
  map: WorldMap,
  fact: RumorFact,
  opt: { truth?: boolean; origin?: number; day?: number; expires?: number } = {},
): WorldRumor {
  const mill = state.rumorMill;
  const day = opt.day ?? state.day;
  const expires = opt.expires ?? day + 5;
  const origin = opt.origin ?? fact.town;
  const r: WorldRumor = {
    id: mill.nextId++,
    source: opt.truth === false ? 'false' : 'hidden',
    fact,
    origin,
    day,
    truth: opt.truth ?? true,
    expires,
    importance: RUMORS.importance[fact.kind],
    reach: spreadReach(map, origin, day, expires, createRng(1)),
  };
  mill.live.push(r);
  return r;
}

const gossip = (town: number, personality: Gossip['personality'], good: Gossip['good'] = null, id = 1): Gossip => ({
  id,
  town,
  name: '우물가 마르타',
  personality,
  good,
});

/** 플레이어가 머무는 마을과 그 이웃 하나 */
function hereAndNeighbor(map: WorldMap, state: EconomyState): { here: number; other: number } {
  const here = state.player.town;
  return { here, other: townLinks(map)[here]![0]! };
}

describe('퍼짐', () => {
  it('길을 따라 하루에 한 마을씩, 생긴 마을은 흐려지지 않고 시작한다', () => {
    for (const seed of SEEDS) {
      const map = generateWorld(seed);
      const hops = townHops(map);
      for (const t of map.towns) {
        const reach = spreadReach(map, t.id, 10, 100, createRng(seed));
        expect(reach[0]).toEqual({ town: t.id, day: 10, blur: 0, scale: 1 });
        expect(new Set(reach.map((c) => c.town)).size).toBe(map.towns.length);
        for (const c of reach) {
          expect(c.day).toBe(10 + hops[t.id]![c.town]!);
          // 건널 때마다 많아야 한 번 흐려지고, 부풀기만 한다
          expect(c.blur).toBeLessThanOrEqual(hops[t.id]![c.town]!);
          expect(c.scale).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('사라지는 날이 지나면 더 건너지 않는다', () => {
    const map = generateWorld(SEEDS[0]!);
    expect(spreadReach(map, 0, 10, 10, createRng(1))).toHaveLength(1);
  });
});

describe('소문꾼', () => {
  it('마을마다 2~3명, 같은 시드와 시즌이면 같고 장사꾼만 물품이 있다', () => {
    for (const seed of SEEDS) {
      const g = createGossips(seed, 1, 4);
      expect(createGossips(seed, 1, 4)).toEqual(g);
      for (let town = 0; town < 4; town++) {
        const n = g.filter((x) => x.town === town).length;
        expect(n).toBeGreaterThanOrEqual(RUMORS.gossipsPerTown[0]);
        expect(n).toBeLessThanOrEqual(RUMORS.gossipsPerTown[1]);
      }
      for (const x of g) expect(x.good !== null).toBe(x.personality === 'merchant');
      expect(new Set(g.map((x) => x.id)).size).toBe(g.length);
    }
  });

  it('시즌이 바뀌면 성격을 새로 정한다', () => {
    const changed = SEEDS.filter((seed) => {
      const a = createGossips(seed, 1, 4).map((x) => x.personality).join();
      const b = createGossips(seed, 2, 4).map((x) => x.personality).join();
      return a !== b;
    });
    expect(changed.length).toBeGreaterThan(SEEDS.length * 0.8);
  });

  it('믿을 만한 노인은 늦게 알고, 허풍쟁이는 이웃 마을에 있을 때 미리 안다', () => {
    const { map, state } = world(SEEDS[1]!);
    const { here, other } = hereAndNeighbor(map, state);
    const local = addRumor(state, map, { kind: 'trait', town: here, tag: 'bears' });
    const elder = gossip(here, 'elder');
    expect(knownCopy(elder, local, state.day)).toBeNull();
    expect(knownCopy(elder, local, state.day + 1)).not.toBeNull();

    const far = addRumor(state, map, { kind: 'trait', town: other, tag: 'bears' });
    expect(knownCopy(gossip(here, 'coward'), far, state.day)).toBeNull();
    expect(knownCopy(gossip(here, 'braggart'), far, state.day)).not.toBeNull();
  });

  it('노인은 헛소문을 대부분 걸러 내고, 허풍쟁이는 다 옮긴다', () => {
    const fakes = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, truth: false }) as WorldRumor);
    const elder = gossip(0, 'elder', null, 7);
    const passed = fakes.filter((r) => believes(elder, r)).length / fakes.length;
    expect(passed).toBeGreaterThan(1 - RUMORS.personality.elder.trust - 0.1);
    expect(passed).toBeLessThan(1 - RUMORS.personality.elder.trust + 0.1);
    expect(fakes.every((r) => believes(gossip(0, 'braggart'), r))).toBe(true);
    expect(believes(elder, { id: 1, truth: true } as WorldRumor)).toBe(true);
  });
});

describe('말하기', () => {
  const setup = () => {
    const { map, state } = world(SEEDS[2]!);
    const { here, other } = hereAndNeighbor(map, state);
    return { map, state, here, other };
  };

  it('숫자는 흐려질수록 뭉개진다: 그대로 → 어림 → 금값', () => {
    const { map, state, other } = setup();
    const r = addRumor(state, map, { kind: 'price', town: other, good: 'leather', dir: 'high', price: 47 });
    const at = (blur: number) => tell(r, { town: other, day: state.day, blur, scale: 1 }, null, map);
    expect(at(0).claim).toMatchObject({ price: 47, bound: 'about' });
    expect(at(0).text).toContain('47');
    expect(at(1).claim).toMatchObject({ price: 40, bound: 'atLeast' });
    expect(at(1).text).toContain('40은 넘는다');
    expect(at(2).claim).toMatchObject({ price: null, bound: null });
    expect(at(2).text).toContain('금값');
  });

  it('허풍쟁이는 부풀리고, 노인은 건너오며 부푼 숫자를 덜어 낸다', () => {
    const { map, state, here, other } = setup();
    const r = addRumor(state, map, { kind: 'price', town: other, good: 'leather', dir: 'high', price: 40 });
    const copy = { town: here, day: state.day, blur: 0, scale: 1.69 };
    const plain = tell(r, copy, null, map).claim;
    const elder = tell(r, copy, gossip(here, 'elder'), map).claim;
    const braggart = tell(r, copy, gossip(here, 'braggart'), map).claim;
    if (plain.kind !== 'price' || elder.kind !== 'price' || braggart.kind !== 'price') throw new Error();
    expect(elder.price!).toBeLessThan(plain.price!);
    expect(braggart.price!).toBeGreaterThan(plain.price!);
  });

  it('장사꾼은 자기 물품 값이 오른다고 한다', () => {
    const { map, state, here, other } = setup();
    const r = addRumor(state, map, { kind: 'price', town: other, good: 'salt', dir: 'low', price: 3 });
    const copy = { town: here, day: state.day, blur: 0, scale: 1 };
    expect(tell(r, copy, gossip(here, 'merchant', 'salt'), map).claim).toMatchObject({ dir: 'high' });
    expect(tell(r, copy, gossip(here, 'merchant', 'wood'), map).claim).toMatchObject({ dir: 'low' });
  });

  it('겁쟁이는 나쁜 소식을 크게, 먼저 말한다', () => {
    const { map, state, here } = setup();
    const r = addRumor(state, map, { kind: 'omen', event: 'wolves', town: here, eventDay: state.day + 2 });
    const copy = r.reach[0]!;
    const calm = tell(r, copy, gossip(here, 'elder'), map);
    const scared = tell(r, copy, gossip(here, 'coward'), map);
    expect(scared.importance).toBe(calm.importance + RUMORS.cowardBadBonus);
    expect(scared.text).toContain('큰일이야');
    expect(calm.text).not.toContain('큰일이야');
  });
});

describe('듣기', () => {
  it('중요한 소문(징조)이 먼저 나오고, 소문꾼은 하루에 정해진 만큼만 말한다', () => {
    const { map, state } = world(SEEDS[3]!);
    const { here } = hereAndNeighbor(map, state);
    state.rumorMill.gossips = [gossip(here, 'braggart')];
    addRumor(state, map, { kind: 'trait', town: here, tag: 'bears' });
    addRumor(state, map, { kind: 'node', town: here, resource: 'forest', level: 'low' });
    const omen = addRumor(state, map, { kind: 'omen', event: 'landslide', town: here, eventDay: state.day + 2 });
    const heard = hearFromGossips(state, map, createRng(9));
    expect(heard).toHaveLength(RUMORS.personality.braggart.talk);
    expect(heard[0]!.rumor).toBe(omen.id);
    expect(heard[0]!.from).toBe('우물가 마르타');
    expect(heard[0]!.via).toBe('gossip');
  });

  it('같은 소문은 두 번 듣지 않고, 지금 마을 시세 소문은 듣지 않는다', () => {
    const { map, state } = world(SEEDS[4]!);
    const { here } = hereAndNeighbor(map, state);
    state.rumorMill.gossips = [gossip(here, 'braggart'), gossip(here, 'coward', null, 2)];
    addRumor(state, map, { kind: 'price', town: here, good: 'ore', dir: 'high', price: 30 });
    const node = addRumor(state, map, { kind: 'node', town: here, resource: 'ore', level: 'high' });
    const first = hearFromGossips(state, map, createRng(1));
    expect(first.map((h) => h.rumor)).toEqual([node.id]);
    expect(hearFromGossips(state, map, createRng(2))).toEqual([]);
  });

  it('길 위에서는 듣지 않는다', () => {
    const { map, state } = world(SEEDS[5]!);
    const { here, other } = hereAndNeighbor(map, state);
    state.rumorMill.gossips = [gossip(here, 'braggart')];
    addRumor(state, map, { kind: 'trait', town: here, tag: 'bears' });
    state.player.travel = { from: here, to: other, days: 2, daysLeft: 2 };
    expect(hearFromGossips(state, map, createRng(1))).toEqual([]);
  });
});

describe('한 시즌 돌려 보기 (시드 6개)', () => {
  const runs = SEEDS.slice(0, 6).map((seed) => {
    const { map, state } = world(seed, ECONOMY.warmupDays);
    const perDay: number[] = [];
    let maxLive = 0;
    for (let d = 0; d < state.season!.length; d++) {
      const r = advanceDay(state, map);
      perDay.push(r.heard.length);
      maxLive = Math.max(maxLive, state.rumorMill.live.length);
    }
    return { map, state, perDay, maxLive };
  });

  it('마을에 머물면 하루에 2~3개까지 듣는다', () => {
    for (const { perDay } of runs) {
      expect(Math.max(...perDay)).toBeLessThanOrEqual(RUMORS.freePerDay[1]);
      const avg = perDay.reduce((a, b) => a + b, 0) / perDay.length;
      expect(avg).toBeGreaterThan(1);
    }
  });

  it('같은 소문을 두 번 듣지 않고, 지금 마을 시세는 소문으로 듣지 않는다', () => {
    for (const { state } of runs) {
      const ids = state.player.rumors.map((h) => h.rumor).filter((id) => id !== null);
      expect(new Set(ids).size).toBe(ids.length);
      for (const h of state.player.rumors) {
        if (h.claim && (h.claim.kind === 'price' || h.claim.kind === 'orders') && h.gossip !== null) {
          // 장사꾼 자랑은 늘 다른 마을 이야기다
          expect(h.claim.town).not.toBe(h.town);
        }
      }
    }
  });

  it('살아 있는 소문은 쌓이지 않고 사라진다', () => {
    for (const { maxLive } of runs) expect(maxLive).toBeLessThan(120);
  });

  it('여러 출처에서 소문이 생긴다', () => {
    const kinds = new Set(runs.flatMap(({ state }) => state.player.rumors.map((h) => h.claim?.kind)));
    for (const k of ['omen', 'node', 'price', 'trait']) expect(kinds).toContain(k);
  });

  it('도장이 찍힌다 (맞았다와 틀렸다가 모두 나온다)', () => {
    const stamps = runs.flatMap(({ state }) => state.player.rumors.map((h) => h.stamp));
    expect(stamps).toContain('right');
    expect(stamps).toContain('wrong');
  });
});

describe('같은 시드면 같은 소문, 소문은 경제를 바꾸지 않는다', () => {
  it('두 번 돌려도 소문과 수첩이 같다', () => {
    const a = world(SEEDS[6]!);
    const b = world(SEEDS[6]!);
    for (let d = 0; d < 40; d++) {
      advanceDay(a.state, a.map);
      advanceDay(b.state, b.map);
    }
    expect(JSON.stringify(a.state.rumorMill)).toBe(JSON.stringify(b.state.rumorMill));
    expect(JSON.stringify(a.state.player.rumors)).toBe(JSON.stringify(b.state.player.rumors));
  });

  it('소문 밤은 경제 난수, 번호, 마을 상태를 건드리지 않는다', () => {
    const { map, state } = world(SEEDS[7]!, 10);
    for (let d = 0; d < 10; d++) advanceDay(state, map);
    const before = JSON.parse(JSON.stringify(state)) as EconomyState;
    rumorNight(state, map);
    expect(state.rng).toBe(before.rng);
    expect(state.nextId).toBe(before.nextId);
    expect(state.towns).toEqual(before.towns);
    expect(state.workers).toEqual(before.workers);
  });

  it('진짜 소문은 그날의 진짜 상태에서, 헛소문은 진짜와 반대로 만든다', () => {
    const { map, state } = world(SEEDS[8]!, 20);
    for (let d = 0; d < 30; d++) {
      advanceDay(state, map);
      const made = makeRumorsToday(state, map, createRng(d));
      for (const r of made) {
        const f = r.fact;
        if (f.kind === 'price') {
          const actual = Math.round(state.towns[f.town]!.refPrice[f.good]);
          if (r.truth) expect(f.price).toBe(actual);
          else expect(f.dir === 'high' ? actual < f.price : actual > f.price).toBe(true);
        }
        if (f.kind === 'omen') expect(r.truth).toBe(f.eventDay !== null);
        expect(r.reach[0]!.town).toBe(r.origin);
      }
    }
  });
});
