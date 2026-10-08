// 맵 생성. 지형을 만들고, 규칙을 맞추는 마을 배치와 길을 찾는다.
// 못 찾으면 시드를 1 올려 지형부터 다시 만든다.
//
// 마을 배치 순서 (기획서 "직업"):
//   1. 생산 마을 3곳: 주변 자원지로 특색이 1~2개씩, 셋이 자원지 5종을 다 나눠 가진다
//   2. 도시 1곳: 세 마을로 가는 길이 가장 짧은 자리(교통 요지), 주변 자원지가 거의 없는 땅
//   3. 길: 네 곳을 잇는 최소 신장 트리 + 짧은 추가 연결
//   4. 지역 특색 태그
import { WORLDGEN } from '../constants';
import { createRng, shuffle, type Rng } from '../rng';
import { AUTUMN } from '../season';
import { nearestTownDays, travelDaysBetween } from './days';
import { cellsAround, hexDistance } from './hex';
import { tagRegions } from './regionTags';
import { planRoads } from './roads';
import { generateTerrain } from './terrain';
import { isTownTerrain, TOWN_NAMES, townSpecialties } from './towns';
import { shortestPaths, terrainCost } from './travel';
import { RESOURCE_KINDS, type ResourceKind, type TaggedRegion, type Tile, type Town, type WorldMap } from './types';

export function generateWorld(requestedSeed: number): WorldMap {
  const base = requestedSeed >>> 0;
  for (let tries = 1; tries <= WORLDGEN.terrainAttempts; tries++) {
    const seed = (base + tries - 1) >>> 0;
    const rng = createRng(seed);
    const { tiles, neighbors } = generateTerrain(seed, rng);
    const placed = placeTownsAndRoads(tiles, neighbors, rng);
    if (placed) {
      return { requestedSeed: base, seed, tries, radius: WORLDGEN.radius, tiles, towns: placed.towns, regions: placed.regions };
    }
  }
  throw new Error(`맵 생성 실패: 시드 ${base}부터 ${WORLDGEN.terrainAttempts}번 시도`);
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
    for (const c of scored) {
      if (picked.length === WORLDGEN.productionTowns) break;
      if (c.sp.length === 0) continue;
      if (picked.some((p) => hexDistance(tiles[p.i]!, tiles[c.i]!) < WORLDGEN.townMinDistance)) continue;
      picked.push(c);
    }
    if (picked.length < WORLDGEN.productionTowns) continue;
    const covered = new Set(picked.flatMap((p) => p.sp));
    if (RESOURCE_KINDS.some((k) => !covered.has(k))) continue;

    // 2. 도시: 세 마을까지 지형 비용 합이 가장 작은 땅 (조금 흔들어 매번 같은 자리만 고르지 않게)
    const fromTowns = picked.map((p) => shortestPaths(neighbors, p.i, (i) => terrainCost(tiles[i]!, AUTUMN)).cost);
    const city = land
      .filter(
        (i) =>
          picked.every((p) => hexDistance(tiles[p.i]!, tiles[i]!) >= WORLDGEN.cityMinDistance) &&
          resourceTilesAround(tiles, neighbors, i) <= WORLDGEN.cityMaxResourceTiles,
      )
      .map((i) => ({ i, cost: fromTowns.reduce((s, c) => s + c[i]!, 0) + rng.next() * 2 }))
      .filter((c) => Number.isFinite(c.cost))
      .sort((a, b) => a.cost - b.cost)[0];
    if (!city) continue;

    // 3. 길
    const townTiles = [...picked.map((p) => p.i), city.i];
    const roads = planRoads(tiles, neighbors, townTiles);
    if (!roads) continue;
    tiles.forEach((t, i) => (t.road = roads.tiles.has(i)));

    const days = travelDaysBetween(tiles, neighbors, townTiles, AUTUMN);
    const nearest = nearestTownDays(days);
    // 도시가 교통 요지인지: 다른 곳까지 걸리는 날 합이 가장 작아야 한다
    const sums = days.map((row) => row.reduce((s, d) => s + d, 0));
    const cityIsHub = sums[sums.length - 1]! <= Math.min(...sums);
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
    const regions = tagRegions(tiles, neighbors, segments, rng);

    const names = shuffle([...TOWN_NAMES], rng);
    const towns: Town[] = picked.map((p, id) => ({ id, name: names[id]!, tier: 'town', tile: p.i, specialties: p.sp }));
    towns.push({ id: towns.length, name: names[towns.length]!, tier: 'city', tile: city.i, specialties: [] });
    return { towns, regions };
  }
  return null;
}
