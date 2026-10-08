// 반응 사건: 일정표가 아니라 시장 상태에서 생긴다 (기획서 "반응 사건").
// 값이 너무 낮으면 일꾼이 일을 줄이고, 너무 높으면 다른 마을 일꾼이 몰려들고(직업 바꾸기와 이어짐),
// 음식이 바닥나면 굶주린 마을, 플레이어가 한 물품을 싹쓸이하면 품귀 기사.
import { ECONOMY } from '../constants';
import { basePrice, FOODS, GOODS, type GoodId } from '../economy/goods';
import { GATHER_JOBS, JOB_RESOURCE, type JobId } from '../economy/jobs';
import type { EconomyState } from '../economy/state';
import type { WorldMap } from '../worldgen';
import { activate } from './active';
import { eventDef } from './defs';
import type { EventId } from './types';

const R = ECONOMY.events.reactive;

/** 이 물품을 만드는 채집 직업 */
function producerJob(good: GoodId): JobId | null {
  return GATHER_JOBS.find((j) => good in ECONOMY.gather[j]) ?? null;
}

/** 장날 뒤에 부른다. playerBuys: 오늘 플레이어가 마을마다 산 양. 신문 문장을 돌려준다 */
export function reactiveEvents(
  state: EconomyState,
  map: WorldMap,
  playerBuys: readonly Partial<Record<GoodId, number>>[],
): string[] {
  if (!state.season) return [];
  const memo = state.reactive;
  const news: string[] = [];
  const season = state.season;
  // 하루에 하나, 시즌에 정해진 수까지
  let budget = Math.min(1, R.perSeason - season.log.filter((e) => eventDef(e.event).category === 'reactive').length);
  const ready = (event: EventId, town: number) => budget > 0 && (memo.cooldown[`${event}:${town}`] ?? -Infinity) <= state.day;
  const fire = (event: EventId, town: number, extra: { good?: GoodId; job?: JobId }) => {
    budget--;
    const def = eventDef(event);
    const days = def.days === 'season' ? 1 : def.days;
    activate(state, map, event, town, state.day + days - 1, extra);
    memo.cooldown[`${event}:${town}`] = state.day + R.cooldownDays;
    season.log.push({ event, town, day: state.day, end: state.day + days - 1, omenDay: null, good: extra.good });
    news.push(def.news({ town: map.towns[town]!.name, good: extra.good ?? null, job: extra.job ?? null }));
  };

  for (const town of state.towns) {
    // 값이 며칠째 너무 낮거나 높은 채집 물품
    for (const good of GOODS) {
      const job = producerJob(good);
      if (!job || !town.nodes.some((n) => n.kind === JOB_RESOURCE[job as keyof typeof JOB_RESOURCE])) continue;
      // 그 일을 하는 일꾼이 있는 마을에서만 "일을 줄인다"
      const doing = state.workers.some((w) => w.town === town.id && w.job === job);
      const key = `${town.id}:${good}`;
      const ratio = town.refPrice[good] / basePrice(good);
      memo.low[key] = ratio < R.lowBelow ? (memo.low[key] ?? 0) + 1 : 0;
      memo.high[key] = ratio > R.highAbove ? (memo.high[key] ?? 0) + 1 : 0;
      if (memo.low[key]! >= R.streakDays && doing && ready('workersQuit', town.id)) {
        fire('workersQuit', town.id, { good, job });
        memo.low[key] = 0;
      }
      if (memo.high[key]! >= R.streakDays) {
        // 그 자원지가 있는 다른 마을 일꾼들이 이 일로 몰린다
        const other = state.towns.find(
          (o) => o.id !== town.id && o.nodes.some((n) => n.kind === JOB_RESOURCE[job as keyof typeof JOB_RESOURCE]) && ready('rush', o.id),
        );
        if (other) fire('rush', other.id, { good, job });
        memo.high[key] = 0;
      }
    }

    // 음식이 바닥난 마을: 장에 음식이 하나도 안 나왔고, 일꾼이 많이 굶는다
    const workers = state.workers.filter((w) => w.town === town.id);
    const hungry = workers.filter((w) => w.hunger > 0).length;
    const noFood = FOODS.every((g) => town.lastMarket[g].supply === 0);
    if (workers.length > 0 && noFood && hungry / workers.length > R.famineHungryShare && ready('famine', town.id)) {
      fire('famine', town.id, {});
    }

    // 플레이어 싹쓸이
    const bought = playerBuys[town.id] ?? {};
    for (const good of GOODS) {
      const qty = bought[good] ?? 0;
      const volume = town.lastMarket[good].volume;
      if (qty >= R.selloutMinQty && volume > 0 && qty / volume >= R.selloutShare && ready('sellout', town.id)) {
        fire('sellout', town.id, { good });
      }
    }
  }
  return news;
}
