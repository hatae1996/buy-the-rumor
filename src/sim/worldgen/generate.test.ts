import { describe, expect, it } from 'vitest';
import { WORLDGEN } from '../constants';
import { AUTUMN, WINTER } from '../season';
import { nearestTownDays, townTravelDays } from './days';
import { generateWorld, resourceTilesAround } from './generate';
import { buildNeighbors, cellsAround, hexDistance } from './hex';
import { regionTag, terrainRegionKind } from './regionTags';
import { checkWorldRules } from './rules';
import { isTownTerrain, townSpecialties } from './towns';
import { worldFingerprint as fingerprint } from './fingerprint';
import { RESOURCE_KINDS } from './types';

const SEEDS = Array.from({ length: 200 }, (_, i) => 1 + i * 104729);
const maps = SEEDS.map((s) => generateWorld(s));

describe('같은 시드면 같은 맵', () => {
  it('두 번 만들어도 같다', () => {
    expect(generateWorld(20261008)).toEqual(generateWorld(20261008));
  });

  it('다른 시드면 대부분 다르다', () => {
    const prints = new Set(maps.map(fingerprint));
    expect(prints.size).toBeGreaterThan(maps.length * 0.95);
  });

  it('JSON으로 저장했다 불러와도 같다 (다른 객체를 참조하지 않음)', () => {
    const map = maps[0]!;
    expect(JSON.parse(JSON.stringify(map))).toEqual(map);
  });

  it('시드 20261008의 맵 (생성 규칙이나 숫자를 바꾸면 이 값도 바뀐다)', () => {
    // 일부러 바꾼 거라면 `npx vitest -u`로 고친다
    const map = generateWorld(20261008);
    expect({
      seed: map.seed,
      tries: map.tries,
      fingerprint: fingerprint(map),
      towns: map.towns.map((t) => `${t.name} ${t.tier} ${t.specialties.join(',')}`),
      regions: map.regions.map((r) => r.tag),
    }).toMatchInlineSnapshot(`
      {
        "fingerprint": "d7e80cea",
        "regions": [
          "reef",
          "bears",
          "fertile",
          "fertile",
          "bandits",
          "bandits",
          "ranch",
        ],
        "seed": 20261009,
        "towns": [
          "스톤힐 town fish,ore",
          "윈드홀 town forest,field",
          "솔트미어 town salt,ore",
          "골든베일 city ",
        ],
        "tries": 2,
      }
    `);
  });
});

describe(`생성 규칙 (${SEEDS.length}개 시드)`, () => {
  it('모든 시드에서 맵이 만들어지고 규칙을 모두 통과한다', () => {
    for (const map of maps) {
      const failed = checkWorldRules(map).filter((r) => !r.ok);
      expect(failed, `시드 ${map.requestedSeed}`).toEqual([]);
    }
  });

  it('생산 마을 3곳과 도시 1곳, 도시는 마지막 번호', () => {
    for (const map of maps) {
      expect(map.towns.map((t) => t.tier)).toEqual(['town', 'town', 'town', 'city']);
    }
  });

  it('자원지 5종을 생산 마을 셋이 나눠 가진다', () => {
    for (const map of maps) {
      const covered = new Set(map.towns.filter((t) => t.tier === 'town').flatMap((t) => t.specialties));
      for (const k of RESOURCE_KINDS) expect(covered.has(k), `시드 ${map.requestedSeed}, ${k}`).toBe(true);
    }
  });

  it('도시는 길이 모이는 곳이고 주변 자원지가 적다', () => {
    for (const map of maps) {
      const nbs = buildNeighbors(map.tiles);
      const city = map.towns.find((t) => t.tier === 'city')!;
      expect(city.specialties).toEqual([]);
      expect(resourceTilesAround(map.tiles, nbs, city.tile)).toBeLessThanOrEqual(WORLDGEN.cityMaxResourceTiles);
      const sums = townTravelDays(map, AUTUMN).map((row) => row.reduce((s, d) => s + d, 0));
      expect(sums[city.id], `시드 ${map.requestedSeed}`).toBe(Math.min(...sums));
    }
  });

  it('생산 마을 특색은 1~2개이고, 실제로 주변 두 칸 안에 그 자원지가 2칸 이상 있다', () => {
    for (const map of maps) {
      const nbs = buildNeighbors(map.tiles);
      for (const town of map.towns.filter((t) => t.tier === 'town')) {
        expect(town.specialties.length).toBeGreaterThanOrEqual(1);
        expect(town.specialties.length).toBeLessThanOrEqual(2);
        const area = [town.tile, ...cellsAround(nbs, town.tile, 2)];
        for (const k of town.specialties) {
          expect(area.filter((i) => map.tiles[i]!.resource === k).length).toBeGreaterThanOrEqual(2);
        }
        expect(town.specialties).toEqual(townSpecialties(map.tiles, nbs, town.tile));
      }
    }
  });

  it('모든 마을이 연결되고, 가장 가까운 마을까지 1~4일', () => {
    for (const map of maps) {
      const days = townTravelDays(map, AUTUMN);
      expect(days.flat().every(Number.isFinite), `시드 ${map.requestedSeed}`).toBe(true);
      for (const d of nearestTownDays(days)) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(4);
      }
    }
  });

  it('겨울엔 이동이 빨라지지 않고, 산길이 있는 맵은 느려진다', () => {
    let slower = 0;
    for (const map of maps) {
      const autumn = townTravelDays(map, AUTUMN).flat();
      const winter = townTravelDays(map, WINTER).flat();
      winter.forEach((d, i) => expect(d).toBeGreaterThanOrEqual(autumn[i]!));
      if (winter.some((d, i) => d > autumn[i]!)) slower++;
    }
    expect(slower).toBeGreaterThan(0);
  });

  it('마을은 4곳, 땅 위에, 생산 마을끼리 5칸·도시와 4칸 이상 떨어져 있고, 이름이 겹치지 않는다', () => {
    for (const map of maps) {
      expect(map.towns).toHaveLength(WORLDGEN.productionTowns + WORLDGEN.cities);
      expect(new Set(map.towns.map((t) => t.name)).size).toBe(map.towns.length);
      for (const a of map.towns) {
        expect(isTownTerrain(map.tiles[a.tile]!)).toBe(true);
        for (const b of map.towns) {
          if (a === b) continue;
          const minDist = a.tier === 'city' || b.tier === 'city' ? WORLDGEN.cityMinDistance : WORLDGEN.townMinDistance;
          expect(hexDistance(map.tiles[a.tile]!, map.tiles[b.tile]!)).toBeGreaterThanOrEqual(minDist);
        }
      }
    }
  });

  it('지역 특색 태그는 맞는 땅에만 붙고, 이어진 덩어리이며, 대부분의 맵에 하나 이상 있다', () => {
    let withTags = 0;
    for (const map of maps) {
      if (map.regions.length) withTags++;
      const nbs = buildNeighbors(map.tiles);
      const towns = new Set(map.towns.map((t) => t.tile));
      for (const r of map.regions) {
        const kind = regionTag(r.tag).kind;
        // 길 구간과, 꼭 생겨야 하는 목장은 작아도 된다
        expect(r.tiles.length).toBeGreaterThanOrEqual(kind === 'road' || r.tag === 'ranch' ? 1 : WORLDGEN.regionMinTiles);
        for (const i of r.tiles) {
          const t = map.tiles[i]!;
          if (kind === 'road') {
            expect(t.road).toBe(true);
            expect(towns.has(i)).toBe(false);
          } else expect(terrainRegionKind(t.terrain)).toBe(kind);
        }
        // 이어진 덩어리
        const inRegion = new Set(r.tiles);
        const seen = new Set([r.tiles[0]!]);
        const stack = [r.tiles[0]!];
        while (stack.length) for (const n of nbs[stack.pop()!]!) if (inRegion.has(n) && !seen.has(n)) seen.add(n), stack.push(n);
        expect(seen.size, `시드 ${map.requestedSeed}, ${r.tag}`).toBe(r.tiles.length);
      }
    }
    expect(withTags).toBeGreaterThan(maps.length * 0.9);
  });

  it('길은 바다를 지나지 않고 모든 마을에 닿는다', () => {
    for (const map of maps) {
      expect(map.tiles.some((t) => t.road && t.terrain === 'sea')).toBe(false);
      for (const town of map.towns) expect(map.tiles[town.tile]!.road).toBe(true);
    }
  });

  it('지형 6종이 모두 나오고, 자원지는 지형에 맞다', () => {
    const allowed = { forest: ['forest'], ore: ['hills', 'mountain'], field: ['plain'], fish: ['coast'], salt: ['coast'] };
    for (const map of maps) {
      for (const t of map.tiles) {
        if (t.resource) expect(allowed[t.resource]).toContain(t.terrain);
        if (t.terrain === 'forest') expect(t.resource).toBe('forest');
      }
    }
    const terrains = new Set(maps.flatMap((m) => m.tiles.map((t) => t.terrain)));
    expect(terrains.size).toBe(6);
  });

  it('지형을 몇 번 만들지 않고 통과한다 (평균 3번 안쪽)', () => {
    // 도시 조건이 붙어 평균 1.9번쯤이다 (시드 400개). 숫자를 바꿔 이 값이 크게 늘면 규칙이 너무 빡빡한 것
    const avg = maps.reduce((s, m) => s + m.tries, 0) / maps.length;
    expect(avg).toBeLessThan(3);
  });
});
