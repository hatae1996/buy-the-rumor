// 생성 규칙 검사. 생성기와 따로 계산해서 테스트와 개발용 화면에서 쓴다.
import { WORLDGEN } from '../constants';
import { AUTUMN } from '../season';
import { nearestTownDays, townTravelDays } from './days';
import { RESOURCE_KINDS, type WorldMap } from './types';

export interface RuleCheck {
  id: 'allResources' | 'maxSpecialties' | 'connected' | 'nearestDays';
  label: string;
  ok: boolean;
}

export function checkWorldRules(map: WorldMap): RuleCheck[] {
  const covered = new Set(map.towns.flatMap((t) => t.specialties));
  // 봄, 여름, 가을은 이동 비용이 같다. 규칙은 눈 없는 계절 기준
  const days = townTravelDays(map, AUTUMN);
  const nearest = nearestTownDays(days);
  const { min, max } = WORLDGEN.nearestTownDays;
  return [
    {
      id: 'allResources',
      label: '자원지 5종(숲, 광맥, 들판, 어장, 염전)이 모두 어느 마을 근처에 있음',
      ok: RESOURCE_KINDS.every((k) => covered.has(k)),
    },
    {
      id: 'maxSpecialties',
      label: `한 마을의 특색은 최대 ${WORLDGEN.maxSpecialties}개`,
      ok: map.towns.every((t) => t.specialties.length <= WORLDGEN.maxSpecialties),
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
