// 부문별 점수 (기획서 "랭킹 부문 (확정)"). 접속 시간이나 반복 횟수로 오르는 부문은 두지 않는다.
// 큰손: 순자산. 수완가: 시작 대비 배수(일정 기간 넘게 한 사람만). 한 방: 한 번에 판 것의 최고 이익(산 값 대비).
// Buy the Rumor: 징조 소문을 듣고 신문 전에 산 물품을 신문 뒤에 판 이익의 합. 물품왕: 물품마다 판 양.
import { ECONOMY } from '../constants';
import { GOODS, type GoodId } from '../economy/goods';
import type { EconomyState, PlayerState } from '../economy/state';
import { eventDef } from '../events/defs';
import type { EventId } from '../events/types';
import type { SeasonRecord, TradeRecord } from './types';
import { netWorth } from './worth';

const R = ECONOMY.ranking;

export interface SeasonScores {
  bigShot: number;
  /** 아직 충분히 하지 않았으면 null (기록 안 함) */
  multiplier: number | null;
  oneShot: number;
  buyTheRumor: number;
  goodsKing: Record<GoodId, number>;
}

/** 산 묶음을 먼저 산 것부터 판 것과 맞춘다. 원정으로 얻은 것처럼 산 적 없는 것은 세지 않는다 */
class CostBasis {
  private lots: { qty: number; price: number }[] = [];
  buy(qty: number, price: number): void {
    this.lots.push({ qty, price });
  }
  /** 팔린 qty개의 이익 (산 것과 맞춘 만큼만) */
  sell(qty: number, price: number): number {
    let profit = 0;
    let left = qty;
    while (left > 0 && this.lots.length) {
      const lot = this.lots[0]!;
      const n = Math.min(lot.qty, left);
      profit += n * (price - lot.price);
      lot.qty -= n;
      left -= n;
      if (lot.qty === 0) this.lots.shift();
    }
    return profit;
  }
}

/** 한 방: 장날 한 번에 판 것(같은 날, 같은 물품) 중 산 값 대비 가장 큰 이익 */
export function bestSingleSale(trades: readonly TradeRecord[]): number {
  return bestSale(trades)?.profit ?? 0;
}

/** 가장 크게 남긴 판매 한 번 (시즌 리포트 "내 최고 거래"). 이익이 난 판매가 없으면 null */
export function bestSale(trades: readonly TradeRecord[]): { day: number; town: number; good: GoodId; qty: number; price: number; profit: number } | null {
  const basis = new Map<GoodId, CostBasis>();
  let best: { day: number; town: number; good: GoodId; qty: number; price: number; profit: number } | null = null;
  for (const t of [...trades].sort((a, b) => a.day - b.day || (a.side === 'buy' ? -1 : 1))) {
    const b = basis.get(t.good) ?? new CostBasis();
    basis.set(t.good, b);
    if (t.side === 'buy') {
      b.buy(t.qty, t.price);
      continue;
    }
    const profit = b.sell(t.qty, t.price);
    if (profit > 0 && (!best || profit > best.profit)) best = { day: t.day, town: t.town, good: t.good, qty: t.qty, price: t.price, profit };
  }
  return best;
}

/** 이 사건이 움직이는 물품 (생산, 수요, 판매 금지, 대상단이 사고파는 물품) */
export function eventGoods(event: EventId, good?: GoodId): GoodId[] {
  const out = new Set<GoodId>();
  for (const e of eventDef(event).effects) {
    if (e.kind === 'produce' || e.kind === 'demand') {
      const g = e.good ?? good;
      if (g) out.add(g);
    }
    if (e.kind === 'saleBan') out.add(e.good);
    if (e.kind === 'bulk' && good) out.add(good);
    if (e.kind === 'bigOrder' && (e.good ?? good)) out.add((e.good ?? good)!);
  }
  return [...out];
}

/**
 * Buy the Rumor: 징조를 들은 다음 날부터 신문에 나기 전날까지 그 사건 물품을 사고,
 * 신문에 난 날부터 판 이익의 합. 같은 매수는 한 사건에만 센다
 */
export function buyTheRumorProfit(state: EconomyState, record: SeasonRecord): number {
  const log = state.season?.log ?? [];
  const used = new Set<TradeRecord>();
  let total = 0;
  // 같은 사건 징조를 여러 번 들었으면 처음 들은 날로
  const heard = new Map<string, number>();
  for (const h of record.heardOmens) {
    const key = `${h.event}:${h.town}`;
    heard.set(key, Math.min(heard.get(key) ?? Infinity, h.day));
  }
  for (const e of log) {
    const day = heard.get(`${e.event}:${e.town}`);
    if (day === undefined || e.day <= day || e.day - day > R.rumorWindowDays) continue;
    for (const good of eventGoods(e.event, e.good)) {
      const basis = new CostBasis();
      const buys = record.trades.filter((t) => t.side === 'buy' && t.good === good && t.day > day && t.day < e.day && !used.has(t));
      if (!buys.length) continue;
      for (const t of buys) {
        basis.buy(t.qty, t.price);
        used.add(t);
      }
      const sells = record.trades.filter((t) => t.side === 'sell' && t.good === good && t.day >= e.day && t.day <= e.day + R.rumorWindowDays);
      for (const t of sells) total += basis.sell(t.qty, t.price);
    }
  }
  return total;
}

export function seasonScores(state: EconomyState, p: PlayerState): SeasonScores | null {
  const record = p.record;
  if (!record) return null;
  const bigShot = netWorth(state, p);
  const played = state.day - record.joinedDay;
  const goodsKing = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<GoodId, number>;
  for (const t of record.trades) if (t.side === 'sell') goodsKing[t.good] += t.qty;
  return {
    bigShot,
    multiplier: played >= R.multiplierMinDays && record.startWorth > 0 ? bigShot / record.startWorth : null,
    oneShot: bestSingleSale(record.trades),
    buyTheRumor: buyTheRumorProfit(state, record),
    goodsKing,
  };
}
