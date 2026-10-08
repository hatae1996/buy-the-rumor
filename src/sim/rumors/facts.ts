// 소문은 어디서 생기나 (기획서 "소문"): 다가오는 사건, 숨은 숫자, 다른 마을 시세, 장날 신청 현황, 마을 특색, 헛소문.
// 모든 소문은 시뮬의 진짜 상태에서 만들고, 헛소문만 일부러 틀리게 만든다.
import { ECONOMY, HORSES, RUMORS } from '../constants';
import { basePrice, GOODS } from '../economy/goods';
import type { EconomyState } from '../economy/state';
import { eventDef } from '../events/defs';
import type { Rng } from '../rng';
import { buildNeighbors, REGION_TAGS, townsNearTag, type RegionTagId, type WorldMap } from '../worldgen';
import { spreadReach } from './spread';
import type { NodeRumorKind, RumorFact, RumorKind, RumorSource, WorldRumor } from './types';

const NODE_KINDS: readonly NodeRumorKind[] = ['forest', 'fish', 'ore'];

const tagCache = new WeakMap<WorldMap, RegionTagId[][]>();

/** 마을마다 근처에 있는 특색 태그 */
export function tagsNearTown(map: WorldMap): RegionTagId[][] {
  let tags = tagCache.get(map);
  if (tags) return tags;
  const nbs = buildNeighbors(map.tiles);
  tags = map.towns.map(() => []);
  for (const def of REGION_TAGS) for (const town of townsNearTag(map, nbs, def.id)) tags[town]!.push(def.id);
  tagCache.set(map, tags);
  return tags;
}

/** 이야기 열쇠: 같은 이야기를 며칠 안에 또 소문 내지 않는다 */
function storyKey(f: RumorFact): string {
  switch (f.kind) {
    case 'omen':
      return `omen:${f.town}:${f.event}`;
    case 'node':
      return `node:${f.town}:${f.resource}`;
    case 'price':
      return `price:${f.town}:${f.good}`;
    case 'orders':
      return `orders:${f.town}:${f.good}`;
    case 'trait':
      return `trait:${f.town}:${f.tag}`;
    case 'horse':
      return `horse:${f.town}:${f.horse}:${f.arriveDay}`;
  }
}

/** 오늘 새로 생기는 소문 (state.rumorMill에 넣는다) */
export function makeRumorsToday(state: EconomyState, map: WorldMap, rng: Rng): WorldRumor[] {
  const mill = state.rumorMill;
  const day = state.day;
  const out: WorldRumor[] = [];
  const life = RUMORS.life;

  const add = (source: RumorSource, fact: RumorFact, truth: boolean, expires: number) => {
    const key = storyKey(fact);
    // 징조는 일정표를 따르므로 쉬지 않는다
    if (fact.kind !== 'omen' && (mill.cooldown[key] ?? -Infinity) > day) return;
    const rest = fact.kind === 'trait' ? RUMORS.trait.retellDays : RUMORS.cooldownDays;
    mill.cooldown[key] = day + Math.max(rest, expires - day + 1);
    // 헛소문은 진짜 값을 기억하지 않는다
    if (truth && fact.kind === 'price') mill.lastSaid[key] = fact.price;
    if (truth && fact.kind === 'orders') mill.lastSaid[key] = fact.side === 'buy' ? fact.qty : -fact.qty;
    out.push({
      id: mill.nextId++,
      source,
      fact,
      origin: fact.town,
      day,
      truth,
      expires,
      importance: RUMORS.importance[fact.kind],
      reach: spreadReach(map, fact.town, day, expires, rng),
    });
  };

  // 1. 다가오는 사건의 징조 (진짜와 헛징조). 사건이 난 마을에서 시작한다
  const season = state.season;
  if (season) {
    for (const s of season.schedule) {
      if (s.omenDay !== day || !eventDef(s.event).omen) continue;
      add('omen', { kind: 'omen', event: s.event, town: s.town, eventDay: s.day }, true, s.day + life.omen);
    }
    for (const f of season.fakeOmens) {
      if (f.day !== day || !eventDef(f.event).omen) continue;
      const lead = ECONOMY.events.omenLead[1];
      add('omen', { kind: 'omen', event: f.event, town: f.town, eventDay: null }, false, day + lead + life.omen);
    }
  }

  // 1-2. 말 입고: 며칠 앞서 목장 마을에서 소문이 난다
  for (const a of state.horses.arrivals) {
    if (a.day - day !== HORSES.rumorLead) continue;
    add('horse', { kind: 'horse', town: a.town, horse: a.kind, count: a.count, arriveDay: a.day }, true, a.day);
  }

  for (const town of state.towns) {
    // 2. 숨은 숫자: 자원지가 바닥나거나 넘칠 때
    for (const node of town.nodes) {
      if (!(NODE_KINDS as readonly string[]).includes(node.kind) || node.capacity <= 0) continue;
      const ratio = node.amount / node.capacity;
      const level = ratio < RUMORS.node.low ? 'low' : ratio > RUMORS.node.high ? 'high' : null;
      if (level && rng.next() < RUMORS.node.chance) {
        add('hidden', { kind: 'node', town: town.id, resource: node.kind as NodeRumorKind, level }, true, day + life.node);
      }
    }
    // 3. 시세가 크게 오르거나 내린 물품 (다른 마을로 퍼져 나간다)
    for (const good of GOODS) {
      const price = Math.round(town.refPrice[good]);
      const ratio = town.refPrice[good] / basePrice(good);
      const dir = ratio > RUMORS.price.high ? 'high' : ratio < RUMORS.price.low ? 'low' : null;
      const last = mill.lastSaid[`price:${town.id}:${good}`];
      const news = last === undefined || Math.abs(price - last) > last * RUMORS.price.changeToRetell;
      if (dir && news && rng.next() < RUMORS.price.chance) {
        add('price', { kind: 'price', town: town.id, good, dir, price }, true, day + life.price);
      }
    }
    // 4. 장날 신청 현황: 사려는 양과 팔려는 양이 크게 어긋난 물품
    for (const good of GOODS) {
      const m = town.lastMarket[good];
      const gap = m.demand - m.supply;
      const share = Math.abs(gap) / Math.max(1, m.demand, m.supply);
      const last = mill.lastSaid[`orders:${town.id}:${good}`];
      const news = last === undefined || Math.sign(last) !== Math.sign(gap) || Math.abs(gap) > Math.abs(last) * RUMORS.orders.growToRetell;
      if (Math.abs(gap) >= RUMORS.orders.minGap && share >= RUMORS.orders.minShare && news && rng.next() < RUMORS.orders.chance) {
        const side = gap > 0 ? 'buy' : 'sell';
        add('orders', { kind: 'orders', town: town.id, good, side, qty: Math.abs(gap) }, true, day + life.orders);
      }
    }
    // 5. 마을 특색
    const tags = tagsNearTown(map)[town.id]!;
    if (tags.length && rng.next() < RUMORS.trait.chance) {
      add('trait', { kind: 'trait', town: town.id, tag: rng.pick(tags) }, true, day + life.trait);
    }
  }

  // 6. 헛소문: 아무 근거 없이 만든 이야기
  if (rng.next() < RUMORS.false.chance) {
    const fact = falseFact(state, map, rng);
    if (fact) add('false', fact, false, day + life.false);
  }

  return out;
}

/** 지금 상태와 반대인 이야기 하나 */
function falseFact(state: EconomyState, map: WorldMap, rng: Rng): RumorFact | null {
  const town = state.towns[rng.int(0, state.towns.length - 1)]!;
  const kinds: RumorKind[] = ['price', 'node', 'trait'];
  switch (rng.pick(kinds)) {
    case 'price': {
      const good = rng.pick(GOODS);
      const base = basePrice(good);
      const dear = town.refPrice[good] >= base;
      return dear
        ? { kind: 'price', town: town.id, good, dir: 'low', price: Math.max(1, Math.round(base * 0.4)) }
        : { kind: 'price', town: town.id, good, dir: 'high', price: Math.round(base * 1.8) };
    }
    case 'node': {
      const nodes = town.nodes.filter((n) => (NODE_KINDS as readonly string[]).includes(n.kind) && n.capacity > 0);
      if (!nodes.length) return null;
      const node = rng.pick(nodes);
      const level = node.amount / node.capacity >= 0.5 ? 'low' : 'high';
      return { kind: 'node', town: town.id, resource: node.kind as NodeRumorKind, level };
    }
    default: {
      const near = new Set(tagsNearTown(map)[town.id]);
      const absent = REGION_TAGS.filter((t) => !near.has(t.id));
      if (!absent.length) return null;
      return { kind: 'trait', town: town.id, tag: rng.pick(absent).id };
    }
  }
}
