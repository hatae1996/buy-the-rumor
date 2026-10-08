// 플레이어에게 보이는 것만 골라 낸다. 화면은 실제 상태(EconomyState) 대신 이것만 그린다.
// 지금 있는 마을 시세만 정확히 알고, 다른 마을은 날짜가 붙은 기억으로만 안다.
import { CART_TYPES, cartCount, cartLots, cartWeight, pieceCells, roomFor, stackLimit, type Cart, type CartType } from '../cart';
import {
  buyPrice,
  cartCost,
  feedPrice,
  HORSE_KINDS,
  horseDays,
  horsePull,
  horsesNeeded,
  maxWeight,
  sellPrice,
  stableAt,
  type Horse,
  type HorseKind,
} from '../horses';
import { townTravelDays, type WorldMap } from '../worldgen';
import { playerTravelDays } from './travel';
import { CART, ECONOMY, HORSES, RUMORS } from '../constants';
import { seasonOfDay, type Season } from '../season';
import { hasExpeditions, innOf } from './player';
import { GOODS, type GoodId } from './goods';
import { totalCount, type Lot } from './inventory';
import { iGa } from '../josa';
import { cardById, chanceOf, choiceFatigue, GEAR_KINDS, guideFee, needsMet, type GearKind } from '../expedition';
import { blockedTiles, tollAt } from '../events';
import type {
  ActiveExpedition,
  EconomyState,
  ExpeditionResult,
  LedgerEntry,
  MarketResult,
  NewsItem,
  Order,
  PriceMemory,
} from './state';
import { drinkFee, type HeardRumor } from '../rumors';

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
  /** 들은 이야기 수첩. 도장 판정용 주장은 빼고 보인다 */
  rumors: readonly NoteView[];
  /** 지금 마을 여관의 술 한 잔 (소문 1개 더). 길 위면 null */
  drink: { fee: number; drank: boolean } | null;
  /** 전서구: 한 번 값과 날려 보낸 마을 (다음 날 시세가 온다) */
  pigeon: { fee: number; pending: number[] };
  /** 정보원을 심어 둔 마을 */
  informants: readonly number[];
  /** 몇 번째 시즌, 시즌의 며칠째, 시즌 길이 (미리 돌린 세계 전에는 null) */
  seasonInfo: { number: number; day: number; length: number } | null;
  /** 길 사정 (신문에 실린 사실): 막힌 칸, 마을마다 통행세 */
  roads: { blocked: number[]; tolls: Record<number, number> };
  /** 지금 마을(길 위면 떠난 마을)에서 마을마다 걸리는 날. usual은 막힌 길이 없을 때 (말 걸음 포함) */
  travel: { days: number[]; usual: number[] };
  /** 내 말 */
  horses: HorseView[];
  /** 지금 마을 마구간에서 하는 일: 먹이 값, 쉬게 하기. 길 위면 null */
  horseCare: { feedPrice: number; restFee: number; rested: boolean } | null;
  /** 목장 마을 마구간 (남은 수는 여기 와야만 보인다). 마구간이 없는 마을이나 길 위면 null */
  stable: StableView | null;
  /** 수레방: 수레마다 바꾸는 값 (쓰던 수레를 쳐 준 뒤) */
  carts: CartOffer[];
  /** 내 장비와 잡화점 (어느 마을이나). 길 위면 살 수 없다 */
  gear: GearView[];
  /** 수레에 실은 도구 수 (원정에서 나무 베기·광석 캐기에 쓰고, 장비를 고친다) */
  tools: number;
  /** 여관 안내인: 고용 값과 고용했는지. 원정을 못 나가는 마을이나 길 위면 null */
  guide: { fee: number; hired: boolean } | null;
}

export interface HorseKindInfo {
  kind: HorseKind;
  name: string;
  pull: number;
  /** 이동 일수 배율 (1이 사람 걸음) */
  speed: number;
  feed: number;
}

export interface HorseView extends HorseKindInfo {
  id: number;
  fatigue: number;
  fatigueMax: number;
  /** 많이 지쳐 빨리 달리지 못한다 */
  tired: boolean;
  /** 연달아 굶은 날 */
  hungry: number;
  /** 지금 끄는 무게 (다 지치면 절반) */
  pulling: number;
  /** 이 마을 마구간에 되팔 값. 마구간이 없으면 null */
  sellPrice: number | null;
}

export interface StableView {
  town: number;
  horses: (HorseKindInfo & { stock: number; price: number | null })[];
}

export interface CartOffer {
  type: CartType;
  name: string;
  rows: readonly string[];
  /** 말 없이 끌 수 있는 무게 (짐수레·마차는 0) */
  humanPull: number;
  horses: number;
  /** 지금 수레를 쳐 주고 내는 값. 지금 수레면 null */
  cost: number | null;
}

const kindInfo = (kind: HorseKind): HorseKindInfo => {
  const k = HORSES.kinds[kind];
  return { kind, name: k.name, pull: k.pull, speed: k.speed, feed: k.feed };
};

function horseView(h: Horse, stable: ReturnType<typeof stableAt>): HorseView {
  return {
    ...kindInfo(h.kind),
    id: h.id,
    fatigue: h.fatigue,
    fatigueMax: HORSES.fatigue.max,
    tired: h.fatigue >= HORSES.fatigue.tiredAt,
    hungry: h.hungry,
    pulling: horsePull(h),
    sellPrice: stable ? sellPrice(stable, h.kind) : null,
  };
}

export interface GearView {
  kind: GearKind;
  name: string;
  price: number;
  /** 남은 쓰는 횟수. 안 가졌으면 null, 0이면 망가짐 */
  uses: number | null;
  maxUses: number;
}

export type NoteView = Omit<HeardRumor, 'claim' | 'rumor'>;

/** 수첩 한 줄을 화면용으로: 도장 판정용 주장과 세계 소문 번호는 뺀다 */
export function noteView({ claim: _claim, rumor: _rumor, ...rest }: HeardRumor): NoteView {
  return rest;
}

export interface ExpeditionChoiceView {
  /** 명령에 보낼 번호 (chooseExpeditionCard) */
  index: number;
  label: string;
  /** 결과는 대략만 보인다: "피로 +3 · 성공 가능성 높음 · 도구 1개" */
  hint: string;
  /** 고를 수 없는 까닭 (도구가 없음). 고를 수 있으면 null */
  disabled: string | null;
  /** 장비나 말이 연 선택지 */
  extra: boolean;
}

export interface ExpeditionView {
  town: number;
  card: {
    id: string;
    title: string;
    text: string;
    /** 장비나 말이 없어 열리지 않은 선택지는 빠진다. 앞의 둘이 왼쪽·오른쪽 */
    choices: ExpeditionChoiceView[];
  };
  /** 이번 원정에 붙은 상태 (무더위, 눈 덮인 길 등) */
  flags: string[];
  /** 안내인이 아직 따라오고 있나 */
  guide: boolean;
  /** 지금 카드 뒤에 남은 장 수 (연결 카드가 끼면 늘 수 있다) */
  left: number;
  haul: { good: GoodId; qty: number }[];
}

const FLAG_TEXT: Record<ActiveExpedition['flags'][number], string> = {
  heat: '무더위: 생선과 고기가 빨리 상해요',
  snow: '눈 덮인 길: 카드마다 피로 +1',
  fatDeer: '살찐 사슴: 사슴 고기 +1',
  harvest: '수확철: 농부를 도우면 곡물 +1',
  packHorse: '말에 실은 바구니: 얻는 것마다 +1',
};

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
      choices: card.choices.flatMap((c, index): ExpeditionChoiceView[] => {
        const unmet = needsMet(state, c.needs);
        // 장비나 말이 여는 덧붙은 선택지(셋째부터)는 없으면 보이지 않는다. 왼쪽·오른쪽은 보이되 고를 수 없다
        if ((unmet === 'needGear' || unmet === 'noHorse') && index >= 2) return [];
        const f = choiceFatigue(c, ex);
        const parts = [f > 0 ? `피로 +${f}` : f < 0 ? `피로 −${-f}` : '피로 그대로'];
        if (c.chance) {
          const p = chanceOf(c.chance, state, ex.town);
          parts.push(p >= 0.7 ? '성공 가능성 높음' : p >= 0.45 ? '성공 가능성 반반' : '성공 가능성 낮음');
        }
        if (c.needs?.tool) parts.push(`도구 ${c.needs.tool}개`);
        if (c.needs?.gear) parts.push(ECONOMY.expedition.gear[c.needs.gear].name);
        if (c.needs?.horse) parts.push('말');
        return [
          {
            index,
            label: c.label,
            hint: parts.join(' · '),
            disabled: unmet === null ? null : unmet === 'needTool' ? '도구가 없어요' : unmet === 'noHorse' ? '말이 없어요' : `${iGa(ECONOMY.expedition.gear[c.needs!.gear!].name)} 없어요`,
            extra: index >= 2,
          },
        ];
      }),
    },
    flags: ex.flags.map((f) => FLAG_TEXT[f]),
    guide: ex.guide,
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
  /** 지금 말로 끌 수 있는 무게. 말이 모자라면 0 */
  maxWeight: number;
  /** 움직이려면 있어야 하는 말 수 (짐수레 1, 마차 2) */
  horsesNeeded: number;
  /** 물건마다 지금 더 실을 수 있는 개수 */
  room: Record<GoodId, number>;
}

function cartView(cart: Cart, orders: readonly Order[], horses: readonly Horse[]): CartView {
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
    maxWeight: maxWeight(cart, horses),
    horsesNeeded: horsesNeeded(cart),
    room: Object.fromEntries(GOODS.map((g) => [g, roomFor(cart, g)])) as Record<GoodId, number>,
  };
}

export function playerView(state: EconomyState, map: WorldMap): PlayerView {
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
  // 마구간 남은 수는 그 마을에 있을 때만 보인다
  const stable = p.travel ? null : stableAt(state, p.town);
  const reserved = state.orders.reduce((s, o) => s + o.reserved, 0);
  const sellingQty = state.orders.filter((o) => o.side === 'sell').reduce((s, o) => s + o.qty, 0);

  return {
    day: state.day,
    season: seasonOfDay(state.day, state.startSeason),
    gold: p.gold,
    reserved,
    cargo: cartLots(p.cart),
    cargoCount: totalCount(cartLots(p.cart)) + sellingQty,
    cart: cartView(p.cart, state.orders, p.horses),
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
    rumors: p.rumors.map(noteView),
    drink: p.travel ? null : { fee: drinkFee(state, p.town), drank: p.drankToday },
    pigeon: { fee: RUMORS.pigeonFee, pending: p.pigeons.map((pg) => pg.town) },
    informants: p.informants,
    seasonInfo: state.season
      ? { number: state.season.number, day: state.day - state.season.startDay + 1, length: state.season.length }
      : null,
    roads: {
      blocked: [...blockedTiles(state)].sort((a, b) => a - b),
      tolls: Object.fromEntries(
        state.towns.map((t) => [t.id, tollAt(state, t.id)] as const).filter(([, gold]) => gold > 0),
      ),
    },
    travel: {
      days: playerTravelDays(state, map),
      usual: townTravelDays(map, seasonOfDay(state.day, state.startSeason))[p.travel ? p.travel.from : p.town]!.map((d) =>
        horseDays(d, p.horses),
      ),
    },
    horses: p.horses.map((h) => horseView(h, stable)),
    horseCare: p.travel
      ? null
      : { feedPrice: feedPrice(state, p.town), restFee: HORSES.fatigue.rest.fee * p.horses.length, rested: p.horsesRested },
    stable: stable
      ? { town: stable.town, horses: HORSE_KINDS.map((k) => ({ ...kindInfo(k), stock: stable.stock[k], price: buyPrice(stable, k) })) }
      : null,
    gear: GEAR_KINDS.map((kind) => ({
      kind,
      name: ECONOMY.expedition.gear[kind].name,
      price: ECONOMY.expedition.gear[kind].price,
      uses: p.gear[kind] ?? null,
      maxUses: ECONOMY.expedition.gear[kind].durability,
    })),
    tools: cartCount(p.cart, 'tools'),
    guide: p.travel || !hasExpeditions(state.towns[p.town]!) ? null : { fee: guideFee(state, p.town), hired: p.guide },
    carts: CART_TYPES.map((type) => ({
      type,
      name: CART.types[type].name,
      rows: CART.types[type].rows,
      humanPull: CART.types[type].humanPull,
      horses: CART.types[type].horses,
      cost: type === p.cart.type ? null : cartCost(p.cart.type, type),
    })),
  };
}
