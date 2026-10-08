// 플레이어에게 보이는 것만 골라 낸다. 화면은 실제 상태(EconomyState) 대신 이것만 그린다.
// 지금 있는 마을 시세만 정확히 알고, 다른 마을은 날짜가 붙은 기억으로만 안다.
import { ECONOMY } from '../constants';
import { seasonOfDay, type Season } from '../season';
import { hasExpeditions, innOf } from './player';
import { GOODS, type GoodId } from './goods';
import { totalCount, type Lot } from './inventory';
import type { EconomyState, LedgerEntry, MarketResult, NewsItem, PriceMemory } from './state';

export type PlayerLocation =
  | { kind: 'town'; town: number }
  | { kind: 'road'; from: number; to: number; days: number; daysLeft: number };

export interface MarketView {
  town: number;
  /** 오늘 기준 시세 (반올림) */
  price: Record<GoodId, number>;
  /** 전에 본 시세. 처음 온 마을이면 null */
  previous: Record<GoodId, number> | null;
  /** 어제 장날 결과: 정산 가격, 거래량, 사려는 양과 팔려는 양 */
  yesterday: Record<GoodId, MarketResult>;
}

export interface PendingOrder {
  id: number;
  good: GoodId;
  side: 'buy' | 'sell';
  qty: number;
  limit: number;
}

export interface PlayerView {
  /** 오늘 (이날 장날에 신청이 정산된다) */
  day: number;
  season: Season;
  gold: number;
  /** 사자 신청에 맡겨 둔 돈 */
  reserved: number;
  capacity: number;
  cargo: readonly Lot[];
  /** 짐 + 팔자 신청에 맡긴 물건 */
  cargoCount: number;
  location: PlayerLocation;
  /** 길 위면 null */
  market: MarketView | null;
  orders: PendingOrder[];
  memory: Readonly<Record<number, PriceMemory>>;
  ledger: readonly LedgerEntry[];
  news: readonly NewsItem[];
  fatigue: number;
  fatigueMax: number;
  /** 많이 지쳐서 원정 결과가 나빠지는 상태 */
  tired: boolean;
  expeditionChances: number;
  /** 지금 마을에서 원정을 나갈 수 있나 (자원지가 있는 마을, 길 위가 아님) */
  canExpedition: boolean;
  mealsLeft: number;
  /** 지금 마을 여관. 길 위면 null */
  inn: { fee: number; recovery: number; rested: boolean } | null;
}

export function playerView(state: EconomyState): PlayerView {
  const p = state.player;
  const location: PlayerLocation = p.travel
    ? { kind: 'road', from: p.travel.from, to: p.travel.to, days: p.travel.days, daysLeft: p.travel.daysLeft }
    : { kind: 'town', town: p.town };

  let market: MarketView | null = null;
  if (!p.travel) {
    const t = state.towns[p.town]!;
    const price = {} as Record<GoodId, number>;
    for (const g of GOODS) price[g] = Math.round(t.refPrice[g]);
    market = {
      town: p.town,
      price,
      previous: p.memory[p.town]?.previous ?? null,
      yesterday: { ...t.lastMarket },
    };
  }

  const orders = state.orders.map((o) => ({ id: o.id, good: o.good, side: o.side, qty: o.qty, limit: o.limit }));
  const reserved = state.orders.reduce((s, o) => s + o.reserved, 0);
  const sellingQty = state.orders.filter((o) => o.side === 'sell').reduce((s, o) => s + o.qty, 0);

  return {
    day: state.day,
    season: seasonOfDay(state.day, state.startSeason),
    gold: p.gold,
    reserved,
    capacity: p.capacity,
    cargo: p.cargo,
    cargoCount: totalCount(p.cargo) + sellingQty,
    location,
    market,
    orders,
    memory: p.memory,
    ledger: p.ledger,
    news: state.news,
    fatigue: p.fatigue,
    fatigueMax: ECONOMY.fatigue.max,
    tired: p.fatigue >= ECONOMY.fatigue.tiredAt,
    expeditionChances: p.expeditionChances,
    canExpedition: !p.travel && hasExpeditions(state.towns[p.town]!),
    mealsLeft: ECONOMY.fatigue.mealsPerDay - p.mealsToday,
    inn: p.travel ? null : { ...innOf(state.towns[p.town]!), rested: p.restedToday },
  };
}
