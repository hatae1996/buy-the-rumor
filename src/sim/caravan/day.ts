// 두 번째 행렬의 하루: 아침에 지시서 마을이면 장날 신청을 내고, 밤에 다음 마을로 떠나거나 길을 간다.
// 돈은 내 금고(소지금)에서 쓰고 받는다. 여비도 내 돈에서 나간다. 돈이 모자라면 그 마을에서 기다린다.
import { cartCount, cartWeight, type Board } from '../cart';
import { ECONOMY, HORSES } from '../constants';
import type { Accounts } from '../economy/accounts';
import type { EconomyState, Order, PlayerState } from '../economy/state';
import { travelDaysToday } from '../events/active';
import { feedHorses } from '../horses/care';
import { horseDays, maxWeight } from '../horses/pull';
import { seasonOfDay } from '../season';
import type { WorldMap } from '../worldgen';
import { autoLoadRoom, caravanRentNight } from './caravan';
import type { Caravan } from './types';
import { roadNight, roadRisk } from '../economy/incidents';

/** 아침에: 지시서 마을에 와 있으면 오늘 장날 신청을 낸다 (팔기 먼저, 사기는 알아서 싣기만큼) */
export function caravanOrders(state: EconomyState, p: PlayerState, accounts: Accounts): Order[] {
  const c = p.caravan;
  if (!c || c.travel || !c.plan || c.tradedDay === state.day || !p.hires.some((h) => h.id === c.carter)) return [];
  const stop = c.plan.stops[c.stop];
  if (!stop || stop.town !== c.town) return [];
  c.tradedDay = state.day;
  const owner = { kind: 'caravan', pid: p.id } as const;
  const out: Order[] = [];
  for (const s of stop.sells) {
    const qty = s.qty === 'all' ? cartCount(c.cart, s.good) : Math.min(s.qty, cartCount(c.cart, s.good));
    const o = qty > 0 ? accounts.place(owner, c.town, s.good, 'sell', qty, s.minPrice) : null;
    if (o) out.push(o);
  }
  for (const b of stop.buys) {
    const qty = Math.min(b.qty, autoLoadRoom(c, b.good), Math.floor(p.gold / b.maxPrice));
    const o = qty > 0 ? accounts.place(owner, c.town, b.good, 'buy', qty, b.maxPrice) : null;
    if (o) out.push(o);
  }
  return out;
}

/** 행렬이 갈 마을: 불러들이는 중이면 내가 있는 마을, 아니면 지시서의 지금 줄 */
function target(p: PlayerState, c: Caravan): number | null {
  if (c.recalled) return p.travel ? p.travel.to : p.town;
  return c.plan?.stops[c.stop]?.town ?? null;
}

/** 떠난다: 여비는 내 돈에서, 말은 길에서 지친다. 못 떠나면 false */
function setOff(state: EconomyState, p: PlayerState, map: WorldMap, c: Caravan, to: number): boolean {
  const walk = travelDaysToday(state, map, seasonOfDay(state.day, state.startSeason))[c.town]![to]!;
  if (!Number.isFinite(walk)) return false;
  if (cartWeight(c.cart) > maxWeight(c.cart, c.horses)) return false;
  const days = horseDays(walk, c.horses);
  const fee = days * ECONOMY.player.travelFeePerDay;
  if (p.gold < fee) return false;
  p.gold -= fee;
  state.towns[c.town]!.treasury += fee;
  for (const h of c.horses) h.fatigue = Math.min(HORSES.fatigue.max, h.fatigue + HORSES.kinds[h.kind].travelFatigue * days);
  c.travel = { from: c.town, to, days, daysLeft: days, risk: roadRisk(state, map, c.town, to) };
  p.ledger.push({ day: state.day, kind: 'caravan', what: 'travel', town: c.town, to, fee });
  return true;
}

/** 밤에: 말을 먹이고, 길을 가거나, 장날을 마쳤으면 다음 마을로 떠난다 */
export function caravanNight(state: EconomyState, p: PlayerState, map: WorldMap): void {
  const c = p.caravan;
  if (!c) return;
  caravanRentNight(state, p);
  // 마부가 떠났으면(일당을 못 받음) 행렬은 그 자리에 멈춘다
  const driven = p.hires.some((h) => h.id === c.carter);
  if (!driven) c.plan = null;
  // 마부는 길 위에서도 가는 마을 마구간 값으로 먹이를 사 먹인다 (NPC 상단과 같다). 돈이 모자라면 수레 곡물을 먹는다
  c.horses = feedHorses(state, p, c.horses, c.travel ? c.travel.to : c.town, c.cart as Board, !c.travel);
  if (c.travel) {
    roadNight(state, p, c.travel, c.cart, true);
    if (--c.travel.daysLeft <= 0) {
      c.town = c.travel.to;
      c.travel = null;
      p.ledger.push({ day: state.day, kind: 'caravan', what: 'arrive', town: c.town, fee: 0 });
      if (c.recalled && c.town === target(p, c)) c.recalled = false;
    }
    return;
  }
  if (!driven || !c.horses.length) return;
  // 장날을 마쳤으면 지시서 다음 줄로 (끝이면 처음부터, 반복이 아니면 멈춘다)
  if (c.plan && c.tradedDay === state.day) {
    if (c.stop + 1 < c.plan.stops.length) c.stop++;
    else if (c.plan.repeat) c.stop = 0;
    else c.plan = null;
  }
  const to = target(p, c);
  if (to === null) return;
  if (to === c.town) {
    if (c.recalled) c.recalled = false;
    return;
  }
  setOff(state, p, map, c, to);
}
