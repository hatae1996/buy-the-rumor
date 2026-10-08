// 말은 시즌마다 정해진 수만 있다 (기획서 "말"): 시즌 시작 때 총수와 입고 일정을 시드로 정하고,
// 목장 마을 마구간에 며칠 간격으로 몇 마리씩 푼다. 봄에는 망아지가 조금 더 나온다.
// 목장 화재 같은 사건이 있는 동안은 입고가 미뤄진다.
import { HORSES, WORLDGEN } from '../constants';
import type { EconomyState } from '../economy/state';
import { horseDelayAt } from '../events/active';
import { createRng, mixSeed, type Rng } from '../rng';
import { SPRING, seasonOfDay } from '../season';
import { buildNeighbors, townsNearTag, type WorldMap } from '../worldgen';
import type { HorseArrival, HorseKind, HorseMarket, Stable } from './types';

export const HORSE_KINDS = Object.keys(HORSES.kinds) as HorseKind[];

export function emptyStock(): Record<HorseKind, number> {
  return Object.fromEntries(HORSE_KINDS.map((k) => [k, 0])) as Record<HorseKind, number>;
}

export function emptyHorseMarket(): HorseMarket {
  return { season: 0, stables: [], arrivals: [], arrived: [], nextId: 1 };
}

const stableCache = new WeakMap<WorldMap, number[]>();

/** 마구간이 있는 마을: 목장 특색 근처의 생산 마을, 맵마다 WORLDGEN.ranchTowns곳 (맵 생성이 보장한다) */
export function stableTowns(map: WorldMap): number[] {
  let towns = stableCache.get(map);
  if (towns) return towns;
  const near = townsNearTag(map, buildNeighbors(map.tiles), 'ranch');
  const producers = near.filter((id) => map.towns[id]!.tier === 'town');
  towns = (producers.length ? producers : near).slice(0, WORLDGEN.ranchTowns);
  stableCache.set(map, towns);
  return towns;
}

function pickKind(rng: Rng): HorseKind {
  const total = HORSE_KINDS.reduce((s, k) => s + HORSES.kindWeight[k], 0);
  let r = rng.next() * total;
  for (const k of HORSE_KINDS) {
    r -= HORSES.kindWeight[k];
    if (r < 0) return k;
  }
  return HORSE_KINDS[HORSE_KINDS.length - 1]!;
}

/** 시즌 입고 일정. 같은 시드와 시즌이면 같다 */
export function scheduleArrivals(
  seed: number,
  season: { number: number; startDay: number; length: number },
  startSeason: Parameters<typeof seasonOfDay>[1],
  towns: readonly number[],
  players: number = HORSES.localPlayers,
): HorseArrival[] {
  if (!towns.length) return [];
  const rng = createRng(mixSeed(seed, 0x4053, season.number));
  const out: HorseArrival[] = [];
  let left = rng.int(HORSES.perPlayer[0], HORSES.perPlayer[1]) * players;
  const last = season.startDay + season.length - 1 - HORSES.quietLastDays;
  let day = season.startDay + rng.int(0, HORSES.firstWithin - 1);
  while (left > 0 && day <= last) {
    const count = Math.min(left, rng.int(HORSES.batch[0], HORSES.batch[1]));
    left -= count;
    const town = rng.pick(towns);
    // 같은 날 같은 마구간에 한 종류씩
    const kinds = new Map<HorseKind, number>();
    for (let i = 0; i < count; i++) {
      const k = pickKind(rng);
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    // 봄에는 망아지가 조금 더 (시즌 총수와 따로 센다)
    if (seasonOfDay(day, startSeason) === SPRING) kinds.set('pony', (kinds.get('pony') ?? 0) + HORSES.springExtra);
    for (const [kind, n] of kinds) out.push({ day, town, kind, count: n });
    day += rng.int(HORSES.gapDays[0], HORSES.gapDays[1]);
  }
  return out;
}

export function stableAt(state: EconomyState, town: number): Stable | null {
  return state.horses.stables.find((s) => s.town === town) ?? null;
}

/**
 * 하루를 시작할 때: 시즌이 바뀌었으면 입고 일정을 새로 짜고, 오늘 입고를 마구간에 푼다.
 * 지난 시즌에 남은 말은 그대로 남는다
 */
export function horseMorning(state: EconomyState, map: WorldMap): HorseArrival[] {
  const season = state.season;
  if (!season) return [];
  const m = state.horses;
  if (m.season !== season.number) {
    const towns = stableTowns(map);
    for (const town of towns) if (!stableAt(state, town)) m.stables.push({ town, stock: emptyStock() });
    m.arrivals.push(...scheduleArrivals(state.seed, season, state.startSeason, towns));
    m.season = season.number;
  }
  const today: HorseArrival[] = [];
  const later: HorseArrival[] = [];
  for (const a of m.arrivals) {
    if (a.day > state.day) later.push(a);
    // 목장 화재 동안은 하루씩 미룬다
    else if (horseDelayAt(state, a.town)) later.push({ ...a, day: state.day + 1 });
    else today.push(a);
  }
  m.arrivals = later;
  for (const a of today) {
    stableAt(state, a.town)!.stock[a.kind] += a.count;
    m.arrived.push({ ...a, day: state.day });
  }
  return today;
}
