// 수첩 도장 (기획서 "들은 이야기 수첩"): 신문이나 직접 본 것으로 사실이 확인되면 "맞았다 / 틀렸다"를 찍는다.
// 정확도 숫자는 보여 주지 않는다. 도장이 쌓이며 누구 말을 믿을지 배운다.
// 확인하는 길: 신문(사건), 그 마을에 가서 본 시세와 장날, 그 마을 원정(자원지), 그 마을에 가 보기(특색).
// 0.0.6 규칙: 기한 안에 확인하지 못하면 도장 없이 "확인 못 함". "틀렸다"는 확인한 사실이 소문과 다를 때만.
// 시세와 신청 현황은 그 이야기가 생긴 날의 장 기록과 견준다. 늦게 가서 값이 바뀌었다고 맞던 소문이 틀린 것이 되지 않는다.
import { RUMORS } from '../constants';
import { basePrice, GOODS, type GoodId } from '../economy/goods';
import { findNode } from '../economy/nodes';
import type { EconomyState } from '../economy/state';
import type { WorldMap } from '../worldgen';
import { tagsNearTown } from './facts';
import { noteMoment } from '../ranking/record';
import type { Claim, HeardRumor, MarketLogDay, Stamp } from './types';

const V = RUMORS.verify;

function stamp(state: EconomyState, h: HeardRumor, result: boolean | 'unchecked'): void {
  const s: Stamp = result === 'unchecked' ? 'unchecked' : result ? 'right' : 'wrong';
  h.stamp = s;
  h.stampDay = state.day;
  // 업적 "귀가 밝은 상인"이 센다
  if (s === 'right') noteMoment(state, 'rumorRight');
}

/** 하루 끝에 마을마다 시세와 신청 현황을 적어 둔다 (소문이 생기기 전에 부른다) */
export function logMarkets(state: EconomyState): void {
  const log = state.rumorMill.marketLog;
  for (const t of state.towns) {
    const price = {} as Record<GoodId, number>;
    const gap = {} as Record<GoodId, number>;
    for (const g of GOODS) {
      price[g] = Math.round(t.refPrice[g]);
      gap[g] = t.lastMarket[g].demand - t.lastMarket[g].supply;
    }
    const days = (log[t.id] ??= []);
    days.push({ day: state.day, price, gap });
    while (days.length && days[0]!.day <= state.day - V.logDays) days.shift();
  }
}

function logAt(state: EconomyState, town: number, day: number): MarketLogDay | null {
  return state.rumorMill.marketLog[town]?.find((d) => d.day === day) ?? null;
}

/** 이 주장을 확인할 수 있는 마지막 날. 기한이 없으면(특색) null */
function deadline(h: HeardRumor, c: Claim): number | null {
  switch (c.kind) {
    case 'omen':
      return c.until;
    case 'price':
      return h.day + V.priceDays;
    case 'orders':
      return h.day + V.ordersDays;
    case 'node':
      return h.day + V.nodeDays;
    case 'horse':
      return h.day + V.horseDays * 2;
    case 'trait':
      return null;
  }
}

/** 장날이 끝난 뒤: 신문과 지금 있는 마을에서 본 것으로 도장을 찍는다. 새로 찍은 줄 수를 돌려준다 */
export function verifyNotebook(state: EconomyState, map: WorldMap): number {
  const p = state.player;
  const here = p.travel ? null : p.town;
  const day = state.day;
  let n = 0;
  for (const h of p.rumors) {
    if (h.stamp || !h.claim) continue;
    const c = h.claim;
    const result = check(state, map, h, c, here, day);
    if (result !== null) {
      stamp(state, h, result);
      n++;
      continue;
    }
    // 기한이 지나도록 확인하지 못했다: 도장 없음 (새 도장으로 세지 않는다)
    const until = deadline(h, c);
    if (until !== null && day > until) stamp(state, h, 'unchecked');
  }
  return n;
}

function check(state: EconomyState, map: WorldMap, h: HeardRumor, c: Claim, here: number | null, day: number): boolean | null {
  switch (c.kind) {
    case 'omen': {
      // 신문: 그 마을에 그 사건이 실렸나. 기한이 지나도록 안 실리면 사건이 없었다는 것이 신문으로 확인된 셈이라 틀렸다
      const log = state.season?.log ?? [];
      if (log.some((e) => e.event === c.event && e.town === c.town && e.day >= c.from && e.day <= c.until)) return true;
      return day > c.until ? false : null;
    }
    case 'price': {
      // 그 마을에 가서 장부를 보면 그날 시세를 안다. 견주는 값은 이야기가 생긴 날의 값
      if (here !== c.town || day - h.day > V.priceDays) return null;
      const then = logAt(state, c.town, c.asOf);
      return then ? priceRight(c, then.price[c.good]) : null;
    }
    case 'orders': {
      // 들은 뒤 그 마을 장날을 직접 겪으면 확인된다. 견주는 것은 이야기가 생긴 날의 장
      if (here !== c.town || day <= h.day || day - h.day > V.ordersDays) return null;
      const then = logAt(state, c.town, c.asOf);
      if (!then) return null;
      return c.side === 'buy' ? then.gap[c.good] > 0 : then.gap[c.good] < 0;
    }
    case 'trait':
      if (here !== c.town) return null;
      return tagsNearTown(map)[c.town]!.includes(c.tag);
    case 'node':
      // 원정을 나가 봐야 안다 (verifyByExpedition)
      return null;
    case 'horse': {
      // 그 마구간에 가서 봐야 안다. 들은 날이 지나야 확인할 수 있다
      const due = c.day ?? c.from + V.horseDays;
      if (here !== c.town || day < due || day - h.day > V.horseDays * 2) return null;
      const came = state.horses.arrived
        .filter((a) => a.town === c.town && a.kind === c.horse && (c.day === null ? a.day >= c.from && a.day <= due : a.day === c.day))
        .reduce((s, a) => s + a.count, 0);
      return came > 0 && (c.count === null || came >= c.count);
    }
  }
}

/** 들은 시세가 실제 값과 맞나 */
export function priceRight(c: Extract<Claim, { kind: 'price' }>, actual: number): boolean {
  const base = basePrice(c.good);
  if (c.price === null || c.bound === null) return c.dir === 'high' ? actual >= base * V.dearAbove : actual <= base * V.cheapBelow;
  if (c.bound === 'atLeast') return actual >= c.price;
  if (c.bound === 'atMost') return actual <= c.price;
  return Math.abs(actual - c.price) <= Math.max(2, c.price * V.priceTolerance);
}

/** 원정을 나가 자원지를 직접 보면, 그 마을 자원지 소문에 도장을 찍는다 */
export function verifyByExpedition(state: EconomyState, town: number): number {
  let n = 0;
  for (const h of state.player.rumors) {
    const c = h.claim;
    if (h.stamp || !c || c.kind !== 'node' || c.town !== town || state.day - h.day > V.nodeDays) continue;
    const node = findNode(state.towns[town]!, c.resource);
    if (!node || node.capacity <= 0) continue;
    const ratio = node.amount / node.capacity;
    stamp(state, h, c.level === 'low' ? ratio < 0.5 : ratio >= 0.5);
    n++;
  }
  return n;
}
