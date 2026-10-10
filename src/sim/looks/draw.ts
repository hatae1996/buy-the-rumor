// 외모 뽑기: NPC 외모 = 시즌 시드 + NPC 번호 (기획서 "NPC 외모"). 같은 시즌의 모든 세계에서 같은 NPC는 같은 얼굴이다.
// 한 세계 안에서 같은 조합이 두 번 나오면 그 NPC만 다시 뽑는다. 세계 난수를 쓰지 않아 다른 결과를 바꾸지 않는다.
import { createRng, mixSeed, type Rng } from '../rng';
import { HAIR_STYLES, LAYERS } from './catalog';
import { colorRange, hairStyleRange, partRange } from './roles';
import type { LayerId, Look, LookRole, NpcEntry, NpcKind } from './types';

/** 같은 NPC 번호에 대해 몇 번까지 다시 뽑나 (넘으면 겹친 채로 둔다) */
const MAX_REDRAWS = 40;

const KIND_CODE: Record<NpcKind, number> = { elder: 1, inn: 2, market: 3, gossip: 4, trader: 5, worker: 6 };

/** 옷차림 레이어: 직업이 바뀌면 이것만 바뀐다 */
export const OUTFIT_LAYERS: readonly LayerId[] = ['top', 'hat'];

/**
 * 범위에서 고른다. 생김새(얼굴, 머리, 피부)와 옷차림(상의, 모자, 옷 색)은 난수를 따로 써서,
 * 일꾼이 일을 바꾸면 옷만 갈아입고 얼굴은 그대로다
 */
export function rollLook(body: Rng, outfit: Rng, role: LookRole): Look {
  const parts = {} as Record<LayerId, string | null>;
  for (const l of LAYERS) {
    if (l.id === 'frontHair' || l.id === 'backHair') continue;
    parts[l.id] = (OUTFIT_LAYERS.includes(l.id) ? outfit : body).pick(partRange(role, l.id));
  }
  // 머리는 앞·뒤 한 벌로 (0.1.5)
  const hair = HAIR_STYLES[body.pick(hairStyleRange(role))];
  parts.frontHair = hair.front;
  parts.backHair = hair.back;
  const c = colorRange(role);
  return { parts, skin: body.pick(c.skin), hair: body.pick(c.hair), cloth: outfit.pick(c.cloth), hatColor: outfit.pick(c.hatColor) };
}

/** NPC 한 명의 n번째 뽑기 (n = 0이 처음) */
export function drawLook(seasonSeed: number, npc: NpcEntry, redraw = 0): Look {
  const seed = (part: number) => createRng(mixSeed(seasonSeed, 0x1007, KIND_CODE[npc.kind], npc.id, redraw, part));
  return rollLook(seed(1), seed(2), npc.role);
}

/** 겹침을 가리는 열쇠: 보이는 것만 (모자가 없으면 모자 색은 보이지 않는다) */
export function lookKey(look: Look): string {
  const parts = LAYERS.map((l) => look.parts[l.id] ?? '-').join('.');
  return `${parts}|${look.skin}|${look.hair}|${look.cloth}|${look.parts.hat ? look.hatColor : '-'}`;
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
export function assignLooks(seasonSeed: number, npcs: readonly NpcEntry[]): Map<string, Look> {
  const out = new Map<string, Look>();
  const used = new Set<string>();
  for (const npc of [...npcs].sort(npcOrder)) {
    let look = drawLook(seasonSeed, npc);
    for (let n = 1; used.has(lookKey(look)) && n <= MAX_REDRAWS; n++) look = drawLook(seasonSeed, npc, n);
    used.add(lookKey(look));
    out.set(npcKey(npc), look);
  }
  return out;
}
