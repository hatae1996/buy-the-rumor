// 장날 정산 (동시호가). 하루 동안 모인 사자·팔자 신청을 한꺼번에 맞춰 가격 하나를 정한다.
//
// 가격 고르는 순서:
//   1. 거래량이 가장 많은 가격
//   2. 그중 남는 신청(사자와 팔자 차이)이 가장 적은 가격
//   3. 그래도 여럿이면, 사자가 남으면 높은 쪽, 팔자가 남으면 낮은 쪽, 아니면 어제 시세에 가까운 쪽
// 그 가격보다 좋은 조건을 낸 신청은 다 채우고, 딱 그 가격의 신청은 양에 비례해 나눈다.
// 먼저 낸 신청이 유리하지 않아야 하므로(접속 시간이 이득이 되면 안 된다) 신청 순서는 보지 않는다.
import type { Rng } from '../rng';

export interface AuctionOrder {
  id: number;
  qty: number;
  /** 사자: 이 값까지 낸다. 팔자: 이 값 아래로는 안 판다 */
  limit: number;
}

export interface AuctionResult {
  /** 거래가 없으면 null */
  price: number | null;
  volume: number;
  /** 신청 id → 채워진 양 */
  buyFills: Map<number, number>;
  sellFills: Map<number, number>;
  /** 신청된 전체 양 (신청 현황 힌트에 쓴다) */
  demand: number;
  supply: number;
  /** 가장 비싸게 사려는 값, 가장 싸게 팔려는 값. 신청이 없으면 null */
  bestBid: number | null;
  bestAsk: number | null;
  /** 정산 가격에서 못 채운 사자 양 − 못 채운 팔자 양. 양수면 모자라고 음수면 남는다 */
  imbalance: number;
}

export function clearAuction(
  buys: readonly AuctionOrder[],
  sells: readonly AuctionOrder[],
  refPrice: number,
  rng: Rng,
): AuctionResult {
  const demand = sum(buys);
  const supply = sum(sells);
  const bestBid = buys.length ? Math.max(...buys.map((o) => o.limit)) : null;
  const bestAsk = sells.length ? Math.min(...sells.map((o) => o.limit)) : null;
  const empty: AuctionResult = {
    price: null,
    volume: 0,
    buyFills: new Map(),
    sellFills: new Map(),
    demand,
    supply,
    bestBid,
    bestAsk,
    imbalance: 0,
  };
  if (demand === 0 || supply === 0) return empty;

  // 정수 가격마다 사자 양(그 가격 이상을 낸 신청)과 팔자 양(그 가격 이하를 낸 신청)
  const top = Math.max(...buys.map((o) => o.limit), ...sells.map((o) => o.limit));
  const d = new Array<number>(top + 2).fill(0);
  const s = new Array<number>(top + 2).fill(0);
  for (const o of buys) d[o.limit]! += o.qty;
  for (const o of sells) s[o.limit]! += o.qty;
  for (let p = top - 1; p >= 1; p--) d[p]! += d[p + 1]!;
  for (let p = 2; p <= top; p++) s[p]! += s[p - 1]!;

  let best: { p: number; vol: number; imb: number; dMore: boolean; sMore: boolean }[] = [];
  let bestVol = 0;
  for (let p = 1; p <= top; p++) {
    const vol = Math.min(d[p]!, s[p]!);
    if (vol === 0 || vol < bestVol) continue;
    const row = { p, vol, imb: Math.abs(d[p]! - s[p]!), dMore: d[p]! > s[p]!, sMore: s[p]! > d[p]! };
    if (vol > bestVol) {
      bestVol = vol;
      best = [row];
    } else best.push(row);
  }
  if (bestVol === 0) return empty;

  const minImb = Math.min(...best.map((r) => r.imb));
  best = best.filter((r) => r.imb === minImb);
  let price: number;
  if (best.every((r) => r.dMore)) price = best[best.length - 1]!.p;
  else if (best.every((r) => r.sMore)) price = best[0]!.p;
  else price = best.reduce((a, r) => (Math.abs(r.p - refPrice) < Math.abs(a.p - refPrice) ? r : a)).p;

  const volume = Math.min(d[price]!, s[price]!);
  return {
    price,
    volume,
    buyFills: allocate(buys.filter((o) => o.limit >= price), volume, (a, b) => b - a, rng),
    sellFills: allocate(sells.filter((o) => o.limit <= price), volume, (a, b) => a - b, rng),
    demand,
    supply,
    bestBid,
    bestAsk,
    imbalance: d[price]! - s[price]!,
  };
}

/** 좋은 가격부터 채우고, 다 못 채우는 가격 단계에서는 양에 비례해 나눈다 */
function allocate(
  orders: readonly AuctionOrder[],
  volume: number,
  better: (a: number, b: number) => number,
  rng: Rng,
): Map<number, number> {
  const fills = new Map<number, number>();
  const levels = [...new Set(orders.map((o) => o.limit))].sort(better);
  let left = volume;
  for (const limit of levels) {
    if (left <= 0) break;
    const level = orders.filter((o) => o.limit === limit);
    const total = sum(level);
    if (total <= left) {
      for (const o of level) fills.set(o.id, o.qty);
      left -= total;
      continue;
    }
    // 비례 배분: 내림한 몫을 먼저 주고, 남은 낱개는 소수점이 큰 순서로 (같으면 제비뽑기)
    const shares = level.map((o) => {
      const exact = (o.qty * left) / total;
      return { o, n: Math.floor(exact), frac: exact - Math.floor(exact), tie: rng.next() };
    });
    let rest = left - shares.reduce((a, x) => a + x.n, 0);
    shares.sort((a, b) => b.frac - a.frac || a.tie - b.tie);
    for (const x of shares) {
      if (rest > 0 && x.n < x.o.qty) {
        x.n++;
        rest--;
      }
      if (x.n > 0) fills.set(x.o.id, x.n);
    }
    left = 0;
  }
  return fills;
}

function sum(orders: readonly AuctionOrder[]): number {
  return orders.reduce((a, o) => a + o.qty, 0);
}
