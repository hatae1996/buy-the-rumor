// 짐: 물품을 들여온 날짜(나이)가 같은 묶음(lot)으로 갖고 있는다. 음식은 나이가 차면 상한다.
// 꺼낼 때는 오래된 것부터 꺼낸다.
import { GOODS, shelfLife, type GoodId } from './goods';

export interface Lot {
  good: GoodId;
  qty: number;
  /**
   * 상한 정도 (날). 하루마다 계절에 따라 늘어난다 (여름 1.5, 겨울 0.5).
   * 보관 기간에 닿으면 상한다. 0이면 갓 생긴 것
   */
  age: number;
}

export type Inventory = Lot[];

export function count(inv: readonly Lot[], good: GoodId): number {
  let n = 0;
  for (const l of inv) if (l.good === good) n += l.qty;
  return n;
}

export function totalCount(inv: readonly Lot[]): number {
  return inv.reduce((s, l) => s + l.qty, 0);
}

/** 같은 물품, 같은 나이면 합친다 */
export function addLot(inv: Inventory, lot: Lot): void {
  if (lot.qty <= 0) return;
  const same = inv.find((l) => l.good === lot.good && l.age === lot.age);
  if (same) same.qty += lot.qty;
  else inv.push({ ...lot });
}

export function addGoods(inv: Inventory, good: GoodId, qty: number, age = 0): void {
  addLot(inv, { good, qty, age });
}

/** 오래된 것부터 qty만큼 꺼낸다. 모자라면 있는 만큼만 */
export function takeOldest(inv: Inventory, good: GoodId, qty: number): Lot[] {
  const lots = inv.filter((l) => l.good === good).sort((a, b) => b.age - a.age);
  const out: Lot[] = [];
  let left = qty;
  for (const l of lots) {
    if (left <= 0) break;
    const n = Math.min(l.qty, left);
    l.qty -= n;
    left -= n;
    out.push({ good, qty: n, age: l.age });
  }
  removeEmpty(inv);
  return out;
}

/** 하루가 지나 상한 정도를 올리고(rate: 계절 배율), 상한 것을 버린다. 버린 양을 돌려준다 */
export function ageAndSpoil(inv: Inventory, rate = 1): Partial<Record<GoodId, number>> {
  const spoiled: Partial<Record<GoodId, number>> = {};
  for (const l of inv) {
    l.age += rate;
    const life = shelfLife(l.good);
    if (life !== null && l.age >= life) {
      spoiled[l.good] = (spoiled[l.good] ?? 0) + l.qty;
      l.qty = 0;
    }
  }
  removeEmpty(inv);
  return spoiled;
}

/** 곧 상하는 양 (하루가 더 지나면 상하는 묶음). rate는 오늘 계절의 상하는 배율 */
export function spoilingSoon(inv: readonly Lot[], good: GoodId, rate = 1): number {
  const life = shelfLife(good);
  if (life === null) return 0;
  return inv.filter((l) => l.good === good && l.age + rate >= life).reduce((s, l) => s + l.qty, 0);
}

/** 장에 낼 수 있는 양: 내일이면 상할 묶음은 장에 낼 수 없다 (산 사람이 바로 버리게 되므로) */
export function sellableCount(inv: readonly Lot[], good: GoodId, rate = 1): number {
  return count(inv, good) - spoilingSoon(inv, good, rate);
}

/** 장에 낼 수 있는 묶음 중 오래된 것부터 qty만큼 꺼낸다 */
export function takeSellable(inv: Inventory, good: GoodId, qty: number, rate = 1): Lot[] {
  const life = shelfLife(good);
  const ok = (l: Lot) => l.good === good && (life === null || l.age + rate < life);
  const lots = inv.filter(ok).sort((a, b) => b.age - a.age);
  const out: Lot[] = [];
  let left = qty;
  for (const l of lots) {
    if (left <= 0) break;
    const n = Math.min(l.qty, left);
    l.qty -= n;
    left -= n;
    out.push({ good, qty: n, age: l.age });
  }
  removeEmpty(inv);
  return out;
}

/** 물품마다 한도를 넘는 양을 버린다. 넘친 건 막 들어온 것이라 새것부터 버린다 */
export function capStorage(inv: Inventory, perGood: number): number {
  let dropped = 0;
  for (const g of GOODS) {
    let over = count(inv, g) - perGood;
    if (over <= 0) continue;
    const lots = inv.filter((l) => l.good === g).sort((a, b) => a.age - b.age);
    for (const l of lots) {
      if (over <= 0) break;
      const n = Math.min(l.qty, over);
      l.qty -= n;
      over -= n;
      dropped += n;
    }
  }
  removeEmpty(inv);
  return dropped;
}

function removeEmpty(inv: Inventory): void {
  for (let i = inv.length - 1; i >= 0; i--) if (inv[i]!.qty <= 0) inv.splice(i, 1);
}
