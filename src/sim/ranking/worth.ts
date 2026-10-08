// 순자산 (기획서 "랭킹과 보상", 확정): 현금 + 예금 − 빚 + (짐과 말의 값 × 절반).
// 짐은 마지막 장날 가격, 말은 구입가로 친다. 막판에 물건을 사 두기만 하는 꼼수를 막는다.
// 예금과 빚은 은행이 생기면 더한다 (아직 0).
import { cartLots } from '../cart';
import { GOODS, type GoodId } from '../economy/goods';
import type { EconomyState } from '../economy/state';

/** 짐과 말은 값의 이만큼만 친다 */
export const HOLDINGS_SHARE = 0.5;

/** 짐 값을 매길 마을: 지금 있는 마을, 길 위면 떠나온 마을 */
function pricingTown(state: EconomyState): number {
  const p = state.player;
  return p.travel ? p.travel.from : p.town;
}

/** 그 마을 마지막 장날 가격 (그날 맞춰진 거래가 없었으면 기준 시세) */
export function lastMarketPrice(state: EconomyState, town: number, good: GoodId): number {
  const t = state.towns[town]!;
  return t.lastMarket[good].price ?? Math.round(t.refPrice[good]);
}

export interface WorthParts {
  cash: number;
  deposit: number;
  debt: number;
  /** 짐 (수레와 장에 내놓은 것) 값, 절반 치기 전 */
  goods: number;
  /** 말 구입가 합, 절반 치기 전 */
  horses: number;
  total: number;
}

export function worthParts(state: EconomyState): WorthParts {
  const p = state.player;
  const town = pricingTown(state);
  const qty = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<GoodId, number>;
  for (const l of cartLots(p.cart)) qty[l.good] += l.qty;
  // 장날을 기다리는 신청: 팔려고 맡긴 짐과 사려고 맡긴 돈
  let reserved = 0;
  for (const o of state.orders) {
    reserved += o.reserved;
    for (const l of o.lots) qty[l.good] += l.qty;
  }
  const goods = GOODS.reduce((s, g) => s + qty[g] * lastMarketPrice(state, town, g), 0);
  const horses = p.horses.reduce((s, h) => s + h.price, 0);
  const cash = p.gold + reserved;
  const deposit = 0;
  const debt = 0;
  return { cash, deposit, debt, goods, horses, total: Math.round(cash + deposit - debt + (goods + horses) * HOLDINGS_SHARE) };
}

export function netWorth(state: EconomyState): number {
  return worthParts(state).total;
}
