import { describe, expect, it } from 'vitest';
import { WORLDGEN } from '../constants';
import { AUTUMN, WINTER } from '../season';
import { nearestTownDays, townTravelDays } from './days';
import { generateWorld } from './generate';
import { buildNeighbors, cellsAround, hexDistance } from './hex';
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
      towns: map.towns.map((t) => `${t.name} ${t.specialties.join(',')}`),
    }).toMatchInlineSnapshot(`
      {
        "fingerprint": "27d4e21c",
        "seed": 20261008,
        "towns": [
          "스톤힐 field,ore",
          "윈드홀 field,fish",
          "골든베일 forest,fish",
          "시브리즈 field,salt",
        ],
        "tries": 1,
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

  it('자원지 5종이 모두 어느 마을 근처에 있다', () => {
    for (const map of maps) {
      const covered = new Set(map.towns.flatMap((t) => t.specialties));
      for (const k of RESOURCE_KINDS) expect(covered.has(k), `시드 ${map.requestedSeed}, ${k}`).toBe(true);
    }
  });

  it('마을 특색은 1~2개이고, 실제로 주변 두 칸 안에 그 자원지가 2칸 이상 있다', () => {
    for (const map of maps) {
      const nbs = buildNeighbors(map.tiles);
      for (const town of map.towns) {
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

  it('마을은 4개, 땅 위에, 서로 5칸 이상 떨어져 있고, 이름이 겹치지 않는다', () => {
    for (const map of maps) {
      expect(map.towns).toHaveLength(WORLDGEN.townCount);
      expect(new Set(map.towns.map((t) => t.name)).size).toBe(map.towns.length);
      for (const a of map.towns) {
        expect(isTownTerrain(map.tiles[a.tile]!)).toBe(true);
        for (const b of map.towns) {
          if (a !== b) expect(hexDistance(map.tiles[a.tile]!, map.tiles[b.tile]!)).toBeGreaterThanOrEqual(5);
        }
      }
    }
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

  it('대부분 첫 지형에서 통과한다 (평균 2번 안쪽)', () => {
    const avg = maps.reduce((s, m) => s + m.tries, 0) / maps.length;
    expect(avg).toBeLessThan(2);
  });
});
