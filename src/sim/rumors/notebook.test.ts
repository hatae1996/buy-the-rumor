// 수첩 도장, 여관 술 한 잔, 전서구, 정보원 (기획서 "소문 - 듣는 방법", "들은 이야기 수첩").
import { describe, expect, it } from 'vitest';
import { RUMORS } from '../constants';
import { advanceDay, applyCommand, createEconomy, type EconomyState } from '../economy';
import { createRng } from '../rng';
import { generateWorld, REGION_TAGS, townLinks, type WorldMap } from '../worldgen';
import {
  addNote,
  drinkFee,
  priceRight,
  spreadReach,
  tagsNearTown,
  verifyByExpedition,
  verifyNotebook,
  type Claim,
  type HeardRumor,
  type RumorFact,
  type WorldRumor,
} from './index';

const SEED = 20261008;

function world(seed = SEED): { map: WorldMap; state: EconomyState } {
  const map = generateWorld(seed);
  return { map, state: createEconomy(map, seed, { warmupDays: 10 }) };
}

function hear(state: EconomyState, claim: Claim, town = state.player.town): HeardRumor {
  return addNote(state, { town, text: '"시험"', via: 'gossip', from: '우물가 마르타', gossip: 1, rumor: null, importance: 1, claim });
}

function addRumor(state: EconomyState, map: WorldMap, fact: RumorFact, origin: number): WorldRumor {
  const mill = state.rumorMill;
  const r: WorldRumor = {
    id: mill.nextId++,
    source: 'hidden',
    fact,
    origin,
    day: state.day,
    truth: true,
    expires: state.day + 5,
    importance: RUMORS.importance[fact.kind],
    reach: spreadReach(map, origin, state.day, state.day + 5, createRng(1)),
  };
  mill.live.push(r);
  return r;
}

describe('시세 도장', () => {
  const claim = (price: number | null, bound: 'about' | 'atLeast' | 'atMost' | null, dir: 'high' | 'low' = 'high') =>
    ({ kind: 'price', town: 0, good: 'leather', dir, price, bound }) as const;

  it('숫자를 들었으면 숫자로, 금값/헐값이면 기준 가격으로 견준다', () => {
    expect(priceRight(claim(40, 'about'), 44)).toBe(true);
    expect(priceRight(claim(40, 'about'), 20)).toBe(false);
    expect(priceRight(claim(40, 'atLeast'), 41)).toBe(true);
    expect(priceRight(claim(40, 'atLeast'), 39)).toBe(false);
    expect(priceRight(claim(10, 'atMost', 'low'), 8)).toBe(true);
    expect(priceRight(claim(null, null), 999)).toBe(true);
    expect(priceRight(claim(null, null), 1)).toBe(false);
    expect(priceRight(claim(null, null, 'low'), 1)).toBe(true);
  });

  it('그 마을에 가서 시세를 보면 찍고, 다른 마을에서는 찍지 않는다', () => {
    const { map, state } = world();
    const here = state.player.town;
    const other = townLinks(map)[here]![0]!;
    const actual = Math.round(state.towns[here]!.refPrice.ore);
    const right = hear(state, { kind: 'price', town: here, good: 'ore', dir: 'high', price: actual, bound: 'about' });
    const wrong = hear(state, { kind: 'price', town: here, good: 'ore', dir: 'high', price: actual * 3 + 10, bound: 'about' });
    const away = hear(state, { kind: 'price', town: other, good: 'ore', dir: 'high', price: 1, bound: 'about' });
    verifyNotebook(state, map);
    expect(right.stamp).toBe('right');
    expect(wrong.stamp).toBe('wrong');
    expect(away.stamp).toBeNull();
    expect(right.stampDay).toBe(state.day);
  });
});

describe('징조 도장 (신문)', () => {
  it('기한 안에 그 사건이 신문에 실리면 맞았다, 안 실리면 틀렸다', () => {
    const { map, state } = world();
    const season = state.season!;
    const real = hear(state, { kind: 'omen', event: 'wolves', town: 1, from: state.day, until: state.day + 5 });
    const fake = hear(state, { kind: 'omen', event: 'storm', town: 2, from: state.day, until: state.day + 1 });
    season.log.push({ event: 'wolves', town: 1, day: state.day + 1, end: state.day + 3, omenDay: state.day });
    verifyNotebook(state, map);
    expect(real.stamp).toBe('right');
    expect(fake.stamp).toBeNull();
    state.day += 2;
    verifyNotebook(state, map);
    expect(fake.stamp).toBe('wrong');
  });
});

describe('특색과 자원지 도장 (직접 가 봄)', () => {
  it('그 마을에 있으면 특색 소문에 도장을 찍는다', () => {
    const { map, state } = world();
    const here = state.player.town;
    const near = new Set(tagsNearTown(map)[here]);
    const absent = REGION_TAGS.find((t) => !near.has(t.id))!;
    const wrong = hear(state, { kind: 'trait', town: here, tag: absent.id });
    const present = [...near][0];
    const right = present ? hear(state, { kind: 'trait', town: here, tag: present }) : null;
    verifyNotebook(state, map);
    expect(wrong.stamp).toBe('wrong');
    if (right) expect(right.stamp).toBe('right');
  });

  it('원정을 나가 자원지를 보면 그 마을 자원지 소문에 도장을 찍는다', () => {
    const { state } = world();
    const town = state.towns.find((t) => t.nodes.some((n) => n.kind === 'forest'))!;
    const node = town.nodes.find((n) => n.kind === 'forest')!;
    node.amount = node.capacity * 0.1;
    const low = hear(state, { kind: 'node', town: town.id, resource: 'forest', level: 'low' }, town.id);
    const high = hear(state, { kind: 'node', town: town.id, resource: 'forest', level: 'high' }, town.id);
    expect(verifyByExpedition(state, town.id)).toBe(2);
    expect(low.stamp).toBe('right');
    expect(high.stamp).toBe('wrong');
  });
});

describe('장날 신청 현황 도장', () => {
  it('들은 뒤 그 마을 장날을 겪으면 찍는다', () => {
    const { map, state } = world();
    const here = state.player.town;
    const h = hear(state, { kind: 'orders', town: here, good: 'grain', side: 'buy', qty: null });
    verifyNotebook(state, map);
    // 같은 날에는 아직 장날을 겪지 않았다
    expect(h.stamp).toBeNull();
    state.day += 1;
    state.towns[here]!.lastMarket.grain = { ...state.towns[here]!.lastMarket.grain, demand: 20, supply: 5 };
    verifyNotebook(state, map);
    expect(h.stamp).toBe('right');
  });
});

describe('여관에서 술 한 잔', () => {
  it('들려줄 게 없으면 돈을 받지 않는다', () => {
    const { map, state } = world();
    state.rumorMill.live = [];
    const gold = state.player.gold;
    expect(applyCommand(state, map, { type: 'buyDrink' })).toEqual({ ok: false, error: 'noRumor' });
    expect(state.player.gold).toBe(gold);
  });

  it('이웃 마을에 닿은 먼 소문을 듣고, 하루 한 번만 살 수 있다', () => {
    const { map, state } = world();
    state.rumorMill.live = [];
    const here = state.player.town;
    const other = townLinks(map)[here]![0]!;
    const r = addRumor(state, map, { kind: 'node', town: other, resource: 'ore', level: 'low' }, other);
    const gold = state.player.gold;
    expect(applyCommand(state, map, { type: 'buyDrink' }).ok).toBe(true);
    expect(state.player.gold).toBe(gold - drinkFee(state, here));
    const note = state.player.rumors.at(-1)!;
    expect(note).toMatchObject({ via: 'inn', from: '여관 손님', rumor: r.id, town: here });
    expect(applyCommand(state, map, { type: 'buyDrink' })).toEqual({ ok: false, error: 'alreadyDrank' });
    advanceDay(state, map);
    expect(state.player.drankToday).toBe(false);
  });
});

describe('전서구', () => {
  it('다음 날 그 마을 시세가 기억과 수첩에 적힌다', () => {
    const { map, state } = world();
    const here = state.player.town;
    const to = map.towns.find((t) => t.id !== here)!.id;
    expect(applyCommand(state, map, { type: 'sendPigeon', to: here })).toEqual({ ok: false, error: 'sameTown' });
    const gold = state.player.gold;
    expect(applyCommand(state, map, { type: 'sendPigeon', to }).ok).toBe(true);
    expect(state.player.gold).toBe(gold - RUMORS.pigeonFee);
    const sentDay = state.day;
    const report = advanceDay(state, map);
    expect(state.player.memory[to]!.day).toBe(sentDay);
    expect(state.player.memory[to]!.prices.ore).toBe(Math.round(state.towns[to]!.refPrice.ore));
    expect(report.heard.some((h) => h.via === 'pigeon' && h.town === to)).toBe(true);
    expect(state.player.pigeons).toEqual([]);
  });
});

describe('정보원 (구조만, 화면 없음)', () => {
  it('매일 품삯을 받고 그 마을 시세와 신청 현황을 보내고, 품삯을 못 받으면 떠난다', () => {
    const { map, state } = world();
    const here = state.player.town;
    expect(applyCommand(state, map, { type: 'hireInformant' }).ok).toBe(true);
    expect(applyCommand(state, map, { type: 'hireInformant' })).toEqual({ ok: false, error: 'alreadyInformant' });
    const gold = state.player.gold;
    const r = advanceDay(state, map);
    expect(state.player.gold).toBe(gold - RUMORS.informant.dailyWage);
    expect(r.heard.some((h) => h.via === 'informant' && h.text.includes('장날'))).toBe(true);
    state.player.gold = 0;
    advanceDay(state, map);
    expect(state.player.informants).toEqual([]);
    expect(applyCommand(state, map, { type: 'dismissInformant', town: here })).toEqual({ ok: false, error: 'noInformant' });
  });
});

describe('수첩', () => {
  it('너무 길어지면 오래된 줄부터 지운다', () => {
    const { state } = world();
    for (let i = 0; i < RUMORS.notebookMax + 10; i++) hear(state, { kind: 'trait', town: 0, tag: 'bears' });
    expect(state.player.rumors).toHaveLength(RUMORS.notebookMax);
  });
});
