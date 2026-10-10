// NPC 외모 (기획서 "NPC 외모", 0.1.6 아바타 키트): 직업별 범위 안에서 시즌 시드 + NPC 번호로 뽑고, 한 세계 안에서 겹치지 않는다.
// 그림이 있는 파츠만 뽑는다. 새 파츠 그림이 들어오면(available에 더하면) 그대로 쓰인다.
import { describe, expect, it } from 'vitest';
import { advanceDays, createEconomy } from '../economy';
import { seasonSeed } from '../economy/worldRef';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { AVAILABLE_PARTS, CLOTH_COLORS, HAIR_COLORS, PARTS, REGION_PALETTE, SKINS } from './catalog';
import { assignLooks, drawLook, lookKey, npcKey, resolveChoices, rollLook } from './draw';
import { KIT_PARTS } from './kitParts';
import { COMMON_BEARDS, COMMON_HAIR, COMMON_OLD_HAIR, COMMON_TOPS, ROLE_RANGES, type PartChoice } from './roles';
import { hireFaces, townFaces, worldLooks, worldNpcs } from './roster';
import type { Look, LookRole, NpcEntry, RegionCode } from './types';

const SEED = 20261008;
const map = generateWorld(SEED, { towns: 6 });
const ROLES = Object.keys(ROLE_RANGES) as LookRole[];

/** 키트에 그림이 다 들어왔을 때 (새로 뽑을 파츠까지) */
const ALL_PARTS: ReadonlySet<string> = new Set(Object.keys(PARTS));

/** 한 직업을 여러 번 뽑는다 */
function many(role: LookRole, n = 400, available: ReadonlySet<string> = AVAILABLE_PARTS, seed = 7): Look[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rollLook(rng, rng, role, available));
}

const ids = (choices: readonly PartChoice[]) => choices.flatMap((c) => (typeof c === 'string' ? [c] : c));

describe('파츠 목록과 직업 범위', () => {
  it('직업 범위에 적힌 파츠는 모두 목록에 있고 종류가 맞다', () => {
    for (const role of ROLES) {
      const r = ROLE_RANGES[role];
      for (const id of ids(r.tops)) expect(PARTS[id]?.kind, `${role} ${id}`).toBe('top');
      for (const id of ids(r.hair ?? [])) expect(PARTS[id]?.kind, `${role} ${id}`).toBe('hair');
      for (const id of ids(r.beards ?? [])) expect(PARTS[id]?.kind, `${role} ${id}`).toBe('beard');
      for (const c of r.cloth) expect(CLOTH_COLORS).toHaveProperty(c);
    }
    for (const id of ids(COMMON_TOPS)) expect(PARTS[id]?.kind).toBe('top');
    for (const list of [COMMON_HAIR, COMMON_OLD_HAIR]) for (const id of ids([...list.male, ...list.female])) expect(PARTS[id]?.kind).toBe('hair');
    for (const id of ids(COMMON_BEARDS)) expect(PARTS[id]?.kind).toBe('beard');
  });

  it('상의는 직업 색을 입는 주 영역이 꼭 하나, 머리·수염은 1 = 머리색', () => {
    for (const [id, p] of Object.entries(PARTS)) {
      expect(id).toMatch(new RegExp(`^${p.kind}_\\d\\d$`));
      const kinds = Object.values(p.regions);
      if (p.kind === 'top') expect(kinds.filter((k) => k === 'main'), id).toHaveLength(1);
      else expect(p.regions, id).toEqual({ 1: 'hair' });
    }
  });

  it('그림이 있는 파츠 = 목록과 키트 둘 다에 있는 것. 지금 키트: 상의 03~09, 머리 01~03, 수염 없음', () => {
    for (const id of AVAILABLE_PARTS) {
      expect(PARTS).toHaveProperty(id);
      expect(KIT_PARTS).toContain(id);
    }
    expect([...AVAILABLE_PARTS].sort()).toEqual(['hair_01', 'hair_02', 'hair_03', 'top_03', 'top_04', 'top_05', 'top_06', 'top_07', 'top_08', 'top_09']);
  });

  it('"앞의 것이 없으면 뒤의 것": 어부는 top_13이 없으면 top_05, 들어오면 top_13', () => {
    expect(resolveChoices([['top_13', 'top_05'], 'top_03'], 'top', true, AVAILABLE_PARTS)).toEqual(['top_05', 'top_03']);
    expect(resolveChoices([['top_13', 'top_05'], 'top_03'], 'top', true, ALL_PARTS)).toEqual(['top_13', 'top_03']);
    const now = new Set(many('fisher').map((l) => l.top));
    expect(now).toEqual(new Set(['top_05', 'top_03']));
    const later = new Set(many('fisher', 400, ALL_PARTS).map((l) => l.top));
    expect(later).toEqual(new Set(['top_13', 'top_03']));
  });

  it('그림이 없는 파츠는 뽑지 않는다', () => {
    for (const role of ROLES) {
      for (const l of many(role, 200)) {
        for (const id of [l.top, l.hair, l.beard]) if (id) expect(AVAILABLE_PARTS.has(id), `${role} ${id}`).toBe(true);
      }
    }
    // 그림이 아주 적어도 있는 것 안에서만
    const few = new Set(['top_07', 'hair_02']);
    for (const role of ROLES) {
      for (const l of many(role, 50, few)) {
        expect(l.top).toBe('top_07');
        expect(l.hair).toBe('hair_02');
        expect(l.beard).toBeNull();
      }
    }
  });

  it('새 파츠 그림이 들어오면 범위에 적힌 직업이 쓴다 (여관 주인 top_10, 대장장이 top_11, 수염)', () => {
    expect(new Set(many('innkeeper', 200, ALL_PARTS).map((l) => l.top))).toEqual(new Set(['top_10']));
    expect(new Set(many('smith', 200, ALL_PARTS).map((l) => l.top))).toEqual(new Set(['top_11']));
    expect(many('fisher', 400, ALL_PARTS).some((l) => l.beard === 'beard_01')).toBe(true);
    const young = many('villager', 600, ALL_PARTS).filter((l) => !l.old);
    expect(new Set(young.filter((l) => l.male).map((l) => l.hair))).toEqual(new Set(['hair_01', 'hair_02', 'hair_04', 'hair_07']));
    expect(new Set(young.filter((l) => !l.male).map((l) => l.hair))).toEqual(new Set(['hair_01', 'hair_02', 'hair_05', 'hair_06', 'hair_07']));
  });

  it('누구나 쓰는 머리도 남자는 짧은 머리, 여자는 생머리가 잦다', () => {
    const young = ROLES.filter((r) => r !== 'elder').flatMap((r) => many(r, 200)).filter((l) => !l.old);
    const share = (male: boolean, hair: string) => {
      const of = young.filter((l) => l.male === male);
      return of.filter((l) => l.hair === hair).length / of.length;
    };
    expect(share(true, 'hair_01')).toBeGreaterThan(0.6);
    expect(share(false, 'hair_02')).toBeGreaterThan(0.6);
  });

  it('뽑은 외모는 그 직업 범위 안이다: 상의, 주 색은 직업 색, 다른 영역은 셔츠·가죽·털 색', () => {
    for (const available of [AVAILABLE_PARTS, ALL_PARTS]) {
      for (const role of ROLES) {
        const r = ROLE_RANGES[role];
        for (const l of many(role, 200, available)) {
          const tops = [...resolveChoices(r.tops, 'top', l.male, available), ...resolveChoices(COMMON_TOPS, 'top', l.male, available)];
          expect(tops, `${role} ${l.top}`).toContain(l.top);
          expect(SKINS).toHaveProperty(l.skin);
          for (const [code, kind] of Object.entries(PARTS[l.top]!.regions)) {
            const c = l.cloth[Number(code) as RegionCode]!;
            if (kind === 'main') expect(r.cloth, `${role} ${l.top} ${code}`).toContain(c);
            else if (kind !== 'hair') expect(REGION_PALETTE[kind]).toContain(c);
          }
          expect(Object.keys(l.cloth).sort()).toEqual(Object.keys(PARTS[l.top]!.regions).sort());
        }
      }
    }
    // 표의 예: 광부는 짙은 색, 어부는 쪽빛, 사냥꾼은 가죽 조끼
    for (const l of many('miner')) expect(['top_09', 'top_07']).toContain(l.top);
    for (const l of many('fisher')) expect(['indigo', 'deepIndigo']).toContain(l.cloth[1]);
    for (const l of many('hunter')) expect(l.top).toBe('top_09');
    for (const l of many('cityMerchant')) expect(['top_08', 'top_06']).toContain(l.top);
  });

  it('여자 얼굴은 수염·대머리가 없고, 남자 얼굴은 원피스·쪽머리·땋은 머리·숄이 없다', () => {
    let men = 0;
    let women = 0;
    for (const role of ROLES) {
      for (const l of many(role, 200, ALL_PARTS)) {
        if (l.male) men++;
        else women++;
        for (const id of [l.top, l.hair, l.beard]) {
          if (!id) continue;
          const who = PARTS[id]!.who;
          if (who !== 'any') expect(who, `${role} ${id}`).toBe(l.male ? 'male' : 'female');
        }
        if (!l.male) expect(l.beard).toBeNull();
      }
    }
    expect(men).toBeGreaterThan(0);
    expect(women).toBeGreaterThan(0);
  });

  it('여관 주인: 여자는 원피스, 남자는 앞치마 그림(top_10)이 오기 전까지 아무나 입는 상의', () => {
    for (const l of many('innkeeper')) expect(l.top).toEqual(l.male ? expect.stringMatching(/^top_0[37]$/) : 'top_04');
  });
});

describe('노인과 수염', () => {
  it('노상인은 언제나 노인: 흰머리, 더블릿이나 모피 깃 겉옷, 옆머리만 남은 대머리가 잦다', () => {
    const elders = many('elder', 400);
    for (const l of elders) {
      expect(l.old).toBe(true);
      expect(l.hairColor).toBe('gray');
      expect(['top_06', 'top_08']).toContain(l.top);
    }
    expect(elders.filter((l) => l.hair === 'hair_03').length / elders.length).toBeGreaterThan(0.45);
  });

  it('다른 사람은 25% 남짓이 노인이고, 노인은 흰머리, 젊은이는 흰머리가 아니다', () => {
    const all = ROLES.filter((r) => r !== 'elder').flatMap((r) => many(r, 300));
    const rate = all.filter((l) => l.old).length / all.length;
    expect(rate).toBeGreaterThan(0.2);
    expect(rate).toBeLessThan(0.3);
    for (const l of all) expect(l.hairColor === 'gray').toBe(l.old);
    for (const l of all) expect(HAIR_COLORS).toHaveProperty(l.hairColor);
  });

  it('지금 키트에는 수염 그림이 없어 수염이 나오지 않는다', () => {
    for (const role of ROLES) for (const l of many(role, 100)) expect(l.beard).toBeNull();
  });

  it('수염은 남자만, 직업마다 비율 (어부·대장장이·광부 50%, 도시 상인 30%, 나머지 15%)', () => {
    const rate = (role: LookRole) => {
      const men = many(role, 3000, ALL_PARTS).filter((l) => l.male);
      return men.filter((l) => l.beard).length / men.length;
    };
    for (const role of ['fisher', 'smith', 'miner'] as const) expect(rate(role)).toBeCloseTo(0.5, 1);
    expect(rate('cityMerchant')).toBeCloseTo(0.3, 1);
    for (const role of ['farmer', 'villager', 'innkeeper'] as const) expect(rate(role)).toBeCloseTo(0.15, 1);
    // 어부·대장장이·광부는 턱수염
    for (const l of many('fisher', 400, ALL_PARTS)) if (l.beard) expect(l.beard).toBe('beard_01');
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
    // 범위가 좁은 직업 300명: 처음 뽑기로는 반드시 겹친다
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

  it('새 그림이 들어와 상의 범위가 바뀌어도 생김새(피부, 나이, 머리색)는 밀리지 않는다', () => {
    const s = seasonSeed('2026-10-26');
    for (let id = 0; id < 50; id++) {
      const w: NpcEntry = { kind: 'worker', id, role: 'fisher' };
      const a = drawLook(s, w);
      const b = drawLook(s, w, 0, ALL_PARTS);
      expect({ skin: b.skin, old: b.old, male: b.male, hairColor: b.hairColor }).toEqual({ skin: a.skin, old: a.old, male: a.male, hairColor: a.hairColor });
    }
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
    // 노상인은 노인
    expect(looks.get('elder:0')!.old).toBe(true);
  });

  it('같은 시즌의 다른 세계(사람 수만 다름)에서 같은 NPC는 같은 얼굴', () => {
    const a = worldLooks(world('a', 3));
    const b = worldLooks(world('b', 12));
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
    // 다른 시즌이면 다르다
    const other = worldLooks(createEconomy(map, SEED, { warmupDays: 20, world: { seasonId: '2026-11-09', worldId: 'a' } }));
    expect(other.get('inn:0')).not.toEqual(a.get('inn:0'));
  });

  it('날이 가도 같은 사람은 같은 얼굴. 일을 바꾼 일꾼은 옷만 갈아입는다 (수염은 직업 비율에 따라 기르거나 깎을 수 있다)', () => {
    const s = world('a', 1);
    const jobs = new Map(s.workers.map((w) => [w.id, w.job]));
    const before = worldLooks(s);
    advanceDays(s, map, 10);
    const after = worldLooks(s);
    const body = (l: Look) => ({ skin: l.skin, old: l.old, male: l.male, hair: l.hair, hairColor: l.hairColor });
    let same = 0;
    let sameOutfit = 0;
    let changed = 0;
    for (const w of s.workers) {
      const k = npcKey({ kind: 'worker', id: w.id });
      const a = before.get(k);
      if (!a) continue;
      // 생김새는 언제나 그대로
      expect(body(after.get(k)!), k).toEqual(body(a));
      if (jobs.get(w.id) === w.job) {
        same++;
        if (lookKey(after.get(k)!) === lookKey(a)) sameOutfit++;
      } else changed++;
    }
    expect(same).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(0);
    // 일을 그대로 하는 사람도, 앞 차례 일꾼이 일을 바꿔 새 옷이 겹치면 옷만 다시 고른다(드물다)
    expect(sameOutfit / same).toBeGreaterThan(0.8);
    // 일꾼이 아닌 사람(노상인, 여관 주인, 장 상인, 소문꾼, 상단)은 일꾼보다 앞 차례라 그대로
    for (const [k, v] of before) if (!k.startsWith('worker:')) expect(after.get(k), k).toEqual(v);
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

  it('데려온 사람 얼굴은 길 위에서도 마을에서 본 얼굴과 같다', () => {
    const s = createEconomy(map, SEED);
    advanceDays(s, map, 1);
    const pid = Object.keys(s.players)[0]!;
    const p = s.players[pid]!;
    expect(hireFaces(s, pid)).toEqual({});
    const worker = s.workers[0]!;
    p.hires.push({ id: 1, worker } as never);
    const inTown = townFaces(s, map, pid)!.hires;
    expect(hireFaces(s, pid)).toEqual(inTown);
    p.travel = { from: p.town, to: p.town, daysLeft: 1 } as never;
    expect(hireFaces(s, pid)[1]).toEqual(inTown[1]);
  });
});
