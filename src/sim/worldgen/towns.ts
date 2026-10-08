// 마을 특색: 마을 칸과 주변 두 칸 안의 자원지를 센다.
import { WORLDGEN } from '../constants';
import { cellsAround } from './hex';
import type { ResourceKind, Tile } from './types';

export const TOWN_NAMES: readonly string[] = [
  '리버포드',
  '스톤힐',
  '솔트미어',
  '벨헤이븐',
  '오크우드',
  '그레이록',
  '밀브룩',
  '시브리즈',
  '애쉬포드',
  '레드클리프',
  '윈드홀',
  '골든베일',
];

/** 범위 안에 2칸 이상 있는 자원지를 많은 순으로 최대 2개. 같은 수면 먼저 만난 자원이 앞 */
export function townSpecialties(tiles: readonly Tile[], neighbors: readonly number[][], at: number): ResourceKind[] {
  const counts = new Map<ResourceKind, number>();
  for (const i of [at, ...cellsAround(neighbors, at, WORLDGEN.specialtyRange)]) {
    const res = tiles[i]!.resource;
    if (res) counts.set(res, (counts.get(res) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= WORLDGEN.specialtyMinCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, WORLDGEN.maxSpecialties)
    .map(([k]) => k);
}

/** 마을을 세울 수 있는 땅 */
export function isTownTerrain(tile: Tile): boolean {
  return tile.terrain === 'plain' || tile.terrain === 'coast' || tile.terrain === 'forest';
}
