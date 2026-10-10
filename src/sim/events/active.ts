// 사건을 시작하고 끝내고, 지금 벌어지는 사건의 효과를 묻는다.
// 다른 시뮬 코드는 효과를 직접 들여다보지 않고 여기 함수(생산 배율, 수요, 막힌 길 등)만 부른다.
import { ECONOMY } from '../constants';
import { basePrice, FOODS, type GoodId } from '../economy/goods';
import { addGoods, count } from '../economy/inventory';
import type { JobId } from '../economy/jobs';
import type { EconomyState } from '../economy/state';
import { AUTUMN } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';
import { eventDef } from './defs';
import { createSeason } from './schedule';
import type { ActiveEvent, BigOrder, EventEffect, EventId, ScheduledEvent } from './types';

/** 같은 마을에서 사건을 기억해 두는 날 (원정 사건 카드용) */
const RECENT_EVENT_DAYS = 30;

/** 이 마을에 지금 미치는 사건들 */
export function eventsAt(state: EconomyState, town: number): ActiveEvent[] {
  return state.events.filter((e) => e.towns.includes(town) && e.start <= state.day && state.day <= e.end);
}

function effectsAt(state: EconomyState, town: number): { ev: ActiveEvent; effect: EventEffect }[] {
  return eventsAt(state, town).flatMap((ev) => eventDef(ev.event).effects.map((effect) => ({ ev, effect })));
}

/** 채집 생산 배율 */
export function produceFactor(state: EconomyState, town: number, good: GoodId): number {
  let f = 1;
  for (const { ev, effect } of effectsAt(state, town)) {
    if (effect.kind === 'produce' && (effect.good ?? ev.good) === good) f *= effect.factor;
  }
  return f;
}

/** 주민 수요: 배율과 하루 더 사는 양. 물품을 정하지 않은 수요 효과는 모든 물품에 */
export function demandModifier(state: EconomyState, town: number, good: GoodId): { factor: number; extra: number } {
  let factor = 1;
  let extra = 0;
  for (const { ev, effect } of effectsAt(state, town)) {
    if (effect.kind !== 'demand') continue;
    const target = effect.good ?? ev.good;
    if (target !== undefined && target !== good) continue;
    factor *= effect.factor ?? 1;
    extra += effect.extra ?? 0;
  }
  return { factor, extra };
}

/** 주민이 부르는 값 배율 (굶주린 마을의 음식) */
export function citizenBidFactor(state: EconomyState, town: number, good: GoodId): number {
  let f = 1;
  for (const { effect } of effectsAt(state, town)) {
    if (effect.kind === 'citizenBid' && FOODS.includes(good)) f *= effect.factor;
  }
  return f;
}

/** 일꾼이 그 일의 벌이를 보는 배율 */
export function jobIncomeFactor(state: EconomyState, town: number, job: JobId): number {
  let f = 1;
  for (const { ev, effect } of effectsAt(state, town)) {
    if (effect.kind === 'jobIncome' && (effect.job ?? ev.job) === job) f *= effect.factor;
  }
  return f;
}

/** 그 마을 장에서 팔 수 없는 물품 */
export function bannedGoods(state: EconomyState, town: number): Set<GoodId> {
  const out = new Set<GoodId>();
  for (const { effect } of effectsAt(state, town)) if (effect.kind === 'saleBan') out.add(effect.good);
  return out;
}

/** 장날 거래세 비율 */
export function salesTax(state: EconomyState, town: number): number {
  let rate = 0;
  for (const { effect } of effectsAt(state, town)) if (effect.kind === 'salesTax') rate += effect.rate;
  return Math.min(0.5, rate);
}

/** 이 마을로 오가는 길의 통행세 */
export function tollAt(state: EconomyState, town: number): number {
  let gold = 0;
  for (const { effect } of effectsAt(state, town)) if (effect.kind === 'toll') gold += effect.gold;
  return gold;
}

/** 목장 화재처럼 이 마을 말 입고가 미뤄지고 있나 */
export function horseDelayAt(state: EconomyState, town: number): boolean {
  return effectsAt(state, town).some(({ effect }) => effect.kind === 'horseDelay');
}

/** 지금 막힌 길 칸 */
export function blockedTiles(state: EconomyState): Set<number> {
  const out = new Set<number>();
  for (const e of state.events) if (e.start <= state.day && state.day <= e.end) for (const t of e.tiles ?? []) out.add(t);
  return out;
}

/** 오늘 마을 사이 이동 일수 (막힌 길을 돌아간다) */
export function travelDaysToday(state: EconomyState, map: WorldMap, season: Parameters<typeof townTravelDays>[1]): number[][] {
  return townTravelDays(map, season, blockedTiles(state));
}

/** 오늘 열려 있는 큰 주문 (남은 양이 있는 것) */
/** 큰 주문 양: 사건 표의 양(한 사람 세계)을 플레이어 수에 맞춘다. 한 사람이면 표의 양 그대로 */
export function bigOrderQty(qty: number, players: number): number {
  const share = ECONOMY.events.bigOrderPerPlayer;
  return Math.round(qty * (1 - share + share * Math.max(1, players)));
}

export function bigOrdersToday(state: EconomyState): { event: ActiveEvent; order: BigOrder }[] {
  return state.events
    .filter((ev) => ev.start <= state.day && state.day <= ev.end)
    .flatMap((event) => (event.orders ?? []).filter((o) => o.left > 0).map((order) => ({ event, order })));
}

/** 장날 뒤: 큰 주문이 산 만큼 남은 양을 줄이고, 다 찬 사건은 오늘로 끝낸다. 바깥에서 들어온 돈을 돌려준다 */
export function settleBigOrders(state: EconomyState, bought: readonly { event: number; good: GoodId; qty: number; price: number }[]): number {
  let paid = 0;
  for (const b of bought) {
    const ev = state.events.find((e) => e.id === b.event);
    const o = ev?.orders?.find((x) => x.good === b.good);
    if (!ev || !o) continue;
    o.left = Math.max(0, o.left - b.qty);
    paid += b.qty * b.price;
    const rec = state.season?.log.find((r) => r.id === ev.id)?.orders?.find((x) => x.good === b.good);
    if (rec) rec.filled += b.qty;
  }
  for (const ev of state.events) {
    if (ev.orders?.length && ev.orders.every((o) => o.left === 0) && ev.end > state.day) ev.end = state.day;
  }
  return paid;
}

/**
 * 큰 주문이 산 물건 중 나눠 주는 것(봄 구휼)을 그 마을 일꾼에게 나눠 준다: 그 물건이 가장 적은 일꾼부터 하나씩 돌아가며.
 * 마을에 일꾼이 없으면 사라진다. 나눠 준 양을 돌려준다
 */
export function giveOutBigOrders(state: EconomyState, bought: readonly { event: number; good: GoodId; qty: number }[]): number {
  let given = 0;
  for (const b of bought) {
    const ev = state.events.find((e) => e.id === b.event);
    if (!ev || !eventDef(ev.event).effects.some((e) => e.kind === 'bigOrder' && e.giveOut && (e.good ?? ev.good) === b.good)) continue;
    const workers = state.workers.filter((w) => w.town === ev.town);
    if (!workers.length) continue;
    const have = workers.map((w) => count(w.inv, b.good));
    const share = workers.map(() => 0);
    for (let n = 0; n < b.qty; n++) {
      let i = 0;
      for (let j = 1; j < workers.length; j++) if (have[j]! + share[j]! < have[i]! + share[i]!) i = j;
      share[i]!++;
    }
    workers.forEach((w, i) => {
      if (share[i]) addGoods(w.inv, b.good, share[i]!);
    });
    given += b.qty;
  }
  return given;
}

/** 오늘 시작한 대상단 거래 */
export function bulkTradesToday(state: EconomyState): { town: number; good: GoodId; side: 'buy' | 'sell'; qty: number }[] {
  const out: { town: number; good: GoodId; side: 'buy' | 'sell'; qty: number }[] = [];
  for (const ev of state.events) {
    if (ev.start !== state.day || !ev.good) continue;
    for (const e of eventDef(ev.event).effects) if (e.kind === 'bulk') out.push({ town: ev.town, good: ev.good, side: e.side, qty: e.qty });
  }
  return out;
}

// ───────── 시작과 끝 ─────────

/**
 * 하루를 시작할 때: 시즌이 끝났으면 새 시즌을 짜고, 끝난 사건을 치우고, 오늘 일정의 사건을 시작한다.
 * 신문 문장을 돌려준다
 */
export function startDay(state: EconomyState, map: WorldMap): string[] {
  const season = state.season;
  if (!season) return [];
  if (state.day >= season.startDay + season.length) {
    state.season = createSeason(state, map, season.number + 1, state.day);
    // 새 시즌이 열렸다: 지난 결산은 접고 다시 명령을 받는다
    state.settlement = null;
  }
  state.events = state.events.filter((e) => e.end >= state.day);
  const news: string[] = [];
  for (const sch of state.season!.schedule) if (sch.day === state.day) news.push(begin(state, map, sch));
  return news;
}

function begin(state: EconomyState, map: WorldMap, sch: ScheduledEvent): string {
  const def = eventDef(sch.event);
  const season = state.season!;
  const end = def.days === 'season' ? season.startDay + season.length - 1 : state.day + def.days - 1;
  const ev = activate(state, map, sch.event, sch.town, end, { good: sch.good, tiles: sch.tiles });
  const orders = ev.orders?.map((o) => ({ good: o.good, qty: o.left, price: o.price, filled: 0 }));
  season.log.push({ event: sch.event, town: sch.town, day: state.day, end, omenDay: sch.omenDay, good: sch.good, ...(orders ? { id: ev.id, orders } : {}) });
  return def.news({ town: map.towns[ev.town]!.name, good: sch.good ?? null, job: null });
}

/** 사건을 시작한다 (일정 사건과 반응 사건 모두) */
export function activate(
  state: EconomyState,
  map: WorldMap,
  event: EventId,
  town: number,
  end: number,
  extra: { good?: GoodId; job?: JobId; tiles?: number[] } = {},
): ActiveEvent {
  const def = eventDef(event);
  const towns =
    def.scope === 'all'
      ? map.towns.map((t) => t.id)
      : def.scope === 'nearby'
        ? nearbyTowns(map, town)
        : [town];
  const ev: ActiveEvent = { id: state.nextId++, event, town, towns, start: state.day, end, ...stripUndefined(extra) };
  // 큰 주문: 물품과 값은 시작할 때 정한다 (기준 가격의 배율). 양은 플레이어 수에 비례한다 (0.1.0)
  const orders = def.effects.flatMap((e) => {
    if (e.kind !== 'bigOrder') return [];
    const good = e.good ?? extra.good;
    return good ? [{ good, left: bigOrderQty(e.qty, Object.keys(state.players).length), price: Math.round(basePrice(good) * e.factor) }] : [];
  });
  if (orders.length) ev.orders = orders;
  state.events.push(ev);
  // 시작할 때 한 번 일어나는 일: 자원지가 줄거나 는다
  for (const e of def.effects) {
    if (e.kind !== 'node') continue;
    for (const id of towns) {
      const node = state.towns[id]!.nodes.find((n) => n.kind === e.resource);
      if (!node) continue;
      if (e.amountFactor !== undefined) node.amount *= e.amountFactor;
      if (e.addTiles) {
        const more = e.addTiles * ECONOMY.node.capacityPerTile;
        node.capacity += more;
        node.amount += more;
        node.tiles += e.addTiles;
      }
    }
  }
  // 원정 덱의 사건 카드를 부른다
  if (def.deck) {
    for (const id of towns) {
      const t = state.towns[id]!;
      t.recentEvents = [...t.recentEvents.filter((r) => state.day - r.day <= RECENT_EVENT_DAYS), { kind: def.deck, day: state.day }];
    }
  }
  return ev;
}

/** 사건이 난 마을에서 가까운 마을들 (그 마을 포함) */
function nearbyTowns(map: WorldMap, town: number): number[] {
  const days = townTravelDays(map, AUTUMN);
  return map.towns.filter((t) => days[town]![t.id]! <= ECONOMY.events.nearbyDays).map((t) => t.id);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
