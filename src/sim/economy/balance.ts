// 균형 측정: 여러 날을 돌리며 겨울 일꾼 감소, 도구 없이 일하는 비율 같은 목표 수치를 잰다.
// 안정성 테스트와 개발용 관찰 화면에서 같이 쓴다.
import { seasonOfDay, WINTER } from '../season';
import type { WorldMap } from '../worldgen';
import { advanceDay, type DayReport } from './day';
import type { EconomyState } from './state';

export interface BalanceStats {
  /** 겨울마다: 겨울 첫날 일꾼 수 대비 겨울 동안 가장 적었던 때 얼마나 줄었나 (0~1) */
  winterDrops: number[];
  /** 일꾼-날 중 도구 없이 일한 비율 (0~1) */
  toollessShare: number;
  /** 날마다 일꾼 수 */
  population: number[];
}

/** 이미 만든 경제를 days일 돌리며 잰다. onDay로 날마다 다른 일(봇 등)을 끼워 넣을 수 있다 */
export function measureBalance(
  state: EconomyState,
  map: WorldMap,
  days: number,
  onDay?: (state: EconomyState, report: DayReport) => void,
): BalanceStats {
  const population: number[] = [];
  const winterDrops: number[] = [];
  let workerDays = 0;
  let toolless = 0;
  let winterStart: number | null = null;
  let winterMin = Infinity;

  for (let d = 0; d < days; d++) {
    const inWinter = seasonOfDay(state.day, state.startSeason) === WINTER;
    if (inWinter && winterStart === null) {
      winterStart = state.workers.length;
      winterMin = winterStart;
    }
    for (const w of state.workers) {
      workerDays++;
      if (w.tool === 0) toolless++;
    }
    const report = advanceDay(state, map);
    onDay?.(state, report);
    population.push(state.workers.length);
    if (winterStart !== null) {
      winterMin = Math.min(winterMin, state.workers.length);
      const stillWinter = seasonOfDay(state.day, state.startSeason) === WINTER;
      if (!stillWinter) {
        winterDrops.push(winterStart > 0 ? 1 - winterMin / winterStart : 0);
        winterStart = null;
      }
    }
  }
  return { winterDrops, toollessShare: workerDays ? toolless / workerDays : 0, population };
}
