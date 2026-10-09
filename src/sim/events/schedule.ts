// 시즌을 만들 때 시드로 사건 일정을 짠다 (기획서 "사건" 규칙).
// 시즌에 6~10개, 하루 최대 1개, 같은 물품 악재 연달아 금지, 시즌 마지막 2일에는 없음, 절반쯤은 1~3일 전 징조.
import { ECONOMY } from '../constants';
import type { EconomyState } from '../economy/state';
import { createRng, mixSeed, shuffle, type Rng } from '../rng';
import { CYCLE_DAYS, seasonOfDay } from '../season';
import { buildNeighbors, cellsAround, townScale, townsNearTag, type WorldMap } from '../worldgen';
import { badGoods, SCHEDULED_DEFS } from './defs';
import { pickTheme } from '../ranking/quests';
import type { EventDef, FakeOmen, ScheduledEvent, ScheduledEventId, SeasonState } from './types';

const E = ECONOMY.events;

export function createSeason(state: EconomyState, map: WorldMap, number: number, startDay: number): SeasonState {
  const rng = createRng(mixSeed(state.seed, 0x5ea5, number));
  const length = CYCLE_DAYS;
  const first = startDay + E.quietFirstDays;
  const last = startDay + length - 1 - E.quietLastDays;
  const nbs = buildNeighbors(map.tiles);

  // 마을 4곳 맵의 수. 마을이 늘면 같은 비율로 (0.1.1: 마을마다 사건이 드물어지지 않게)
  const scale = townScale(map.towns.length);
  const count = rng.int(Math.round(E.perSeason[0] * scale), Math.round(E.perSeason[1] * scale));
  const days = shuffle(
    Array.from({ length: last - first + 1 }, (_, i) => first + i),
    rng,
  )
    .slice(0, count)
    .sort((a, b) => a - b);

  const schedule: ScheduledEvent[] = [];
  let lastBad: string[] = [];
  // 시즌 끝까지 가는 사건은 같은 마을에 한 번만
  const longOnce = new Set<string>();
  for (const day of days) {
    const options = SCHEDULED_DEFS.flatMap((def) =>
      eligibleTowns(def, state, map, nbs, day)
        .filter((town) => !(def.days === 'season' && longOnce.has(`${def.id}:${town}`)))
        .map((town) => ({ def, town, weight: weightOf(def, state, map, day) })),
    ).filter((o) => o.weight > 0 && !badGoods(o.def).some((g) => lastBad.includes(g)));
    const pick = weightedPick(options, rng);
    if (!pick) continue;
    const { def, town } = pick;
    const ev: ScheduledEvent = { event: def.id as ScheduledEventId, town, day, omenDay: null };
    if (def.goods) ev.good = def.goods[rng.int(0, def.goods.length - 1)]!;
    const tiles = roadTilesToBlock(def, map, nbs, town, rng);
    if (tiles) ev.tiles = tiles;
    const lead = def.omenLead ?? E.omenLead;
    if (def.omen && rng.next() < (def.omenShare ?? E.omenShare)) ev.omenDay = Math.max(startDay, day - rng.int(lead[0], lead[1]));
    schedule.push(ev);
    if (def.days === 'season') longOnce.add(`${def.id}:${town}`);
    const bad = badGoods(def);
    if (bad.length) lastBad = bad;
  }

  // 헛징조: 소문은 돌지만 사건은 일어나지 않는다
  const fakeOmens: FakeOmen[] = [];
  const fakes = rng.int(Math.round(E.fakeOmens[0] * scale), Math.round(E.fakeOmens[1] * scale));
  for (let i = 0; i < fakes; i++) {
    const day = rng.int(startDay, last);
    const options = SCHEDULED_DEFS.filter((d) => d.omen).flatMap((def) =>
      eligibleTowns(def, state, map, nbs, day).map((town) => ({ def, town, weight: def.fakeOmenWeight ?? 1 })),
    );
    const pick = weightedPick(options, rng);
    if (pick) fakeOmens.push({ event: pick.def.id as ScheduledEventId, town: pick.town, day });
  }

  // 시즌 테마는 시작 계절, 마을 특색과 함께 정한다 (기획서 "길드 의뢰"). 일정과 다른 난수를 쓴다
  const resources = new Set(state.towns.flatMap((t) => t.nodes.map((n) => n.kind)));
  const theme = pickTheme(state.seed, number, seasonOfDay(startDay, state.startSeason), resources);
  return { number, startDay, length, theme, schedule, fakeOmens, log: [] };
}

/** 이 사건이 그날 일어날 수 있는 마을들 (계절, 자원지, 특색, 규모, 산길 조건) */
export function eligibleTowns(def: EventDef, state: EconomyState, map: WorldMap, nbs: readonly number[][], day: number): number[] {
  const season = seasonOfDay(day, state.startSeason);
  if (def.seasons && !def.seasons.includes(season)) return [];
  const n = def.needs ?? {};
  const tagged = n.tag ? new Set(townsNearTag(map, nbs, n.tag)) : null;
  return map.towns
    .filter((t) => {
      if (n.tier && t.tier !== n.tier) return false;
      if (n.resource && !state.towns[t.id]!.nodes.some((x) => x.kind === n.resource)) return false;
      if (tagged && !tagged.has(t.id)) return false;
      if (n.highlandRoad && roadTilesNear(map, nbs, t.id, 'highland').length === 0) return false;
      return true;
    })
    .map((t) => t.id);
}

function weightOf(def: EventDef, state: EconomyState, map: WorldMap, day: number): number {
  const w = def.weight ?? 1;
  const base = typeof w === 'number' ? w : w[seasonOfDay(day, state.startSeason)];
  // 도시에서만 나는 사건의 무게는 생산 마을 3곳·도시 1곳 맵에 맞췄다. 도시 하나가 맡는 생산 마을 수에 맞춰 키운다
  if (def.needs?.tier !== 'city') return base;
  const cities = map.towns.filter((t) => t.tier === 'city').length;
  const producersPerCity = (map.towns.length - cities) / cities;
  return producersPerCity === 3 ? base : (base * producersPerCity) / 3;
}

function roadTilesNear(map: WorldMap, nbs: readonly number[][], town: number, terrain: 'highland' | 'any'): number[] {
  const townTiles = new Set(map.towns.map((t) => t.tile));
  return cellsAround(nbs, map.towns[town]!.tile, E.blockRange)
    .filter((i) => map.tiles[i]!.road && !townTiles.has(i))
    .filter((i) => terrain === 'any' || map.tiles[i]!.terrain === 'hills' || map.tiles[i]!.terrain === 'mountain')
    .sort((a, b) => a - b);
}

function roadTilesToBlock(def: EventDef, map: WorldMap, nbs: readonly number[][], town: number, rng: Rng): number[] | null {
  const block = def.effects.find((e) => e.kind === 'blockRoads');
  if (!block || block.kind !== 'blockRoads') return null;
  const tiles = roadTilesNear(map, nbs, town, block.terrain);
  if (block.count === 'all') return tiles;
  return shuffle(tiles, rng).slice(0, block.count).sort((a, b) => a - b);
}

function weightedPick<T extends { weight: number }>(options: readonly T[], rng: Rng): T | null {
  const total = options.reduce((s, o) => s + o.weight, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const o of options) {
    r -= o.weight;
    if (r < 0) return o;
  }
  return options[options.length - 1]!;
}
