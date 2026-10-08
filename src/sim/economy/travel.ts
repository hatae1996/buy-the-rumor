// 플레이어 이동 일수: 오늘 계절과 막힌 길(사건)을 따르고, 말이 있으면 말 걸음으로 간다.
// 명령, 화면, 봇이 같은 값을 쓰도록 여기 한곳에서 계산한다.
import { travelDaysToday } from '../events';
import { horseDays } from '../horses/pull';
import { seasonOfDay } from '../season';
import type { WorldMap } from '../worldgen';
import type { EconomyState } from './state';

/** 지금 마을에서 마을마다 걸리는 날 (막힌 길은 돌아가고, 못 가면 Infinity). 길 위면 출발한 마을 기준 */
export function playerTravelDays(state: EconomyState, map: WorldMap): number[] {
  const p = state.player;
  const from = p.travel ? p.travel.from : p.town;
  const row = travelDaysToday(state, map, seasonOfDay(state.day, state.startSeason))[from]!;
  return row.map((d) => horseDays(d, p.horses));
}
