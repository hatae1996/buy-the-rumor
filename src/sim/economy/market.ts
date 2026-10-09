// 마을 하나의 장날: 물품마다 정산하고, 돈과 물건을 주고받고, 시세를 옮긴다.
import { ECONOMY } from '../constants';
import type { Rng } from '../rng';
import type { Accounts } from './accounts';
import { clearAuction } from './auction';
import { basePrice, GOODS, priceBounds, type GoodId } from './goods';
import { takeOldest, type Lot } from './inventory';
import type { MarketResult, Order, OrderOwner, TownEconomy } from './state';

export interface Fill {
  /** 신청 번호 (견습 손님처럼 장 밖에서 맞춘 것은 없다) */
  orderId?: number;
  owner: OrderOwner;
  good: GoodId;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
}

/** 장날 규칙 (사건): 팔 수 없는 물품, 거래세 비율 */
export interface MarketRules {
  banned?: ReadonlySet<GoodId>;
  tax?: number;
}

export function runMarket(
  town: TownEconomy,
  orders: readonly Order[],
  accounts: Accounts,
  rng: Rng,
  rules: MarketRules = {},
): { results: Record<GoodId, MarketResult>; fills: Fill[] } {
  const results = {} as Record<GoodId, MarketResult>;
  const fills: Fill[] = [];

  for (const good of GOODS) {
    const buys = orders.filter((o) => o.good === good && o.side === 'buy');
    const sells = orders.filter((o) => o.good === good && o.side === 'sell');
    // 팔 수 없는 물품은 팔자 신청을 받지 않는다 (맡긴 물건은 그대로 돌려준다)
    const banned = rules.banned?.has(good) ?? false;
    const res = clearAuction(buys, banned ? [] : sells, town.refPrice[good], rng);
    const price = res.price ?? 0;

    // 팔린 물건을 한데 모은다
    const pool: Lot[] = [];
    for (const o of sells) {
      const n = res.sellFills.get(o.id) ?? 0;
      if (n > 0) {
        pool.push(...takeOldest(o.lots, good, n));
        // 거래세는 마을 금고로 (돈이 새지 않는다)
        const tax = Math.floor(n * price * (rules.tax ?? 0));
        accounts.addGold(o.owner, n * price - tax);
        town.treasury += tax;
        fills.push({ orderId: o.id, owner: o.owner, good, side: 'sell', qty: n, price });
      }
      accounts.receive(o.owner, o.lots, o.id);
      o.lots = [];
    }
    // 산 쪽에 오래된 것부터 나눠 주고 남은 돈을 돌려준다
    pool.sort((a, b) => b.age - a.age);
    for (const o of buys) {
      const n = res.buyFills.get(o.id) ?? 0;
      // 못 산 경우에도 넘겨야 잡아 둔 수레 자리가 풀린다
      accounts.receive(o.owner, n > 0 ? takeOldest(pool, good, n) : [], o.id);
      if (n > 0) fills.push({ orderId: o.id, owner: o.owner, good, side: 'buy', qty: n, price });
      accounts.addGold(o.owner, o.reserved - n * price);
      o.reserved = 0;
    }

    results[good] = {
      price: res.price,
      volume: res.volume,
      demand: res.demand,
      supply: res.supply,
      bestBid: res.bestBid,
      bestAsk: res.bestAsk,
      imbalance: res.imbalance,
    };
    updateRefPrice(town, good, results[good]);
  }
  return { results, fills };
}

/**
 * 정산 가격 쪽으로 천천히. 거래가 없으면 실제로 낸 신청 값 쪽으로만 조금 민다
 * (아무도 그 값에 사지 않는데 시세만 오르는 일이 없도록).
 */
export function updateRefPrice(town: TownEconomy, good: GoodId, r: MarketResult): void {
  const { priceSmoothing: s, idleDrift } = ECONOMY;
  let ref = town.refPrice[good];
  if (r.price !== null) {
    ref = ref * (1 - s) + r.price * s;
    // 그 가격에도 사려는 사람이 남았으면 조금 올리고, 팔려는 사람이 남았으면 조금 내린다
    if (r.volume > 0) ref *= 1 + idleDrift * Math.max(-1, Math.min(1, r.imbalance / r.volume));
  } else {
    // 맞지 않은 신청 사이의 가운데, 한쪽만 있으면 그쪽 값을 목표로
    const target =
      r.bestBid !== null && r.bestAsk !== null ? (r.bestBid + r.bestAsk) / 2 : (r.bestBid ?? r.bestAsk);
    if (target !== null) ref += Math.max(-ref * idleDrift, Math.min(ref * idleDrift, target - ref));
    // 아무도 사고팔려 하지 않으면 보통 값으로 천천히 돌아간다
    else ref += (basePrice(good) - ref) * ECONOMY.emptyReversion;
  }
  const { min, max } = priceBounds(good);
  town.refPrice[good] = Math.min(max, Math.max(min, ref));
}

/** 신청에 쓸 정수 가격 (기준 시세 × 배율, 가격 범위 안) */
export function limitPrice(town: TownEconomy, good: GoodId, factor: number): number {
  const { min, max } = priceBounds(good);
  return Math.min(max, Math.max(min, Math.round(town.refPrice[good] * factor)));
}
