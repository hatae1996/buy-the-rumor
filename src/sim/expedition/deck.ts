// 원정 덱 만들기: 지형 기본 + 지역 특색 태그 + 계절 + 최근 사건 + 내가 남긴 카드 (기획서 "마을마다 다른 덱").
import { WORLDGEN } from '../constants';
import type { EconomyState } from '../economy/state';
import { seasonOfDay } from '../season';
import { buildNeighbors, cellsAround, type RegionTagId, type WorldMap } from '../worldgen';
import { CARDS } from './cards';

/** 사건 카드는 이만큼 지난 사건까지 부른다 */
export const EVENT_MEMORY_DAYS = 15;

/** 마을 주변 두 칸 안에 걸친 지역 특색 태그 */
export function tagsNearTown(map: WorldMap, townId: number): RegionTagId[] {
  const town = map.towns[townId]!;
  const area = new Set([town.tile, ...cellsAround(buildNeighbors(map.tiles), town.tile, WORLDGEN.specialtyRange)]);
  return [...new Set(map.regions.filter((r) => r.tiles.some((i) => area.has(i))).map((r) => r.tag))];
}

/**
 * 이 마을 원정 덱의 카드 id 목록 (섞기 전).
 * 내가 남긴 카드(놓아 둔 덫 등)는 덱에 넣으면서 남긴 표시를 지운다
 */
export function buildDeck(state: EconomyState, map: WorldMap, townId: number): string[] {
  const town = state.towns[townId]!;
  const resources = new Set(town.nodes.map((n) => n.kind));
  const tags = new Set(tagsNearTown(map, townId));
  const season = seasonOfDay(state.day, state.startSeason);
  const events = new Set(town.recentEvents.filter((e) => state.day - e.day <= EVENT_MEMORY_DAYS).map((e) => e.kind));
  const p = state.player;
  const mine = p.marks.filter((m) => m.town === townId).map((m) => m.card);
  p.marks = p.marks.filter((m) => m.town !== townId);

  const deck: string[] = [];
  for (const card of CARDS) {
    const fromMine = mine.filter((id) => id === card.id).length;
    const included = card.sources.some((s) => {
      switch (s.kind) {
        case 'terrain':
          return resources.has(s.resource);
        case 'tag':
          return tags.has(s.tag);
        case 'season':
          return s.season === season && resources.has(s.resource);
        case 'event':
          return events.has(s.event);
        case 'linked':
        case 'mine':
          return false;
      }
    });
    const copies = (included ? (card.copies ?? 1) : 0) + fromMine;
    for (let i = 0; i < copies; i++) deck.push(card.id);
  }
  return deck;
}
