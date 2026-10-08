// 생성 규칙 검사. 생성기와 따로 계산해서 테스트와 개발용 화면에서 쓴다.
import { WORLDGEN } from '../constants';
import { AUTUMN } from '../season';
import { nearestTownDays, townTravelDays } from './days';
import { resourceTilesAround } from './generate';
import { buildNeighbors } from './hex';
import { RESOURCE_KINDS, type WorldMap } from './types';

export interface RuleCheck {
  id: 'tiers' | 'allResources' | 'specialties' | 'cityFewResources' | 'cityHub' | 'connected' | 'nearestDays';
  label: string;
  ok: boolean;
}

export function checkWorldRules(map: WorldMap): RuleCheck[] {
  const producers = map.towns.filter((t) => t.tier === 'town');
  const cities = map.towns.filter((t) => t.tier === 'city');
  const covered = new Set(producers.flatMap((t) => t.specialties));
  // 봄, 여름, 가을은 길 비용이 거의 같다. 규칙은 가을(눈도 진흙도 없음) 기준
  const days = townTravelDays(map, AUTUMN);
  const nearest = nearestTownDays(days);
  const sums = days.map((row) => row.reduce((s, d) => s + d, 0));
  const nbs = buildNeighbors(map.tiles);
  const { min, max } = WORLDGEN.nearestTownDays;
  return [
    {
      id: 'tiers',
      label: `생산 마을 ${WORLDGEN.productionTowns}곳과 도시 ${WORLDGEN.cities}곳`,
      ok: producers.length === WORLDGEN.productionTowns && cities.length === WORLDGEN.cities,
    },
    {
      id: 'allResources',
      label: '자원지 5종(숲, 광맥, 들판, 어장, 염전)을 생산 마을들이 나눠 가짐',
      ok: RESOURCE_KINDS.every((k) => covered.has(k)),
    },
    {
      id: 'specialties',
      label: `생산 마을의 특색은 1~${WORLDGEN.maxSpecialties}개, 도시는 없음`,
      ok:
        producers.every((t) => t.specialties.length >= 1 && t.specialties.length <= WORLDGEN.maxSpecialties) &&
        cities.every((t) => t.specialties.length === 0),
    },
    {
      id: 'cityFewResources',
      label: `도시 주변 자원지는 ${WORLDGEN.cityMaxResourceTiles}칸 이하`,
      ok: cities.every((t) => resourceTilesAround(map.tiles, nbs, t.tile) <= WORLDGEN.cityMaxResourceTiles),
    },
    {
      id: 'cityHub',
      label: '도시는 길이 모이는 곳 (다른 곳까지 걸리는 날 합이 가장 작음)',
      ok: cities.every((c) => sums[c.id]! <= Math.min(...sums)),
    },
    {
      id: 'connected',
      label: '모든 마을이 서로 오갈 수 있음',
      ok: days.every((row) => row.every(Number.isFinite)),
    },
    {
      id: 'nearestDays',
      label: `가장 가까운 마을까지 ${min}~${max}일`,
      ok: nearest.every((d) => d >= min && d <= max),
    },
  ];
}
