// 생성 규칙 검사. 생성기와 따로 계산해서 테스트와 개발용 화면에서 쓴다.
import { WORLDGEN } from '../constants';
import { AUTUMN } from '../season';
import { citiesAreHubs, nearestTownDays, townTravelDays } from './days';
import { resourceTilesAround } from './generate';
import { buildNeighbors } from './hex';
import { townsNearTag } from './regionTags';
import { minTownsPerResource, worldSize } from './size';
import { RESOURCE_KINDS, type WorldMap } from './types';

export interface RuleCheck {
  id: 'tiers' | 'allResources' | 'specialties' | 'cityFewResources' | 'cityHub' | 'connected' | 'nearestDays' | 'ranch';
  label: string;
  ok: boolean;
}

export function checkWorldRules(map: WorldMap): RuleCheck[] {
  const size = worldSize(map.towns.length);
  const producers = map.towns.filter((t) => t.tier === 'town');
  const cities = map.towns.filter((t) => t.tier === 'city');
  const perResource = minTownsPerResource(size);
  // 봄, 여름, 가을은 길 비용이 거의 같다. 규칙은 가을(눈도 진흙도 없음) 기준
  const days = townTravelDays(map, AUTUMN);
  const nearest = nearestTownDays(days);
  const nbs = buildNeighbors(map.tiles);
  const { min, max } = WORLDGEN.nearestTownDays;
  return [
    {
      id: 'tiers',
      label: `생산 마을 ${size.producers}곳과 도시 ${size.cities}곳`,
      ok: producers.length === size.producers && cities.length === size.cities,
    },
    {
      id: 'allResources',
      label: `자원지 5종(숲, 광맥, 들판, 어장, 염전)을 생산 마을들이 나눠 가짐 (종마다 ${perResource}곳 이상)`,
      ok: RESOURCE_KINDS.every((k) => producers.filter((t) => t.specialties.includes(k)).length >= perResource),
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
      label: '도시는 길이 모이는 곳 (가까운 마을들까지 걸리는 날 합이 그 마을들보다 작음)',
      ok: citiesAreHubs(days, cities.map((c) => c.id)),
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
    {
      id: 'ranch',
      label: `목장 특색이 생산 마을 ${size.ranchTowns}곳 근처에 (마구간이 생기는 마을, 0.0.7)`,
      ok: townsNearTag(map, nbs, 'ranch').filter((id) => map.towns[id]!.tier === 'town').length >= size.ranchTowns,
    },
  ];
}
