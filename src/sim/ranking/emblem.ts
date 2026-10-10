// 상단 문장 (기획서 "게임 시작 화면과 부품", 0.1.7 답 130): 방패 모양, 바탕 색 둘, 나눔 무늬, 가운데 상징과 그 색.
// 방패 모양과 상징은 그림(회색조, 색은 화면이 곱한다)이고, 나눔 무늬는 화면이 방패 모양으로 잘라 그리는 도형이다.
// 그림이 오기 전에는 방패를 도형으로, 상징을 이름 글자로 그린다 (src/ui/emblem.ts). 여기는 고른 값만 다룬다.
import { createRng, type Rng } from '../rng';

/** 방패 모양 5 (그림 이름: shield_<id>, docs/reference/emblem-horse-prompts.md) */
export const SHIELDS = {
  heater: '전통 방패',
  round: '둥근 방패',
  kite: '연 모양 방패',
  banner: '걸개 깃발',
  oval: '타원 방패',
} as const;
export type ShieldId = keyof typeof SHIELDS;
export const SHIELD_IDS = Object.keys(SHIELDS) as ShieldId[];

/** 나눔 무늬: 바탕 색 둘을 나누는 도형 (코드로 그린다) */
export const DIVISIONS = {
  none: '없음',
  pale: '세로 반',
  fess: '가로 반',
  bend: '대각 반',
  band: '띠',
  cross: '십자',
  chevron: '갈매기',
  checky: '체크',
} as const;
export type DivisionId = keyof typeof DIVISIONS;
export const DIVISION_IDS = Object.keys(DIVISIONS) as DivisionId[];

/** 가운데 상징 10 (그림 이름: sym_<id>). 물품·장사 상징 */
export const SYMBOLS = {
  wheat: '밀 이삭',
  salt: '소금',
  horse: '말',
  key: '열쇠',
  scales: '저울',
  ship: '돛단배',
  fish: '물고기',
  hammer: '망치',
  antler: '사슴뿔',
  purse: '돈주머니',
} as const;
export type SymbolId = keyof typeof SYMBOLS;
export const SYMBOL_IDS = Object.keys(SYMBOLS) as SymbolId[];

/** 문장 색 (초안, 게임 팔레트에서). 바탕 둘과 상징 하나에 쓴다 */
export const EMBLEM_COLORS = {
  cream: { name: '크림', hex: '#f1e2c6' },
  amber: { name: '황금', hex: '#e6b43c' },
  coral: { name: '코랄', hex: '#d2594b' },
  wax: { name: '밀랍 빨강', hex: '#9e3a2c' },
  teal: { name: '청록', hex: '#2e9c98' },
  indigo: { name: '쪽빛', hex: '#3f5a8a' },
  olive: { name: '올리브', hex: '#7d8a2e' },
  plum: { name: '자주', hex: '#7a4a72' },
  wood: { name: '나무', hex: '#6b4a32' },
  ink: { name: '먹', hex: '#3a2b22' },
} as const;
export type EmblemColorId = keyof typeof EMBLEM_COLORS;
export const EMBLEM_COLOR_IDS = Object.keys(EMBLEM_COLORS) as EmblemColorId[];

/** 밝은 색 (상징이 바탕과 겹쳐 안 보이지 않게, 추천은 밝은 색과 짙은 색을 엇갈린다) */
const LIGHT: ReadonlySet<EmblemColorId> = new Set(['cream', 'amber']);

export interface Emblem {
  shield: ShieldId;
  /** 바탕 색 둘: [0]은 바탕, [1]은 나눔 무늬의 다른 쪽 (나눔 무늬가 없으면 쓰지 않는다) */
  field: [EmblemColorId, EmblemColorId];
  division: DivisionId;
  symbol: SymbolId;
  symbolColor: EmblemColorId;
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(0, items.length - 1)]!;

/**
 * 추천 문장: 바탕 둘은 다른 색, 상징은 바탕과 밝기가 반대인 색 (그대로 넘어가도 보기 좋게).
 * symbol을 주면 그 상징으로 (봇 상단 이름에 든 말)
 */
export function rollEmblem(rng: Rng, symbol?: SymbolId): Emblem {
  const a = pick(rng, EMBLEM_COLOR_IDS);
  const b = pick(
    rng,
    EMBLEM_COLOR_IDS.filter((c) => c !== a && LIGHT.has(c) !== LIGHT.has(a)),
  );
  const division = pick(rng, DIVISION_IDS);
  // 나눔 무늬가 있으면 두 바탕 모두와 다른 색, 없으면 바탕과 밝기가 반대인 색
  const symbolColor = pick(
    rng,
    EMBLEM_COLOR_IDS.filter((c) => c !== a && c !== b && (division !== 'none' || LIGHT.has(c) !== LIGHT.has(a))),
  );
  return { shield: pick(rng, SHIELD_IDS), field: [a, b], division, symbol: symbol ?? pick(rng, SYMBOL_IDS), symbolColor };
}

/** 받은 문장이 고를 수 있는 값으로만 되어 있나 (명령으로 들어온 값) */
export function isEmblem(e: unknown): e is Emblem {
  if (!e || typeof e !== 'object') return false;
  const x = e as Partial<Emblem>;
  return (
    typeof x.shield === 'string' &&
    x.shield in SHIELDS &&
    Array.isArray(x.field) &&
    x.field.length === 2 &&
    x.field.every((c) => typeof c === 'string' && c in EMBLEM_COLORS) &&
    typeof x.division === 'string' &&
    x.division in DIVISIONS &&
    typeof x.symbol === 'string' &&
    x.symbol in SYMBOLS &&
    typeof x.symbolColor === 'string' &&
    x.symbolColor in EMBLEM_COLORS
  );
}

/** 0.1.6까지의 문장(이름 하나)에 가까운 상징. 없는 것은 null */
const OLD_CREST_SYMBOL: Record<string, SymbolId | null> = {
  plain: null,
  crow: null,
  fox: null,
  fish: 'fish',
  oak: null,
  sail: 'ship',
  anvil: 'hammer',
  wheat: 'wheat',
  deer: 'antler',
  anchor: 'ship',
  owl: null,
  salt: 'salt',
};

/** 예전 저장의 문장(crest)을 새 문장으로: 가까운 상징이 있으면 그것, 색과 모양은 시드로 */
export function emblemFromCrest(crest: string | undefined, seed: number): Emblem {
  return rollEmblem(createRng(seed), OLD_CREST_SYMBOL[crest ?? ''] ?? undefined);
}

/** 상단 이름에 든 말로 상징을 고른다 (봇 상단: "은빛 송어 상단" → 물고기). 없으면 null */
const NAME_SYMBOL: readonly [string, SymbolId][] = [
  ['송어', 'fish'],
  ['돛', 'ship'],
  ['닻', 'ship'],
  ['모루', 'hammer'],
  ['못', 'hammer'],
  ['보리', 'wheat'],
  ['사슴', 'antler'],
  ['소금', 'salt'],
  ['저울', 'scales'],
  ['염소', 'antler'],
];

export function symbolFromName(name: string): SymbolId | null {
  return NAME_SYMBOL.find(([w]) => name.includes(w))?.[1] ?? null;
}
