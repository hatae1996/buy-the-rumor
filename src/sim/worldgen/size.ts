// 세계 크기: 플레이어 수에 맞춰 마을 수를 정하고, 마을 수에 맞춰 맵 크기와 도시 수를 정한다 (0.1.1 표준 세계).
import { WORLDGEN } from '../constants';

export interface WorldSize {
  towns: number;
  /** 생산 마을 수 (마을 수 − 도시 수) */
  producers: number;
  cities: number;
  radius: number;
  ranchTowns: number;
  extraRoads: number;
}

/** 마을 수로 정할 수 있는 크기들 (작은 것부터) */
export const WORLD_TOWN_COUNTS: readonly number[] = Object.keys(WORLDGEN.sizes)
  .map(Number)
  .sort((a, b) => a - b);

/** 플레이어 수에 맞는 마을 수. 표의 가장 큰 인원을 넘으면 가장 큰 세계 */
export function townsForPlayers(players: number): number {
  const rows = WORLDGEN.townsByPlayers;
  for (const [upTo, towns] of rows) if (players <= upTo) return towns;
  return rows[rows.length - 1]![1];
}

export function worldSize(towns: number = WORLDGEN.defaultTowns): WorldSize {
  const s = WORLDGEN.sizes[towns];
  if (!s) throw new Error(`마을 ${towns}곳 맵은 정해 두지 않았다 (${WORLD_TOWN_COUNTS.join(', ')}곳 중에서)`);
  return { towns, producers: towns - s.cities, ...s };
}

/**
 * 마을 4곳 맵에 맞춰 정한 "세계에 몇 개" 숫자(NPC 상단, 시즌 사건 수)를 키우는 배율. 마을 수 / 4.
 * 마을이 늘면 일꾼·주민·금고는 마을마다 생겨 저절로 늘고, 세계에 몇 개로 정한 것만 이 배율을 곱한다
 */
export function townScale(towns: number): number {
  return towns / WORLDGEN.defaultTowns;
}

/** 자원지 한 종을 특색으로 가진 생산 마을이 최소 몇 곳이어야 하나 */
export function minTownsPerResource(size: WorldSize): number {
  return Math.max(1, Math.floor(size.producers / WORLDGEN.producersPerResource));
}
