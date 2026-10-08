// 플레이어에게 보이는 것만 골라 낸다. 화면은 실제 상태(EconomyState) 대신 이것만 그린다.
// 지금 있는 마을 시세만 정확히 알고, 다른 마을은 날짜가 붙은 기억으로만 안다.
import { cartLots, cartWeight, maxWeight, pieceCells, roomFor, stackLimit, type Cart, type CartType } from '../cart';
import { CART, ECONOMY } from '../constants';
import { seasonOfDay, type Season } from '../season';
import { hasExpeditions, innOf } from './player';
import { GOODS, type GoodId } from './goods';
import { totalCount, type Lot } from './inventory';
import { cardById, chanceOf } from '../expedition';
import { blockedTiles, tollAt } from '../events';
import type {
  EconomyState,
  ExpeditionResult,
  LedgerEntry,
  MarketResult,
  NewsItem,
  Order,
  PriceMemory,
  Rumor,
} from './state';

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
  /** 수레에 실린 물건 (묶음 목록) */
  cargo: readonly Lot[];
  /** 짐 + 팔자 신청에 맡긴 물건 */
  cargoCount: number;
  cart: CartView;
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
  /** 진행 중인 원정 */
  expedition: ExpeditionView | null;
  lastExpedition: ExpeditionResult | null;
  /** 들은 이야기 수첩 */
  rumors: readonly Rumor[];
  /** 몇 번째 시즌, 시즌의 며칠째, 시즌 길이 (미리 돌린 세계 전에는 null) */
  seasonInfo: { number: number; day: number; length: number } | null;
  /** 길 사정 (신문에 실린 사실): 막힌 칸, 마을마다 통행세 */
  roads: { blocked: number[]; tolls: Record<number, number> };
}

export interface ExpeditionView {
  town: number;
  card: {
    id: string;
    title: string;
    text: string;
    /** 결과는 대략만 보인다: "피로 +3 · 성공 가능성 높음" */
    choices: { label: string; hint: string }[];
  };
  /** 지금 카드 뒤에 남은 장 수 (연결 카드가 끼면 늘 수 있다) */
  left: number;
  haul: { good: GoodId; qty: number }[];
}

function expeditionView(state: EconomyState): ExpeditionView | null {
  const ex = state.player.expedition;
  if (!ex) return null;
  const card = cardById(ex.card);
  return {
    town: ex.town,
    card: {
      id: card.id,
      title: card.title,
      text: card.text,
      choices: card.choices.map((c) => {
        const parts = [c.fatigue > 0 ? `피로 +${c.fatigue}` : c.fatigue < 0 ? `피로 −${-c.fatigue}` : '피로 그대로'];
        if (c.chance) {
          const p = chanceOf(c.chance, state, ex.town);
          parts.push(p >= 0.7 ? '성공 가능성 높음' : p >= 0.45 ? '성공 가능성 반반' : '성공 가능성 낮음');
        }
        return { label: c.label, hint: parts.join(' · ') };
      }),
    },
    left: Math.max(0, ex.left),
    haul: ex.haul.map((h) => ({ ...h })),
  };
}

export interface CartPieceView {
  id: number;
  good: GoodId;
  x: number;
  y: number;
  rot: number;
  cells: (readonly [number, number])[];
  qty: number;
  stack: number;
  /** 장날 신청 때문에 잡아 둔 자리 */
  incoming: number;
  /** 사자 신청 자리면 'buy', 팔자 신청에서 돌아올 자리면 'sell' */
  pending: 'buy' | 'sell' | null;
  /** 가장 먼저 상할 묶음 */
  oldest: Lot | null;
}

export interface CartView {
  type: CartType;
  name: string;
  rows: readonly string[];
  pieces: CartPieceView[];
  weight: number;
  maxWeight: number;
  /** 물건마다 지금 더 실을 수 있는 개수 */
  room: Record<GoodId, number>;
}

function cartView(cart: Cart, orders: readonly Order[]): CartView {
  const sideOf = new Map(orders.map((o) => [o.id, o.side]));
  return {
    type: cart.type,
    name: CART.types[cart.type].name,
    rows: CART.types[cart.type].rows,
    pieces: cart.pieces.map((p) => ({
      id: p.id,
      good: p.good,
      x: p.x,
      y: p.y,
      rot: p.rot,
      cells: pieceCells(p),
      qty: p.lots.reduce((s, l) => s + l.qty, 0),
      stack: stackLimit(p.good),
      incoming: p.incoming.reduce((s, i) => s + i.qty, 0),
      pending: p.incoming.length ? (sideOf.get(p.incoming[0]!.orderId) ?? null) : null,
      oldest: p.lots.length ? p.lots.reduce((a, l) => (l.age > a.age ? l : a)) : null,
    })),
    weight: cartWeight(cart),
    maxWeight: maxWeight(cart),
    room: Object.fromEntries(GOODS.map((g) => [g, roomFor(cart, g)])) as Record<GoodId, number>,
  };
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
    cargo: cartLots(p.cart),
    cargoCount: totalCount(cartLots(p.cart)) + sellingQty,
    cart: cartView(p.cart, state.orders),
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
    expedition: expeditionView(state),
    lastExpedition: p.lastExpedition,
    rumors: p.rumors,
    seasonInfo: state.season
      ? { number: state.season.number, day: state.day - state.season.startDay + 1, length: state.season.length }
      : null,
    roads: {
      blocked: [...blockedTiles(state)].sort((a, b) => a - b),
      tolls: Object.fromEntries(
        state.towns.map((t) => [t.id, tollAt(state, t.id)] as const).filter(([, gold]) => gold > 0),
      ),
    },
  };
}
