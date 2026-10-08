// 맵 생성. 지형을 만들고, 규칙을 맞추는 마을 배치와 길을 찾는다.
// 못 찾으면 시드를 1 올려 지형부터 다시 만든다.
import { WORLDGEN } from '../constants';
import { createRng, shuffle, type Rng } from '../rng';
import { AUTUMN } from '../season';
import { nearestTownDays, travelDaysBetween } from './days';
import { hexDistance } from './hex';
import { planRoads } from './roads';
import { generateTerrain } from './terrain';
import { isTownTerrain, TOWN_NAMES, townSpecialties } from './towns';
import { RESOURCE_KINDS, type ResourceKind, type Tile, type Town, type WorldMap } from './types';

export function generateWorld(requestedSeed: number): WorldMap {
  const base = requestedSeed >>> 0;
  for (let tries = 1; tries <= WORLDGEN.terrainAttempts; tries++) {
    const seed = (base + tries - 1) >>> 0;
    const rng = createRng(seed);
    const { tiles, neighbors } = generateTerrain(seed, rng);
    const towns = placeTownsAndRoads(tiles, neighbors, rng);
    if (towns) return { requestedSeed: base, seed, tries, radius: WORLDGEN.radius, tiles, towns };
  }
  throw new Error(`맵 생성 실패: 시드 ${base}부터 ${WORLDGEN.terrainAttempts}번 시도`);
}

/** 성공하면 tiles의 road를 채우고 마을 목록을 돌려준다 */
function placeTownsAndRoads(tiles: Tile[], neighbors: number[][], rng: Rng): Town[] | null {
  const land = tiles.flatMap((t, i) => (isTownTerrain(t) ? [i] : []));
  const specialtiesAt = new Map(land.map((i) => [i, townSpecialties(tiles, neighbors, i)]));

  for (let attempt = 0; attempt < WORLDGEN.townAttempts; attempt++) {
    // 특색이 많은 칸을 먼저 보되, 매번 조금씩 흔든다
    const scored = land
      .map((i) => {
        const sp = specialtiesAt.get(i)!;
        return { i, sp, score: sp.length * 3 + rng.next() * 4 };
      })
      .sort((a, b) => b.score - a.score);

    const picked: { i: number; sp: ResourceKind[] }[] = [];
    for (const c of scored) {
      if (picked.length === WORLDGEN.townCount) break;
      if (c.sp.length === 0) continue;
      if (picked.some((p) => hexDistance(tiles[p.i]!, tiles[c.i]!) < WORLDGEN.townMinDistance)) continue;
      picked.push(c);
    }
    if (picked.length < WORLDGEN.townCount) continue;

    const covered = new Set(picked.flatMap((p) => p.sp));
    if (RESOURCE_KINDS.some((k) => !covered.has(k))) continue;

    const townTiles = picked.map((p) => p.i);
    const roads = planRoads(tiles, neighbors, townTiles);
    if (!roads) continue;
    tiles.forEach((t, i) => (t.road = roads.has(i)));

    const nearest = nearestTownDays(travelDaysBetween(tiles, neighbors, townTiles, AUTUMN));
    const { min, max } = WORLDGEN.nearestTownDays;
    if (nearest.some((d) => d < min || d > max)) {
      tiles.forEach((t) => (t.road = false));
      continue;
    }

    const names = shuffle([...TOWN_NAMES], rng);
    return picked.map((p, id) => ({ id, name: names[id]!, tile: p.i, specialties: p.sp }));
  }
  return null;
}

