// 봇의 두 번째 행렬 (0.0.8, 기획서 "두 번째 행렬은 큰 주문 도구다"):
// 같은 길을 도는 반복 지시는 쓰지 않는다 (장이 넘쳐 잃었다, questions.md 73번). 징조를 들으면 행렬을 꾸려
// 싼 마을에서 그 물품을 사 모아 주문 마을로 보내고, 주문 마을에서 주문 값 가까이에 판다. 지시는 늘 한 번짜리.
// 내가 노리는 큰 주문과 다른 것이 있으면 행렬은 그쪽을 맡는다 (다른 곳의 다른 기회).
// 마부 일당이 크므로 노릴 것이 없으면 행렬을 불러들여 풀고 마부를 내보낸다.
// 0.0.9: 수레는 사지 않고 수레방에서 빌린다 (풀면 돌려준다). 마부는 쉬는 날 일당이 적다 (questions.md 77번).
import { CART, GROWTH, HORSES } from '../constants';
import type { Command, GoodId, PlayerView } from '../economy';
import { omenPlans, type BigPlan } from './bigOrder';
import type { BotProfile } from './profiles';
import { CYCLE_DAYS } from '../season';

export interface CaravanMind {
  /** 행렬이 맡은 큰 주문 */
  target: BigPlan | null;
  /** 행렬이 노릴 것 없이 쉰 첫날 */
  idleSince: number | null;
  /** 처음 행렬을 꾸린 날 */
  formed: number | null;
  /** 주문이 열리지 않아 그만둔 큰 주문 (사건:마을). 다시 노리지 않는다 (0.0.9) */
  dropped: string[];
}

export function createCaravanMind(): CaravanMind {
  return { target: null, idleSince: null, formed: null, dropped: [] };
}

/** 주문 값의 이 비율 아래인 마을에서 사 모은다 */
const BUY_UNDER = 0.7;
/** 주문 마을에서 주문 값의 이 비율 이상이면 판다 */
const SELL_AT = 0.9;
/** 모으는 데 쓸 돈 (가진 돈의 비율) */
const BUDGET = 0.4;
/** 노릴 것 없이 이만큼 쉬면 행렬을 푼다 */
const IDLE_DAYS = 3;
/** 행렬로 노릴 만한지: 예상 이익이 그동안 드는 마부 일당과 말 먹이의 이 배는 되어야 한다 */
const WORTH = 1.2;
/** 싼 마을에서 며칠 장날에 걸쳐 사 모으나 (장날 하루에 나오는 양은 많지 않다) */
const BUY_DAYS = 3;
/** 장날 하루에 사 모을 수 있다고 보는 양 (어림) */
const PER_MARKET = 12;
/** 시즌 끝이 이만큼 안 남았으면 새로 꾸리지 않는다 (말값과 수레값을 되찾을 날이 없다) */
const LATE_DAYS = 20;
/** 말 먹이 곡물 하나 값 (어림) */
const FEED_PRICE = 8;
/** 징조를 믿는 정도: 헛징조가 시즌에 1~3개 돈다 (0.0.9: 헛징조를 쫓아 행렬을 꾸린 판이 손해였다) */
const OMEN_TRUST = 0.75;
/** 주문이 열릴 가장 늦은 날에서 이만큼 지나도 주문 마을에서 안 팔리면 그만둔다 */
const GIVE_UP_AFTER = 1;

const planKey = (p: BigPlan) => `${p.event}:${p.town}`;

const cargoOf = (view: PlayerView): Partial<Record<GoodId, number>> => {
  const out: Partial<Record<GoodId, number>> = {};
  for (const p of view.caravan?.cart.pieces ?? []) out[p.good] = (out[p.good] ?? 0) + p.qty;
  return out;
};

/** 행렬 수레(손수레나 짐수레)에 알아서 싣기로 실을 수 있는 대략의 양 (칸 80%, 말이 끄는 무게) */
function loadEstimate(cart: 'handcart' | 'wagon', pull: number, good: GoodId): number {
  const slots = CART.types[cart].rows.join('').split('').filter((x) => x === '#').length;
  const g = CART.goods[good];
  const byCells = Math.floor((slots * GROWTH.caravan.autoLoadShare) / g.shape.length) * g.stack;
  return Math.min(byCells, Math.floor(pull / g.weight));
}

interface Source {
  town: number;
  good: GoodId;
  /** 기억하는 시세 */
  price: number;
}

/**
 * 사 모을 곳: 기억하는 시세가 주문 값의 BUY_UNDER배 아래이고, 거기서 며칠 사 모아 주문 마을까지 시간 안에 닿는 마을.
 * 하나당 남는 값이 큰 것부터, 같으면 가까운 곳
 */
function bestSource(view: PlayerView, t: BigPlan, from: number, days: number[][]): Source | null {
  return (
    Object.entries(view.memory)
      .map(([id, m]) => ({ town: Number(id), m }))
      .filter(({ town }) => town !== t.town && view.day + (days[from]![town] ?? Infinity) + BUY_DAYS + (days[town]![t.town] ?? Infinity) <= t.until)
      .flatMap(({ town, m }) => t.goods.map((good) => ({ town, good, price: m.prices[good] })))
      .filter((x) => x.price <= t.price[x.good]! * BUY_UNDER)
      .sort((a, b) => t.price[b.good]! - b.price - (t.price[a.good]! - a.price) || days[from]![a.town]! - days[from]![b.town]!)[0] ?? null
  );
}

/**
 * 이 큰 주문을 행렬로 노리면 남는가: 사 모을 양 × (파는 값 − 기억하는 값) ≥ 드는 돈 × WORTH.
 * 드는 돈: 팔 때까지 마부 일당(일하는 날), 말 먹이, 빌린 수레 값 + 팔고 쉬다 푸는 며칠(쉬는 날 일당) + 새로 산 말을 되팔 때 잃는 값.
 * 팔 때까지 = 사 모을 곳에 가서 사흘 사고 주문 마을에 닿는 날 (주문이 열리기 전이면 열릴 때까지) + 주문을 기다리는 며칠.
 * 헛징조도 있으니 남는 값은 OMEN_TRUST만큼만 믿는다
 */
function worthIt(
  view: PlayerView,
  t: BigPlan,
  src: Source | null,
  from: number,
  days: number[][],
  cart: 'handcart' | 'wagon',
  pull: number,
  carter: { wage: number; restWage: number | null },
  feed: number,
  horsePrice = 0,
): boolean {
  if (!src) return false;
  const qty = Math.min(loadEstimate(cart, pull, src.good), BUY_DAYS * PER_MARKET);
  const gain = qty * (t.price[src.good]! * SELL_AT - src.price) * OMEN_TRUST;
  const daily = feed * FEED_PRICE + CART.rentPerDay[cart];
  const reach = (days[from]![src.town] ?? Infinity) + BUY_DAYS + (days[src.town]![t.town] ?? Infinity);
  const work = Math.max(t.start - view.day, reach) + (t.latest - t.start) / 2 + 1;
  const cost = (carter.wage + daily) * work + ((carter.restWage ?? carter.wage) + daily) * IDLE_DAYS + horsePrice * (1 - HORSES.resale);
  return gain >= cost * WORTH;
}

/** 빌릴 행렬 수레: 짐수레를 끌 만한 말(손수레에 다 실은 무게보다 많이 끄는 말)이고 이 마을에서 빌릴 수 있으면 짐수레, 아니면 손수레 */
function rentCart(view: PlayerView, pull: number): 'handcart' | 'wagon' | null {
  const can = (type: 'handcart' | 'wagon') => view.carts.some((x) => x.type === type && x.rentPerDay !== null);
  if (pull > CART.types.handcart.humanPull && can('wagon')) return 'wagon';
  return can('handcart') ? 'handcart' : null;
}

/** 행렬이 맡을 큰 주문: 새 징조 중 내가 노리는 것과 다른 것을 먼저, 없으면 같은 것 */
function pickTarget(view: PlayerView, mind: CaravanMind, own: BigPlan | null, profile: BotProfile): BigPlan | null {
  if (mind.target && view.day <= mind.target.until) return mind.target;
  const plans = omenPlans(view, profile).filter((p) => p.until - view.day >= 6 && !mind.dropped.includes(planKey(p)));
  const same = (p: BigPlan) => own !== null && p.event === own.event && p.town === own.town;
  return plans.find((p) => !same(p)) ?? plans[0] ?? null;
}

/**
 * 두 번째 행렬 한 걸음: 꾸리기(말 → 마부 → 수레방에서 꾸리기) → 한 번짜리 지시 → 쉬면 풀기.
 * 내가 마을에 있을 때만 부른다
 */
export function caravanBigStep(
  view: PlayerView,
  profile: BotProfile,
  mind: CaravanMind,
  own: BigPlan | null,
  days: number[][],
  once: (c: Command) => Command | null,
): Command | null {
  const growth = profile.growth;
  if (!growth?.caravan || view.location.kind !== 'town') return null;
  mind.target = pickTarget(view, mind, own, profile);
  const t = mind.target;
  const carter = view.hires.find((h) => h.role === 'carter');
  const c = view.caravan;

  if (!c) {
    // 말이나 마부를 추첨으로 기다리는 중이면 결과를 본다 (0.1.0: 다음 날 받는다)
    if (view.draws.some((d) => d.kind === 'horse' || d.role === 'carter')) return null;
    const spare = view.horses.slice(view.cart.horsesNeeded);
    const horse = spare[0];
    // 꾸릴 수레는 이 마을 수레방에서 빌린다 (0.0.9). 꾸리는 데는 비상금만 있으면 된다 (말을 사느라 돈이 줄어도 꾸릴 수 있게)
    const cart = horse ? rentCart(view, horse.pull) : null;
    const canForm = t !== null && horse !== undefined && cart !== null && view.gold - CART.rentPerDay[cart] >= growth.reserve;
    // 마부는 수레방 마을에서 데려와 그날 꾸린다. 꾸릴 수 없는 마부는 일당만 나가니 바로 내보낸다
    if (carter) {
      if (!canForm) return once({ type: 'dismissHire', hireId: carter.id });
      const cmd = once({ type: 'formCaravan', horseIds: [horse!.id], cart: cart!, rent: true });
      if (cmd) mind.formed ??= view.day;
      return cmd;
    }
    if (!t) {
      // 노릴 것이 없으면 남는 말을 판다
      const sell = spare.find((h) => h.sellPrice !== null);
      return sell ? once({ type: 'sellHorse', horseId: sell.id }) : null;
    }
    if (view.gold < growth.caravanGold || CYCLE_DAYS - ((view.day - 1) % CYCLE_DAYS) <= LATE_DAYS) return null;
    const offer = view.hireBoard.find((o) => o.role === 'carter');
    const wage = offer ?? { wage: GROWTH.hire.carter.wage, restWage: GROWTH.hire.carter.restWage };
    const src = bestSource(view, t, view.location.town, days);
    // 1. 말: 남는 말이 없으면 마구간에서 가장 많이 끄는 말. 그 마을에서 바로 꾸릴 수 있을 때만 산다 (꾸리지 못한 말은 먹이만 먹는다)
    if (!horse) {
      if (!offer) return null;
      const pick = view.stable?.horses
        .filter((h) => h.stock > 0 && h.price !== null && view.gold - h.price >= growth.caravanGold)
        .sort((a, b) => b.pull - a.pull)[0];
      const pickCart = pick ? rentCart(view, pick.pull) : null;
      if (!pick || !pickCart || !worthIt(view, t, src, view.location.town, days, pickCart, pick.pull, wage, pick.feed, pick.price!)) return null;
      return once({ type: 'buyHorse', kind: pick.kind });
    }
    // 2. 마부 (수레방이 있는 마을에서만, 꾸릴 만할 때)
    if (!canForm || !offer || !worthIt(view, t, src, view.location.town, days, cart!, horse.pull, offer, HORSES.kinds[horse.kind].feed)) return null;
    return once({ type: 'hire', role: 'carter' });
  }

  // 행렬이 있다: 길 위이거나 지시서를 따르는 중이면 둔다
  if (c.travel || c.plan || !c.carter) return null;
  const cargo = cargoOf(view);
  const at = c.town;

  // 주문 마을에서 주문이 열릴 가장 늦은 날이 지나도 안 팔렸으면 헛징조였거나 이미 찼다: 그만두고 남은 짐을 판다
  if (t && at === t.town && view.day > t.latest + GIVE_UP_AFTER && t.goods.some((g) => (cargo[g] ?? 0) > 0)) {
    mind.dropped.push(planKey(t));
    mind.target = null;
    return caravanBigStep(view, profile, mind, own, days, once);
  }

  if (t) {
    mind.idleSince = null;
    const held = t.goods.filter((g) => (cargo[g] ?? 0) > 0);
    const sells = held.map((g) => ({ good: g, qty: 'all' as const, minPrice: Math.max(1, Math.round(t.price[g]! * SELL_AT)) }));
    // 모은 것이 있으면 주문 마을로 가서 판다 (주문 마을이면 열릴 때까지 날마다 다시 낸다)
    if (held.length && view.day + (days[at]![t.town] ?? Infinity) <= t.until) {
      return once({ type: 'setCaravanPlan', plan: { stops: [{ town: t.town, buys: [], sells }], repeat: false } });
    }
    // 빈 행렬: 기억하는 시세가 싼 마을에 가서 장날 며칠에 걸쳐 사 모은 뒤 주문 마을로
    if (!held.length) {
      const source = bestSource(view, t, at, days);
      if (source) {
        const maxPrice = Math.max(1, Math.round(Math.min(t.price[source.good]! * BUY_UNDER, source.price * 1.15)));
        // 하루치 (사 모으는 날마다 같은 양을 신청한다. 마부는 칸 80%까지만 싣는다)
        const qty = Math.floor((view.gold * BUDGET) / maxPrice / BUY_DAYS);
        if (qty > 0) {
          const buy = { town: source.town, buys: [{ good: source.good, qty, maxPrice }], sells: [] };
          return once({
            type: 'setCaravanPlan',
            plan: {
              stops: [
                ...Array.from({ length: BUY_DAYS }, () => buy),
                { town: t.town, buys: [], sells: [{ good: source.good, qty: 'all', minPrice: Math.max(1, Math.round(t.price[source.good]! * SELL_AT)) }] },
              ],
              repeat: false,
            },
          });
        }
      }
    }
  }

  // 노릴 것이 없거나 끝났다: 남은 짐은 행렬이 있는 마을에서 판다
  const left = (Object.keys(cargo) as GoodId[]).filter((g) => (cargo[g] ?? 0) > 0);
  if (left.length && (!t || view.day > t.until)) {
    const prices = view.memory[at]?.prices;
    const sells = left.map((g) => ({ good: g, qty: 'all' as const, minPrice: Math.max(1, Math.round((prices?.[g] ?? 1) * 0.8)) }));
    return once({ type: 'setCaravanPlan', plan: { stops: [{ town: at, buys: [], sells }], repeat: false } });
  }
  if (t) return null;
  // 쉬는 행렬: 오래 쉬면 불러들여 푼다 (마부는 행렬이 풀린 뒤 위에서 내보낸다)
  mind.idleSince ??= view.day;
  if (view.day - mind.idleSince < IDLE_DAYS || left.length) return null;
  if (c.here) return once({ type: 'disbandCaravan' });
  return c.recalled ? null : once({ type: 'recallCaravan' });
}
