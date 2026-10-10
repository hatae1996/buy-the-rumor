// NPC 외모 (기획서 "NPC 외모", 0.1.4): 직업별 범위 안에서 시즌 시드 + NPC 번호로 뽑고, 한 세계 안에서 겹치지 않는다.
import { describe, expect, it } from 'vitest';
import { advanceDays, createEconomy } from '../economy';
import { seasonSeed } from '../economy/worldRef';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { CLOTH_COLORS, HAIR_STYLES, LAYERS, PARTS } from './catalog';
import { assignLooks, drawLook, lookKey, npcKey, rollLook } from './draw';
import { COMMON, hairStyleRange, partRange, ROLE_RANGES } from './roles';
import { townFaces, worldLooks, worldNpcs } from './roster';
import type { Look, LookRole, NpcEntry } from './types';

const SEED = 20261008;
const map = generateWorld(SEED, { towns: 6 });
const ROLES = Object.keys(ROLE_RANGES) as LookRole[];

describe('파츠와 직업 범위', () => {
  it('레이어 순서: 뒷머리 → 얼굴·목 → 상의 → 얼굴 파츠 → 앞머리·옆머리 → 모자', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['backHair', 'face', 'top', 'brows', 'beard', 'freckles', 'wrinkles', 'frontHair', 'hat']);
    // 옷과 머리는 팔레트 색을 곱하고, 얼굴·목은 피부색을 곱한다
    const tint = Object.fromEntries(LAYERS.map((l) => [l.id, l.tint]));
    expect(tint).toMatchObject({ backHair: 'hair', frontHair: 'hair', face: 'skin', top: 'cloth', hat: 'hat' });
  });

  it('직업 범위에 적힌 파츠는 모두 목록에 있다', () => {
    for (const role of ROLES) {
      for (const l of LAYERS) {
        for (const id of partRange(role, l.id)) if (id !== null) expect(PARTS[l.id], `${role} ${l.id} ${id}`).toHaveProperty(id);
      }
    }
    for (const [l, ids] of Object.entries(COMMON.parts)) for (const id of ids) if (id !== null) expect(PARTS[l as keyof typeof PARTS]).toHaveProperty(id);
    for (const h of Object.values(HAIR_STYLES)) {
      expect(PARTS.frontHair).toHaveProperty(h.front);
      if (h.back) expect(PARTS.backHair).toHaveProperty(h.back);
    }
  });

  it('머리는 앞·뒤 한 벌로 나온다 (꽁지머리 앞에 생머리 뒤 같은 조합이 없다)', () => {
    const rng = createRng(11);
    for (let i = 0; i < 300; i++) {
      for (const role of ROLES) {
        const look = rollLook(rng, rng, role);
        const style = hairStyleRange(role).find((h) => HAIR_STYLES[h].front === look.parts.frontHair)!;
        expect(style, `${role} ${look.parts.frontHair}`).toBeDefined();
        expect(look.parts.backHair).toBe(HAIR_STYLES[style].back);
      }
    }
  });

  it('0.1.5 상의 4종: 어부 스웨터, 도시 상인 털깃 겉옷, 농부 튜닉과 멜빵, 대장장이 가죽 앞치마. 기존 상의도 그대로 나온다', () => {
    expect(partRange('fisher', 'top')).toEqual(expect.arrayContaining(['tunic', 'shawl', 'sweater']));
    expect(partRange('cityMerchant', 'top')).toEqual(expect.arrayContaining(['cloak', 'shawl', 'furCoat']));
    expect(partRange('farmer', 'top')).toEqual(expect.arrayContaining(['tunic', 'pinafore', 'braces']));
    expect(partRange('smith', 'top')).toEqual(expect.arrayContaining(['leatherVest', 'apron', 'leatherApron']));
    // 새 상의는 그 직업의 표시: 다른 직업에는 없다
    for (const role of ROLES) {
      const top = partRange(role, 'top');
      if (role !== 'fisher') expect(top).not.toContain('sweater');
      if (role !== 'cityMerchant') expect(top).not.toContain('furCoat');
      if (role !== 'farmer') expect(top).not.toContain('braces');
      if (role !== 'smith') expect(top).not.toContain('leatherApron');
    }
  });

  it('얼굴과 상의는 늘 있다 (비어 있는 레이어는 머리, 수염, 모자 같은 것만)', () => {
    for (const role of ROLES) {
      expect(partRange(role, 'face')).not.toContain(null);
      expect(partRange(role, 'top')).not.toContain(null);
    }
  });

  it('뽑은 외모는 그 직업 범위 안이다: 어부는 두건·머릿수건과 쪽빛·마, 광부는 가죽 조끼와 짙은 색, 여관 주인은 앞치마', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      for (const role of ROLES) {
        const look = rollLook(rng, rng, role);
        for (const l of LAYERS) expect(partRange(role, l.id)).toContain(look.parts[l.id]);
        expect(ROLE_RANGES[role].cloth ?? COMMON.cloth).toContain(look.cloth);
        expect(CLOTH_COLORS).toHaveProperty(look.hatColor);
      }
      const fisher = rollLook(rng, rng, 'fisher');
      expect(['hood', 'kerchief']).toContain(fisher.parts.hat);
      expect(['indigo', 'linen']).toContain(fisher.cloth);
      const miner = rollLook(rng, rng, 'miner');
      expect(miner.parts.top).toBe('leatherVest');
      expect(miner.cloth.startsWith('deep')).toBe(true);
      expect(rollLook(rng, rng, 'innkeeper').parts.top).toBe('apron');
      expect(rollLook(rng, rng, 'cityMerchant').parts.hat).toBe('feltHat');
      expect(rollLook(rng, rng, 'elder').parts.wrinkles).toBe('lines');
    }
  });
});

describe('시즌 시드로 뽑기', () => {
  const npc: NpcEntry = { kind: 'gossip', id: 1003, role: 'villager' };

  it('같은 시즌 시드와 같은 NPC 번호면 같은 얼굴, 시즌이 바뀌면 다른 얼굴', () => {
    const a = seasonSeed('2026-10-26');
    expect(drawLook(a, npc)).toEqual(drawLook(a, npc));
    const b = seasonSeed('2026-11-09');
    // 한 사람은 우연히 같을 수 있어 여럿을 견준다
    const many = (s: number) => Array.from({ length: 20 }, (_, i) => lookKey(drawLook(s, { ...npc, id: i })));
    expect(many(b)).not.toEqual(many(a));
  });

  it('종류가 다르면 같은 번호여도 다른 사람이다', () => {
    const s = seasonSeed('2026-10-26');
    const keys = (['inn', 'market', 'gossip', 'trader', 'worker'] as const).map((kind) => lookKey(drawLook(s, { kind, id: 3, role: 'villager' })));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('한 세계 안에서 같은 조합이 두 번 나오지 않는다 (겹치면 다시 뽑는다)', () => {
    // 범위가 아주 좁은 직업 300명: 처음 뽑기로는 반드시 겹친다
    const npcs: NpcEntry[] = Array.from({ length: 300 }, (_, i) => ({ kind: 'worker', id: i, role: 'miner' }));
    const looks = assignLooks(seasonSeed('x'), npcs);
    expect(looks.size).toBe(300);
    expect(new Set([...looks.values()].map(lookKey)).size).toBe(300);
    // 앞 차례 사람은 겹침이 없으니 처음 뽑은 얼굴 그대로
    expect(looks.get('worker:0')).toEqual(drawLook(seasonSeed('x'), npcs[0]!));
  });

  it('명단 순서가 달라도 같은 얼굴, 뒤에 사람이 늘어도 앞사람 얼굴은 그대로', () => {
    const npcs: NpcEntry[] = Array.from({ length: 50 }, (_, i) => ({ kind: 'worker', id: i, role: 'farmer' }));
    const a = assignLooks(1234, npcs);
    const b = assignLooks(1234, [...npcs].reverse());
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
    const more = assignLooks(1234, [...npcs, ...Array.from({ length: 50 }, (_, i): NpcEntry => ({ kind: 'worker', id: 100 + i, role: 'farmer' }))]);
    for (const [k, v] of a) expect(more.get(k)).toEqual(v);
  });
});

describe('세계의 얼굴', () => {
  const world = (worldId: string, players: number) =>
    createEconomy(map, SEED, {
      warmupDays: 20,
      world: { seasonId: '2026-10-26', worldId },
      players: Array.from({ length: players }, (_, i) => ({ id: `${worldId}${i}` })),
    });

  it('명단: 노상인, 마을마다 여관 주인과 장 상인, 소문꾼, NPC 상단, 일꾼', () => {
    const s = world('a', 1);
    const npcs = worldNpcs(s);
    expect(npcs.filter((n) => n.kind === 'elder')).toHaveLength(1);
    expect(npcs.filter((n) => n.kind === 'inn')).toHaveLength(6);
    expect(npcs.filter((n) => n.kind === 'gossip')).toHaveLength(s.rumorMill.gossips.length);
    expect(npcs.filter((n) => n.kind === 'trader')).toHaveLength(s.traders.length);
    expect(npcs.filter((n) => n.kind === 'worker')).toHaveLength(s.workers.length);
    // 도시 장 상인은 도시 상인 차림
    const city = s.towns.findIndex((t) => t.tier === 'city');
    expect(npcs.find((n) => n.kind === 'market' && n.id === city)!.role).toBe('cityMerchant');
    const looks = worldLooks(s);
    expect(new Set([...looks.values()].map(lookKey)).size).toBe(looks.size);
  });

  it('같은 시즌의 다른 세계(사람 수만 다름)에서 같은 NPC는 같은 얼굴', () => {
    const a = worldLooks(world('a', 3));
    const b = worldLooks(world('b', 12));
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
    // 다른 시즌이면 다르다
    const other = worldLooks(createEconomy(map, SEED, { warmupDays: 20, world: { seasonId: '2026-11-09', worldId: 'a' } }));
    expect(other.get('inn:0')).not.toEqual(a.get('inn:0'));
  });

  it('날이 가도 같은 사람은 같은 얼굴. 일을 바꾼 일꾼은 옷만 갈아입는다', () => {
    const s = world('a', 1);
    const jobs = new Map(s.workers.map((w) => [w.id, w.job]));
    const before = worldLooks(s);
    advanceDays(s, map, 10);
    const after = worldLooks(s);
    const body = (l: Look) => ({ ...l, parts: { ...l.parts, top: null, hat: null }, cloth: null, hatColor: null });
    let same = 0;
    let changed = 0;
    for (const w of s.workers) {
      const k = npcKey({ kind: 'worker', id: w.id });
      const a = before.get(k);
      if (!a) continue;
      if (jobs.get(w.id) === w.job) {
        same++;
        expect(after.get(k), k).toEqual(a);
      } else {
        changed++;
        expect(body(after.get(k)!), k).toEqual(body(a));
      }
    }
    expect(same).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(0);
    expect(after.get('elder:0')).toEqual(before.get('elder:0'));
  });

  it('지금 마을의 얼굴: 소문꾼, 여관 주인, 장 상인, 게시판 사람. 길 위에서는 없다', () => {
    const s = world('a', 1);
    // 소문꾼은 시즌 첫날 밤에 생긴다
    advanceDays(s, map, 1);
    const pid = Object.keys(s.players)[0]!;
    const p = s.players[pid]!;
    const faces = townFaces(s, map, pid)!;
    expect(faces.town).toBe(p.town);
    expect(faces.gossips.length).toBeGreaterThan(0);
    expect(faces.gossips.map((g) => g.id)).toEqual(s.rumorMill.gossips.filter((g) => g.town === p.town).map((g) => g.id));
    const looks = worldLooks(s);
    expect(faces.merchant).toEqual(looks.get(`market:${p.town}`));
    if (faces.innkeeper) expect(faces.innkeeper).toEqual(looks.get(`inn:${p.town}`));
    p.travel = { from: p.town, to: p.town, daysLeft: 1 } as never;
    expect(townFaces(s, map, pid)).toBeNull();
  });
});
