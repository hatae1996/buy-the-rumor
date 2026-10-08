// 봇의 큰 주문 노리기 (0.0.7, 기획서 "큰 벌이는 사건에서 온다"): 징조 소문을 들으면 그 사건이 사들일 물품을
// 미리 모아 그 마을로 가고, 주문이 열리면 주문 값에 판다. 신문을 보고 늦게 움직이면 주문이 이미 차 있을 수 있다.
// 봇은 징조 문장이 말하는 사건과 마을만 안다 (NoteView.omen). 사건이 무엇을 얼마에 사는지는 사건 이름으로 안다
// (조선소는 목재, 군대는 염장 식품과 가죽: 사람이 소문을 듣고 짐작하는 것과 같다).
import { ECONOMY } from '../constants';
import type { Command, GoodId, PlayerView } from '../economy';
import { basePrice } from '../economy';
import { eventDef, type ScheduledEventId } from '../events';
import type { BotProfile } from './profiles';

export interface BigPlan {
  event: ScheduledEventId;
  town: number;
  goods: GoodId[];
  /** 물품마다 주문 값 (기준 가격 × 배율) */
  price: Partial<Record<GoodId, number>>;
  /** 주문이 열릴 가장 이른 날 (징조 + 가장 짧은 기간) */
  start: number;
  /** 이날까지 노린다 (징조 기한 + 사건 기간) */
  until: number;
}

/** 징조를 들은 지 이만큼 안이면 새로 노린다 */
const FRESH_DAYS = 2;

/** 수첩의 새 징조(들은 지 FRESH_DAYS일 안)로 노릴 수 있는 큰 주문들. 새로 들은 것부터 */
export function omenPlans(view: PlayerView, profile: BotProfile): BigPlan[] {
  if (!profile.trades) return [];
  const out: BigPlan[] = [];
  for (const n of [...view.rumors].reverse()) {
    if (!n.omen || view.day - n.day > FRESH_DAYS) continue;
    if (out.some((p) => p.event === n.omen!.event && p.town === n.omen!.town)) continue;
    const def = eventDef(n.omen.event);
    const orders = def.effects.flatMap((e) => (e.kind === 'bigOrder' && e.good ? [{ good: e.good, factor: e.factor }] : []));
    if (!orders.length) continue;
    const days = typeof def.days === 'number' ? def.days : 10;
    const lead = def.omenLead?.[1] ?? 3;
    const earliest = def.omenLead?.[0] ?? 1;
    out.push({
      event: n.omen.event,
      town: n.omen.town,
      goods: orders.map((o) => o.good),
      price: Object.fromEntries(orders.map((o) => [o.good, Math.round(basePrice(o.good) * o.factor)])),
      start: n.day + earliest,
      until: n.day + lead + days,
    });
  }
  return out;
}

/** 수첩의 새 징조로 노릴 큰 주문을 고른다. 지난 것은 버린다 */
export function updateBigPlan(view: PlayerView, plan: BigPlan | null, profile: BotProfile): BigPlan | null {
  if (plan && view.day > plan.until) plan = null;
  if (plan) return plan;
  return omenPlans(view, profile)[0] ?? null;
}

/** 이 물품을 노리는 큰 주문이 있으면 그 마을과 값 */
export function bigTarget(plan: BigPlan | null, good: GoodId): { town: number; price: number } | null {
  if (!plan || !plan.goods.includes(good)) return null;
  return { town: plan.town, price: plan.price[good]! };
}

/** 큰 주문에 팔려고 모은 물건은 다른 곳에 팔지 않는다 (주문 마을에서 주문이 열리기 전에도) */
export function holdForBigOrder(view: PlayerView, plan: BigPlan | null, good: GoodId): boolean {
  if (!plan || !plan.goods.includes(good)) return false;
  // 주문 마을에서 주문이 열렸으면 bigOrderSell이 판다
  return !(view.location.kind === 'town' && view.location.town === plan.town && view.bigOrders.some((o) => o.good === good));
}

/** 주문 마을에 와 있고 주문이 열렸으면 남은 양까지 주문 값 가까이에 판다 */
export function bigOrderSell(
  view: PlayerView,
  plan: BigPlan | null,
  selling: ReadonlySet<GoodId>,
  sellableQty: (view: PlayerView, good: GoodId) => number,
  once: (c: Command) => Command | null,
): Command | null {
  if (view.location.kind !== 'town') return null;
  for (const o of view.bigOrders) {
    if (selling.has(o.good)) continue;
    const qty = Math.min(sellableQty(view, o.good), o.left);
    if (qty <= 0) continue;
    // 노리지 않았어도 큰 주문이 열린 마을에 그 물건을 갖고 있으면 판다
    void plan;
    const c = once({ type: 'placeSellOrder', good: o.good, qty, minPrice: Math.max(1, Math.round(o.price * 0.9)) });
    if (c) return c;
  }
  return null;
}

/** 큰 주문 물품을 이 값 아래에서만 사 모은다 (주문 값의 비율) */
const BUY_UNDER = 0.7;
/** 큰 주문에 모아 갈 양 (수레가 허락하는 만큼, 이만큼까지) */
const GATHER_MAX = 60;
/** 모으는 데 쓸 돈 (가진 돈의 비율) */
const GATHER_BUDGET = 0.6;

/**
 * 큰 주문 노리기 한 걸음 (장사보다 먼저):
 * 주문 마을이 아닌 곳에서 그 물품이 싸면 사 모은다 → 모았으면 주문 마을로 간다 → 주문 마을에서는 주문이 열릴 때까지 기다린다.
 * 모을 곳을 모르면 기억하는 시세가 가장 싼 마을로 간다. 돌려주는 trip은 장사 계획(가져갈 마을)으로 쓴다
 */
export function bigPlanStep(
  view: PlayerView,
  plan: BigPlan | null,
  days: number[][],
  once: (c: Command) => Command | null,
): { command: Command | null; trip: { goods: GoodId[]; to: number; go: boolean } | null } {
  const none = { command: null, trip: null };
  if (!plan || view.location.kind !== 'town' || !view.market) return none;
  const here = view.location.town;
  // 주문 마을까지 가는 날을 넘기면 늦는다
  if (view.day + (days[here]![plan.town] ?? Infinity) > plan.until) return none;
  const held = view.haul.filter((l) => plan.goods.includes(l.good)).reduce((s, l) => s + l.qty, 0);
  const buying = view.orders.some((o) => o.side === 'buy' && plan.goods.includes(o.good));
  // 주문 마을: 모은 것이 있으면 주문이 열릴 때까지 머문다 (파는 것은 bigOrderSell)
  if (here === plan.town) return held > 0 ? { command: null, trip: { goods: plan.goods, to: here, go: false } } : none;
  // 주문이 열리기 전에 닿으려면 오늘이나 내일은 떠나야 하나
  const goNow = held >= GATHER_MAX || view.day + (days[here]![plan.town] ?? 0) + 1 >= plan.start;
  // 여기서 싸게 살 수 있으면 사 모은다
  for (const good of plan.goods) {
    const price = view.market.price[good];
    const cap = plan.price[good]! * BUY_UNDER;
    if (buying || goNow || price > cap || view.market.yesterday[good].supply === 0) continue;
    const maxPrice = Math.max(1, Math.round(Math.min(cap, price * 1.15)));
    const qty = Math.min(view.buyRoom[good], GATHER_MAX - held, Math.floor((view.gold * GATHER_BUDGET) / maxPrice));
    if (qty <= 0) continue;
    const c = once({ type: 'placeBuyOrder', good, qty, maxPrice });
    if (c) return { command: c, trip: { goods: plan.goods, to: plan.town, go: false } };
  }
  // 사 모으는 중이면 머물고, 떠날 때가 되면 주문 마을로
  if (buying) return { command: null, trip: { goods: plan.goods, to: plan.town, go: false } };
  if (held > 0) return { command: null, trip: { goods: plan.goods, to: plan.town, go: goNow } };
  // 모을 곳: 기억하는 시세가 주문 값의 BUY_UNDER배 아래인 마을 중 가까운 곳 (거기 갔다가 주문 마을까지 시간 안에)
  const fee = ECONOMY.player.travelFeePerDay;
  const source = Object.entries(view.memory)
    .map(([id, m]) => ({ town: Number(id), m }))
    .filter(({ town, m }) => town !== here && town !== plan.town && plan.goods.some((g) => m.prices[g] <= plan.price[g]! * BUY_UNDER))
    .filter(({ town }) => view.day + (days[here]![town] ?? Infinity) + (days[town]![plan.town] ?? Infinity) <= plan.until)
    .filter(({ town }) => view.gold > (days[here]![town]! + days[town]![plan.town]!) * fee * 2)
    .sort((a, b) => days[here]![a.town]! - days[here]![b.town]!)[0];
  if (source) {
    const c = once({ type: 'travel', to: source.town });
    if (c) return { command: c, trip: null };
  }
  return none;
}
