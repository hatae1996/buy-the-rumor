// 외모 뽑기: NPC 외모 = 시즌 시드 + NPC 번호 (기획서 "NPC 외모"). 같은 시즌의 모든 세계에서 같은 NPC는 같은 얼굴이다.
// 한 세계 안에서 같은 조합이 두 번 나오면 그 NPC만 다시 뽑는다. 세계 난수를 쓰지 않아 다른 결과를 바꾸지 않는다.
// 그림이 있는 파츠(available)만 뽑는다. 기본값은 키트에 그림이 있는 파츠(catalog.ts의 AVAILABLE_PARTS)라서
// 서버와 화면이 같은 빌드면 같은 얼굴이 나온다.
import { createRng, mixSeed, type Rng } from '../rng';
import { AVAILABLE_PARTS, OLD_RATE, PARTS, REGION_PALETTE, SKINS, YOUNG_HAIR_COLORS } from './catalog';
import { beardRate, COMMON_BEARDS, COMMON_HAIR, COMMON_OLD_HAIR, COMMON_TOPS, maleRate, ROLE_RANGES, type PartChoice } from './roles';
import type { ClothColorId, Look, LookRole, NpcEntry, NpcKind, PartKind, RegionCode, SkinId } from './types';

/** 같은 NPC 번호에 대해 몇 번까지 다시 뽑나 (넘으면 겹친 채로 둔다) */
const MAX_REDRAWS = 40;
/**
 * 겹쳤을 때 처음 몇 번은 옷차림만 다시 뽑는다. 얼굴이 하나라 조합이 겹치기 쉬운데,
 * 일을 바꾼 일꾼이 새 옷 때문에 누군가와 겹쳐도 생김새는 그대로 두려고
 */
const OUTFIT_REDRAWS = 12;

const KIND_CODE: Record<NpcKind, number> = { elder: 1, inn: 2, market: 3, gossip: 4, trader: 5, worker: 6 };

const SKIN_IDS = Object.keys(SKINS) as SkinId[];

/** [0, 1) 수 하나로 목록에서 고른다. 빈 목록이면 null */
function pickAt<T>(items: readonly T[], u: number): T | null {
  return items.length ? items[Math.floor(u * items.length)]! : null;
}

/** 이 사람이 쓸 수 있는 파츠: 그림이 있고, 여자·남자에 맞는다 */
function usable(id: string, kind: PartKind, male: boolean, available: ReadonlySet<string>): boolean {
  const p = PARTS[id];
  if (!p || p.kind !== kind || !available.has(id)) return false;
  return p.who === 'any' || (p.who === 'male') === male;
}

/** 목록의 칸마다 쓸 수 있는 첫 파츠. 쓸 수 있는 것이 없는 칸은 빠진다 */
export function resolveChoices(choices: readonly PartChoice[], kind: PartKind, male: boolean, available: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const c of choices) {
    const id = (typeof c === 'string' ? [c] : c).find((i) => usable(i, kind, male, available));
    if (id) out.push(id);
  }
  return out;
}

/** 범위에서 쓸 수 있는 것이 하나도 없으면 다음 범위로. 끝까지 없으면 그 종류의 그림 있는 파츠 모두 */
function rangeOf(kind: PartKind, male: boolean, available: ReadonlySet<string>, ...ranges: (readonly PartChoice[])[]): string[] {
  for (const r of ranges) {
    const ids = resolveChoices(r, kind, male, available);
    if (ids.length) return ids;
  }
  return resolveChoices(Object.keys(PARTS), kind, male, available);
}

/**
 * 범위에서 고른다. 생김새(여자·남자, 피부, 나이, 머리, 수염)와 옷차림(상의, 옷 색)은 난수를 따로 써서,
 * 일꾼이 일을 바꾸면 옷만 갈아입고 얼굴은 그대로다(수염만은 직업마다 비율이 달라 기르거나 깎을 수 있다).
 * 난수는 범위와 상관없이 같은 개수를 먼저 뽑아 둔다: 그림이 새로 들어와 범위가 바뀌어도 다른 항목은 밀리지 않는다
 */
export function rollLook(body: Rng, outfit: Rng, role: LookRole, available: ReadonlySet<string> = AVAILABLE_PARTS): Look {
  const r = ROLE_RANGES[role];
  const [uMale, uSkin, uOld, uHairColor, uHair, uBeard, uBeardStyle] = Array.from({ length: 7 }, () => body.next()) as [number, number, number, number, number, number, number];
  const [uTop, ...uCloth] = Array.from({ length: 4 }, () => outfit.next()) as [number, number, number, number];

  const male = uMale < maleRate(role);
  const old = r.alwaysOld === true || uOld < OLD_RATE;
  const sex = male ? 'male' : 'female';
  const hairRange = rangeOf('hair', male, available, r.hair ?? (old ? COMMON_OLD_HAIR : COMMON_HAIR)[sex], COMMON_HAIR[sex]);
  const beards = male && uBeard < beardRate(role) ? resolveChoices(r.beards ?? COMMON_BEARDS, 'beard', male, available) : [];

  const top = pickAt(rangeOf('top', male, available, r.tops, COMMON_TOPS), uTop);
  if (!top) throw new Error('그림이 있는 상의가 없다 (npm run portraits)');
  const cloth: Look['cloth'] = {};
  for (const [code, kind] of Object.entries(PARTS[top]!.regions)) {
    if (kind === 'hair') continue;
    const palette: readonly ClothColorId[] = kind === 'main' ? r.cloth : REGION_PALETTE[kind];
    const c = Number(code) as RegionCode;
    cloth[c] = pickAt(palette, uCloth[c - 1]!)!;
  }

  return {
    skin: pickAt(SKIN_IDS, uSkin)!,
    old,
    male,
    hair: pickAt(hairRange, uHair),
    hairColor: old ? 'gray' : pickAt(YOUNG_HAIR_COLORS, uHairColor)!,
    top,
    cloth,
    beard: pickAt(beards, uBeardStyle),
  };
}

/** NPC 한 명의 n번째 뽑기 (n = 0이 처음) */
export function drawLook(seasonSeed: number, npc: NpcEntry, redraw = 0, available: ReadonlySet<string> = AVAILABLE_PARTS): Look {
  const seed = (n: number, part: number) => createRng(mixSeed(seasonSeed, 0x1007, KIND_CODE[npc.kind], npc.id, n, part));
  return rollLook(seed(redraw <= OUTFIT_REDRAWS ? 0 : redraw, 1), seed(redraw, 2), npc.role, available);
}

/** 겹침을 가리는 열쇠: 그림에 보이는 것만 (여자·남자 표시는 그림에 따로 보이지 않는다) */
export function lookKey(look: Look): string {
  const cloth = ([1, 2, 3] as const).map((c) => look.cloth[c] ?? '-').join('.');
  return `${look.skin}|${look.old ? 'old' : 'young'}|${look.hair ?? '-'}|${look.hairColor}|${look.top}|${cloth}|${look.beard ?? '-'}`;
}

export function npcKey(npc: { kind: NpcKind; id: number }): string {
  return `${npc.kind}:${npc.id}`;
}

/** NPC를 정해진 차례로 세우기: 노상인 → 여관 주인 → 장 상인 → 소문꾼 → 상단 → 일꾼, 같은 종류는 번호순 */
export function npcOrder(a: NpcEntry, b: NpcEntry): number {
  return KIND_CODE[a.kind] - KIND_CODE[b.kind] || a.id - b.id;
}

/**
 * 세계의 NPC 모두에게 얼굴을 준다. 앞 차례부터 뽑고, 앞사람과 같은 조합이면 다시 뽑는다.
 * 앞 차례(처음부터 있던 사람)의 얼굴은 뒤에 사람이 늘어도 바뀌지 않는다
 */
export function assignLooks(seasonSeed: number, npcs: readonly NpcEntry[], available: ReadonlySet<string> = AVAILABLE_PARTS): Map<string, Look> {
  const out = new Map<string, Look>();
  const used = new Set<string>();
  for (const npc of [...npcs].sort(npcOrder)) {
    let look = drawLook(seasonSeed, npc, 0, available);
    for (let n = 1; used.has(lookKey(look)) && n <= MAX_REDRAWS; n++) look = drawLook(seasonSeed, npc, n, available);
    used.add(lookKey(look));
    out.set(npcKey(npc), look);
  }
  return out;
}
