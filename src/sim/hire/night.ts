// 밤마다 일꾼: 일당을 받고(못 받으면 떠난다), 채집꾼은 그 마을에서 원정한 것을 창고에 넣는다.
// 채집꾼은 카드를 고르지 않고 평균 결과로 일한다: 마을 일꾼이 하루 거두는 양 × 맡긴 일 효율.
// 창고가 없거나 차면 거둔 것은 버려진다 (기획서: 결과는 그 마을 창고로).
import { cartLots, loadGoods } from '../cart';
import { ECONOMY, GROWTH } from '../constants';
import type { GoodId } from '../economy/goods';
import { JOB_RESOURCE, type GatherJob } from '../economy/jobs';
import { depletes, findNode, nodeYield } from '../economy/nodes';
import type { EconomyState } from '../economy/state';
import { produceFactor } from '../events/active';
import { createRng, mixSeed, stochasticRound, type Rng } from '../rng';
import { seasonOfDay } from '../season';
import { release, type Hire } from './hire';

/** 채집꾼 하루: 평균 결과 (마을 일꾼이 하루 거두는 양 × 효율). 자원지가 준다 */
export function gathererYield(state: EconomyState, h: Hire, rng: Rng): { good: GoodId; qty: number }[] {
  const job = h.job as GatherJob;
  const town = state.towns[h.town]!;
  const node = findNode(town, JOB_RESOURCE[job]);
  if (!node) return [];
  const season = seasonOfDay(state.day, state.startSeason);
  const factor = GROWTH.gathererShare * nodeYield(node) * ECONOMY.seasonYield[job][season];
  const out: { good: GoodId; qty: number }[] = [];
  let used = 0;
  for (const [good, base] of Object.entries(ECONOMY.gather[job]) as [GoodId, number][]) {
    let qty = stochasticRound(base * factor * produceFactor(state, town.id, good), rng);
    if (used === 0 && node.amount < qty) qty = Math.floor(node.amount);
    if (used === 0) used = qty;
    if (qty > 0) out.push({ good, qty });
  }
  if (depletes(node.kind)) node.amount = Math.max(0, node.amount - used);
  return out;
}

/** 밤에: 일당, 채집꾼 일. 하루 일당 합을 장부에 한 줄로 */
export function hireNight(state: EconomyState): void {
  const p = state.player;
  if (!p.hires.length) return;
  const rng = createRng(mixSeed(state.seed, 0x41e3, state.day));
  let paid = 0;
  for (const h of [...p.hires]) {
    // 일당을 못 받으면 떠난다 (빚이 되지 않는다). 짐꾼 수레의 짐은 내 수레로 옮기고, 못 실으면 길에 두고 간다
    if (p.gold < h.wage) {
      if (h.board) for (const l of cartLots(h.board)) loadGoods(p.cart, l.good, l.qty, l.age);
      release(state, h);
      p.ledger.push({ day: state.day, kind: 'hire', what: 'quit', role: h.role, name: h.name, town: h.town, fee: 0 });
      continue;
    }
    p.gold -= h.wage;
    state.towns[h.town]!.treasury += h.wage;
    paid += h.wage;
    if (h.role === 'gatherer') {
      const got = gathererYield(state, h, rng);
      const w = p.warehouses.find((x) => x.town === h.town);
      const stored: { good: GoodId; qty: number }[] = [];
      let lost = 0;
      for (const g of got) {
        const n = w ? loadGoods(w.board, g.good, g.qty, 0) : 0;
        if (n > 0) stored.push({ good: g.good, qty: n });
        lost += g.qty - n;
      }
      if (got.length) p.ledger.push({ day: state.day, kind: 'gathered', town: h.town, name: h.name, goods: stored, lost });
    }
  }
  if (paid) p.ledger.push({ day: state.day, kind: 'hire', what: 'wage', role: null, name: null, town: p.town, fee: paid });
}
