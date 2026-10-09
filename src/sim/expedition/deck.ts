// 원정 덱 만들기 (기획서 "마을마다 다른 덱", "덱 짜기와 결과 규칙").
// 원정 한 번의 덱: 지형 6장 + 지역 특색 2장 + 계절 1~2장 + 사건 0~2장 + 내 카드 0~2장. 여기서 3~4장을 뽑는다.
import { ECONOMY, WORLDGEN } from '../constants';
import type { EconomyState, PlayerState } from '../economy/state';
import { shuffle, type Rng } from '../rng';
import { seasonOfDay } from '../season';
import { buildNeighbors, cellsAround, type RegionTagId, type WorldMap } from '../worldgen';
import { CARDS, cardById } from './cards';
import type { CardSource } from './types';

/** 사건 카드는 이만큼 지난 사건까지 부른다 */
export const EVENT_MEMORY_DAYS = 15;

const D = ECONOMY.expedition.deck;

/** 마을 주변 두 칸 안에 걸친 지역 특색 태그 */
export function tagsNearTown(map: WorldMap, townId: number): RegionTagId[] {
  const town = map.towns[townId]!;
  const area = new Set([town.tile, ...cellsAround(buildNeighbors(map.tiles), town.tile, WORLDGEN.specialtyRange)]);
  return [...new Set(map.regions.filter((r) => r.tiles.some((i) => area.has(i))).map((r) => r.tag))];
}

type Bucket = 'terrain' | 'tag' | 'season' | 'event';

/** 이 마을, 오늘 덱에 들어올 수 있는 카드 묶음 (카드는 copies만큼 들어 있다) */
export function deckPools(state: EconomyState, p: PlayerState, map: WorldMap, townId: number): Record<Bucket, string[]> {
  const town = state.towns[townId]!;
  const resources = new Set(town.nodes.map((n) => n.kind));
  const tags = new Set(tagsNearTown(map, townId));
  const season = seasonOfDay(state.day, state.startSeason);
  const events = new Set(town.recentEvents.filter((e) => state.day - e.day <= EVENT_MEMORY_DAYS).map((e) => e.kind));
  const horse = p.horses.length > 0;
  const matches = (s: CardSource): Bucket | null => {
    switch (s.kind) {
      case 'terrain':
        return resources.has(s.resource) ? 'terrain' : null;
      case 'tag':
        return tags.has(s.tag) ? 'tag' : null;
      case 'season':
        return s.season === season && resources.has(s.resource) ? 'season' : null;
      case 'event':
        return events.has(s.event) ? 'event' : null;
      default:
        return null;
    }
  };
  const pools: Record<Bucket, string[]> = { terrain: [], tag: [], season: [], event: [] };
  for (const card of CARDS) {
    if (card.needsHorse && !horse) continue;
    // 여러 조건에 걸리면 앞의 묶음 하나에만 넣는다 (같은 카드가 두 묶음에서 겹쳐 뽑히지 않게)
    const bucket = card.sources.map(matches).find((b) => b !== null);
    if (!bucket) continue;
    for (let i = 0; i < (card.copies ?? 1); i++) pools[bucket].push(card.id);
  }
  return pools;
}

function take(pool: string[], n: number, rng: Rng): string[] {
  return shuffle([...pool], rng).slice(0, Math.max(0, n));
}

/** 덱에 들어온 카드가 다른 카드를 늘리거나 줄인다 (막힌 갱도, 굶주린 늑대 등) */
function applyDeckChanges(deck: string[]): string[] {
  const out = [...deck];
  for (const id of deck) {
    const change = cardById(id).deckChange;
    if (!change) continue;
    for (const [rid, n] of Object.entries(change.remove ?? {})) {
      for (let i = 0; i < n; i++) {
        const at = out.indexOf(rid);
        if (at >= 0) out.splice(at, 1);
      }
    }
    for (const [aid, n] of Object.entries(change.add ?? {})) for (let i = 0; i < n; i++) out.push(aid);
  }
  return out;
}

export interface BuiltDeck {
  /** 섞은 덱 (맨 앞이 먼저) */
  deck: string[];
  /** 덱에 넣은 내 카드가 남겨진 날 (놓아 둔 덫이 오래되면 빈다) */
  markDays: Record<string, number>;
}

/**
 * 이 마을 원정 덱. 내가 남긴 카드는 덱에 넣으면서 남긴 표시를 지운다 (2장까지, 나머지는 다음에).
 * 말과 함께 가면 말 카드가 내 카드 자리에 들어온다
 */
export function buildDeck(state: EconomyState, p: PlayerState, map: WorldMap, townId: number, rng: Rng): BuiltDeck {
  const pools = deckPools(state, p, map, townId);
  const parts: string[] = [
    ...take(pools.terrain, D.terrain, rng),
    ...take(pools.tag, D.tag, rng),
    ...take(pools.season, rng.int(D.season[0], D.season[1]), rng),
    // 신문에 실린 사건이 있으면 그 카드가 2장까지 들어온다 (없으면 0장)
    ...take(pools.event, D.event[1], rng),
  ];

  // 내 카드: 남겨 둔 것은 늘 들어오고(2장까지), 자리가 남으면 말 카드
  const maxMine = rng.int(D.mine[0], D.mine[1]);
  const used = p.marks.filter((m) => m.town === townId).slice(0, D.mine[1]);
  p.marks = p.marks.filter((m) => !used.includes(m));
  const markDays: Record<string, number> = {};
  for (const m of used) {
    parts.push(m.card);
    markDays[m.card] = Math.min(markDays[m.card] ?? Infinity, m.day);
  }
  const horseCards = CARDS.filter((c) => c.sources.some((s) => s.kind === 'horse'));
  if (p.horses.length && used.length < maxMine) parts.push(...take(horseCards.map((c) => c.id), maxMine - used.length, rng));

  return { deck: shuffle(applyDeckChanges(parts), rng), markDays };
}
