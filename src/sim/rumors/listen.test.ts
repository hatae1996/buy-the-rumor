// 소문은 듣고 내가 적는다 (0.1.2, 60번 답을 바꿈): 여관 소문꾼 "듣기"로만 듣고, 적기 / 흘려듣기를 고른다.
// 적은 것만 수첩과 도장, Buy the Rumor는 적은 날부터. 흘려들은 것은 며칠 뒤 사라진다. 봇은 밤마다 저절로 듣는다.
import { describe, expect, it } from 'vitest';
import { RUMORS } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { generateWorld, type WorldMap } from '../worldgen';
import type { HeardRumor } from './types';

const SEED = 4242;

/** 소문이 넉넉히 도는 세계 (시즌 중간쯤까지 돌린다) */
function world(): { map: WorldMap; s: EconomyState } {
  const map = generateWorld(SEED);
  const s = createEconomy(map, SEED, { warmupDays: 20 });
  for (let d = 0; d < 12; d++) advanceDay(s, map);
  return { map, s };
}

const gossipNotes = (s: EconomyState): HeardRumor[] => s.players.me!.rumors.filter((h) => h.via === 'gossip');

describe('여관에서 듣는다', () => {
  it('사람은 밤마다 저절로 듣지 않는다', () => {
    const { s } = world();
    expect(gossipNotes(s)).toEqual([]);
  });

  it('"듣기"를 하면 2~3개를 듣고 최근 들은 이야기에 둔다 (하루 한 번)', () => {
    const { map, s } = world();
    const before = playerView(s, map, 'me').gossip!;
    if (before.fresh === 0) return;
    expect(applyCommand(s, map, 'me', { type: 'listenGossip' }).ok).toBe(true);
    const v = playerView(s, map, 'me');
    expect(v.recentHeard.length).toBeGreaterThan(0);
    expect(v.recentHeard.length).toBeLessThanOrEqual(RUMORS.freePerDay[1]);
    expect(v.rumors.some((n) => n.via === 'gossip')).toBe(false);
    expect(v.gossip!.canListen).toBe(false);
    expect(applyCommand(s, map, 'me', { type: 'listenGossip' })).toEqual({ ok: false, error: 'alreadyListened' });
  });

  it('적은 것만 수첩에 남고 도장이 찍힌다. 흘려들은 것은 며칠 뒤 사라진다', () => {
    const { map, s } = world();
    if (applyCommand(s, map, 'me', { type: 'listenGossip' }).ok !== true) return;
    const heard = playerView(s, map, 'me').recentHeard;
    const [keep, drop] = heard;
    expect(applyCommand(s, map, 'me', { type: 'noteRumor', id: keep!.id }).ok).toBe(true);
    if (drop) expect(applyCommand(s, map, 'me', { type: 'dismissRumor', id: drop.id }).ok).toBe(true);
    let v = playerView(s, map, 'me');
    expect(v.rumors.map((n) => n.id)).toContain(keep!.id);
    expect(applyCommand(s, map, 'me', { type: 'noteRumor', id: keep!.id })).toEqual({ ok: false, error: 'noNote' });
    // 흘려들은 것과 고르지 않은 것은 recentDays일 남았다가 그다음 밤에 사라진다
    const heardDay = s.day;
    for (let d = 0; d < RUMORS.recentDays; d++) advanceDay(s, map);
    v = playerView(s, map, 'me');
    expect(v.recentHeard.filter((n) => n.day <= heardDay)).toEqual([]);
    if (drop) expect(s.players.me!.rumors.some((h) => h.id === drop.id)).toBe(false);
    // 적지 않은 이야기에는 도장이 찍히지 않는다
    for (const h of s.players.me!.rumors) if (h.noted === false) expect(h.stamp).toBeNull();
  });

  it('Buy the Rumor 랭킹은 징조를 수첩에 적은 날부터 센다 (질문 95 기본안)', () => {
    const { map, s } = world();
    const me = s.players.me!;
    // 징조 소문을 직접 넣고 들은 이야기로 둔다
    me.rumors.push({
      id: 999_001,
      day: s.day,
      town: me.town,
      text: '조선소에 목수가 모인다더군',
      via: 'gossip',
      from: '시험',
      gossip: null,
      rumor: null,
      importance: 5,
      claim: { kind: 'omen', event: 'shipyard', town: me.town, from: s.day, until: s.day + 10 },
      stamp: null,
      stampDay: null,
      noted: false,
    });
    const heardBefore = me.record?.heardOmens?.length ?? 0;
    expect(applyCommand(s, map, 'me', { type: 'noteRumor', id: 999_001 }).ok).toBe(true);
    expect((me.record?.heardOmens?.length ?? 0) - heardBefore).toBe(1);
  });
});

describe('봇은 밤마다 저절로 듣고 바로 쓴다', () => {
  it('autoRumors면 밤에 소문꾼에게 듣고 수첩에 바로 적힌다', () => {
    const map = generateWorld(SEED);
    const s = createEconomy(map, SEED, { warmupDays: 20 });
    s.players.me!.autoRumors = true;
    for (let d = 0; d < 12; d++) advanceDay(s, map);
    const notes = gossipNotes(s);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((h) => h.noted !== false)).toBe(true);
  });
});
