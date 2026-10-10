// 순자산 (기획서 "랭킹과 보상", 확정): 현금 + 예금 − 빚 + (짐과 말의 값 × 절반).
// 짐은 그 물품의 모든 마을 마지막 장날 값의 평균(0.0.6), 말은 구입가로 친다. 막판에 물건을 사 두기만 하는 꼼수를 막는다.
// 모든 마을 평균이라 어디에 서 있는지, 어느 마을 창고에 두었는지가 순자산을 바꾸지 않는다.
// 예금과 빚은 은행 계좌(src/sim/bank)를 본다.
import { cartLots, type Board } from '../cart';
import { porterBoards } from '../hire/boards';
import { GOODS, type GoodId } from '../economy/goods';
import { ownedBy } from '../economy/players';
import type { EconomyState, PlayerState } from '../economy/state';

/** 짐과 말은 값의 이만큼만 친다 */
export const HOLDINGS_SHARE = 0.5;

/** 그 마을 마지막 장날 가격 (그날 맞춰진 거래가 없었으면 기준 시세) */
export function lastMarketPrice(state: EconomyState, town: number, good: GoodId): number {
  const t = state.towns[town]!;
  return t.lastMarket[good].price ?? Math.round(t.refPrice[good]);
}

/** 짐 값: 그 물품의 모든 마을 마지막 장날 값 평균 */
export function holdingPrice(state: EconomyState, good: GoodId): number {
  return state.towns.reduce((s, t) => s + lastMarketPrice(state, t.id, good), 0) / state.towns.length;
}

export interface WorthParts {
  cash: number;
  deposit: number;
  debt: number;
  /** 짐 (수레와 장에 내놓은 것) 값, 절반 치기 전 */
  goods: number;
  /** 말 구입가 합, 절반 치기 전 */
  horses: number;
  /** 실은 여행 식량을 산 값 (순자산에는 넣지 않는다. 첫 5일 벌이를 잴 때만, 0.1.3) */
  rations: number;
  total: number;
}

/** 판들에 실린 여행 식량을 산 값의 합 (산 값을 모르면 0) */
export function rationsValue(boards: readonly Board[]): number {
  let v = 0;
  for (const b of boards) for (const piece of b.pieces) if (piece.good === 'rations') for (const l of piece.lots) v += l.qty * (l.cost ?? 0);
  return v;
}

export function worthParts(state: EconomyState, p: PlayerState): WorthParts {
  const qty = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<GoodId, number>;
  // 수레와 창고 짐
  const boards = [p.cart, ...porterBoards(p), ...(p.caravan ? [p.caravan.cart] : []), ...p.warehouses.map((w) => w.board)];
  for (const board of boards) for (const l of cartLots(board)) qty[l.good] += l.qty;
  // 장날을 기다리는 신청: 팔려고 맡긴 짐과 사려고 맡긴 돈
  let reserved = 0;
  for (const o of state.orders) {
    if (!ownedBy(o.owner, p.id)) continue;
    reserved += o.reserved;
    for (const l of o.lots) qty[l.good] += l.qty;
  }
  // 추첨을 기다리며 맡긴 돈 (말, 게시판 일꾼)
  for (const d of state.draws) if (d.pid === p.id) reserved += d.reserved;
  const goods = GOODS.reduce((s, g) => s + qty[g] * holdingPrice(state, g), 0);
  const horses = [...p.horses, ...(p.caravan?.horses ?? [])].reduce((s, h) => s + h.price, 0);
  const cash = p.gold + reserved;
  // 은행 계좌 (도시 은행, 이번 버전은 구조만이라 늘 0)
  const deposit = p.bank.deposit;
  const debt = p.bank.loan;
  return { cash, deposit, debt, goods, horses, rations: rationsValue(boards), total: Math.round(cash + deposit - debt + (goods + horses) * HOLDINGS_SHARE) };
}

export function netWorth(state: EconomyState, p: PlayerState): number {
  return worthParts(state, p).total;
}
