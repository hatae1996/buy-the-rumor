// 맵 생성. 지형을 만들고, 규칙을 맞추는 마을 배치와 길을 찾는다.
// 못 찾으면 시드를 1 올려 지형부터 다시 만든다.
//
// 마을 수는 플레이어 수로 정한다 (size.ts, 0.1.1 표준 세계). 정하지 않으면 개발 테스트용 4곳.
//
// 마을 배치 순서 (기획서 "직업"):
//   1. 생산 마을 (마을 4곳이면 3곳): 주변 자원지로 특색이 1~2개씩, 함께 자원지 5종을 다 나눠 가진다
//   2. 도시 (12곳 이상이면 2곳): 생산 마을로 가는 길이 가장 짧은 자리(교통 요지), 주변 자원지가 거의 없는 땅.
//      도시가 둘이면 서로 떨어진다
//   3. 길: 모든 마을을 잇는 최소 신장 트리 + 짧은 추가 연결
//   4. 지역 특색 태그
import { WORLDGEN } from '../constants';
import { createRng, shuffle, type Rng } from '../rng';
import { AUTUMN } from '../season';
import { citiesAreHubs, nearestTownDays, travelDaysBetween } from './days';
import { cellsAround, hexDistance } from './hex';
import { tagRegions } from './regionTags';
import { planRoads } from './roads';
import { generateTerrain } from './terrain';
import { isTownTerrain, TOWN_NAMES, townSpecialties } from './towns';
import { minTownsPerResource, worldSize, type WorldSize } from './size';
import { shortestPaths, terrainCost } from './travel';
import { RESOURCE_KINDS, type ResourceKind, type TaggedRegion, type Tile, type Town, type WorldMap } from './types';

export interface WorldOptions {
  /** 마을 수 (WORLDGEN.sizes에 있는 수). 플레이어 수로 정하려면 townsForPlayers */
  towns?: number;
}

export function generateWorld(requestedSeed: number, opt: WorldOptions = {}): WorldMap {
  const base = requestedSeed >>> 0;
  const size = worldSize(opt.towns);
  for (let tries = 1; tries <= WORLDGEN.terrainAttempts; tries++) {
    const seed = (base + tries - 1) >>> 0;
    const rng = createRng(seed);
    const { tiles, neighbors } = generateTerrain(seed, rng, size.radius);
    const placed = placeTownsAndRoads(tiles, neighbors, rng, size);
    if (placed) {
      return { requestedSeed: base, seed, tries, radius: size.radius, tiles, towns: placed.towns, regions: placed.regions };
    }
  }
  throw new Error(`맵 생성 실패: 시드 ${base}부터 ${WORLDGEN.terrainAttempts}번 시도 (마을 ${size.towns}곳)`);
}

/** 주변 두 칸 안 자원지 칸 수 */
export function resourceTilesAround(tiles: readonly Tile[], neighbors: readonly number[][], at: number): number {
  return [at, ...cellsAround(neighbors, at, WORLDGEN.specialtyRange)].filter((i) => tiles[i]!.resource).length;
}

/** 성공하면 tiles의 road를 채우고 마을과 태그를 돌려준다 */
function placeTownsAndRoads(
  tiles: Tile[],
  neighbors: number[][],
  rng: Rng,
  size: WorldSize,
): { towns: Town[]; regions: TaggedRegion[] } | null {
  const land = tiles.flatMap((t, i) => (isTownTerrain(t) ? [i] : []));
  const specialtiesAt = new Map(land.map((i) => [i, townSpecialties(tiles, neighbors, i)]));
  const { min, max } = WORLDGEN.nearestTownDays;

  for (let attempt = 0; attempt < WORLDGEN.townAttempts; attempt++) {
    // 1. 생산 마을: 특색이 많은 칸을 먼저 보되, 매번 조금씩 흔든다
    const scored = land
      .map((i) => {
        const sp = specialtiesAt.get(i)!;
        return { i, sp, score: sp.length * 3 + rng.next() * 4 };
      })
      .sort((a, b) => b.score - a.score);
    const picked: { i: number; sp: ResourceKind[] }[] = [];
    const perResource = minTownsPerResource(size);
    // 4곳보다 큰 맵: 남은 자리로 모자란 자원지 종을 다 채울 수 있을 때만 받는다 (남은 자리 하나가 모자란 종 하나를 채운다고 본다).
    // 마을 4곳 맵은 예전처럼 고른 뒤 검사만 한다 (개발 테스트의 맵이 그대로 남게)
    const reserve = size.towns > WORLDGEN.defaultTowns;
    const deficit = (list: readonly { sp: ResourceKind[] }[]) =>
      RESOURCE_KINDS.reduce((s, k) => s + Math.max(0, perResource - list.filter((p) => p.sp.includes(k)).length), 0);
    for (const c of scored) {
      if (picked.length === size.producers) break;
      if (c.sp.length === 0) continue;
      if (picked.some((p) => hexDistance(tiles[p.i]!, tiles[c.i]!) < WORLDGEN.townMinDistance)) continue;
      if (reserve && deficit([...picked, c]) > size.producers - picked.length - 1) continue;
      picked.push(c);
    }
    if (picked.length < size.producers) continue;
    if (RESOURCE_KINDS.some((k) => picked.filter((p) => p.sp.includes(k)).length < perResource)) continue;

    // 2. 도시: 생산 마을까지 지형 비용 합이 가장 작은 땅 (조금 흔들어 매번 같은 자리만 고르지 않게).
    //    둘째 도시는 첫 도시와 떨어진 땅에서 같은 식으로
    const fromTowns = picked.map((p) => shortestPaths(neighbors, p.i, (i) => terrainCost(tiles[i]!, AUTUMN)).cost);
    const cities: number[] = [];
    for (let k = 0; k < size.cities; k++) {
      const city = land
        .filter(
          (i) =>
            picked.every((p) => hexDistance(tiles[p.i]!, tiles[i]!) >= WORLDGEN.cityMinDistance) &&
            cities.every((o) => hexDistance(tiles[o]!, tiles[i]!) >= WORLDGEN.cityCityMinDistance) &&
            resourceTilesAround(tiles, neighbors, i) <= WORLDGEN.cityMaxResourceTiles,
        )
        .map((i) => ({ i, cost: fromTowns.reduce((s, c) => s + c[i]!, 0) + rng.next() * 2 }))
        .filter((c) => Number.isFinite(c.cost))
        .sort((a, b) => a.cost - b.cost)[0];
      if (!city) break;
      cities.push(city.i);
    }
    if (cities.length < size.cities) continue;

    // 3. 길
    const townTiles = [...picked.map((p) => p.i), ...cities];
    const roads = planRoads(tiles, neighbors, townTiles, size.extraRoads);
    if (!roads) continue;
    tiles.forEach((t, i) => (t.road = roads.tiles.has(i)));

    const days = travelDaysBetween(tiles, neighbors, townTiles, AUTUMN);
    const nearest = nearestTownDays(days);
    // 도시가 교통 요지인지: 자기 쪽 마을들까지 걸리는 날 합이 그 마을들 누구보다도 작아야 한다
    const cityIsHub = citiesAreHubs(days, cities.map((_, k) => picked.length + k));
    if (nearest.some((d) => d < min || d > max) || !cityIsHub) {
      tiles.forEach((t) => (t.road = false));
      continue;
    }

    // 4. 지역 특색 태그. 길은 마을 칸에서 끊어 이어진 구간마다 따로 본다
    //    (A에서 B로 가는 길이 C 마을을 지나면 두 구간이 된다)
    const town = new Set(townTiles);
    const segments = roads.links.flatMap((l) => {
      const out: number[][] = [[]];
      for (const i of l.path) {
        if (town.has(i)) out.push([]);
        else out[out.length - 1]!.push(i);
      }
      return out.filter((seg) => seg.length > 0);
    });
    const regions = tagRegions(
      tiles,
      neighbors,
      segments,
      picked.map((p) => p.i),
      rng,
      size.ranchTowns,
    );
    // 목장 특색이 생산 마을 ranchTowns곳 근처에 있어야 한다 (마구간 마을, 0.0.7). 못 맞추면 다른 배치로
    const ranch = new Set(regions.filter((r) => r.tag === 'ranch').flatMap((r) => r.tiles));
    const ranchTowns = picked.filter((p) => [p.i, ...cellsAround(neighbors, p.i, WORLDGEN.specialtyRange)].some((i) => ranch.has(i))).length;
    if (ranchTowns < size.ranchTowns) continue;

    const names = shuffle([...TOWN_NAMES], rng);
    const towns: Town[] = picked.map((p, id) => ({ id, name: names[id]!, tier: 'town', tile: p.i, specialties: p.sp }));
    for (const tile of cities) towns.push({ id: towns.length, name: names[towns.length]!, tier: 'city', tile, specialties: [] });
    return { towns, regions };
  }
  return null;
}
