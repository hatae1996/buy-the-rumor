import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { clearAuction, type AuctionOrder } from './auction';

const rng = () => createRng(1);
const o = (id: number, qty: number, limit: number): AuctionOrder => ({ id, qty, limit });

describe('장날 정산', () => {
  it('맞는 신청이 없으면 거래 없음', () => {
    const r = clearAuction([o(1, 5, 8)], [o(2, 5, 10)], 9, rng());
    expect(r.price).toBeNull();
    expect(r.volume).toBe(0);
    expect(r.demand).toBe(5);
    expect(r.supply).toBe(5);
  });

  it('양쪽이 같으면 어제 시세에 가까운 가격', () => {
    const r = clearAuction([o(1, 10, 12)], [o(2, 10, 8)], 10, rng());
    expect(r.volume).toBe(10);
    expect(r.price).toBe(10);
  });

  it('사자가 남으면 가격이 오르고, 팔자가 남으면 내린다', () => {
    const up = clearAuction([o(1, 10, 12), o(2, 10, 11)], [o(3, 10, 8)], 9, rng());
    expect(up.volume).toBe(10);
    expect(up.price).toBe(12);
    const down = clearAuction([o(1, 10, 12)], [o(2, 10, 8), o(3, 10, 9)], 11, rng());
    expect(down.volume).toBe(10);
    expect(down.price).toBe(8);
  });

  it('더 좋은 가격을 낸 신청부터 채운다', () => {
    const r = clearAuction([o(1, 5, 20), o(2, 5, 10)], [o(3, 6, 5)], 10, rng());
    expect(r.buyFills.get(1)).toBe(5);
    expect(r.buyFills.get(2) ?? 0).toBeLessThanOrEqual(1);
  });

  it('같은 가격이면 신청 순서와 상관없이 양에 비례해 나눈다', () => {
    const a = clearAuction([o(1, 10, 10), o(2, 10, 10)], [o(3, 10, 10)], 10, rng());
    expect(a.buyFills.get(1)).toBe(5);
    expect(a.buyFills.get(2)).toBe(5);
    const b = clearAuction([o(1, 30, 10), o(2, 10, 10)], [o(3, 20, 10)], 10, rng());
    expect(b.buyFills.get(1)).toBe(15);
    expect(b.buyFills.get(2)).toBe(5);
  });

  describe('무작위 신청 500번', () => {
    const r = createRng(42);
    for (let t = 0; t < 500; t++) {
      const buys = Array.from({ length: r.int(0, 6) }, (_, i) => o(i, r.int(1, 20), r.int(1, 40)));
      const sells = Array.from({ length: r.int(0, 6) }, (_, i) => o(100 + i, r.int(1, 20), r.int(1, 40)));
      const res = clearAuction(buys, sells, r.int(1, 40), createRng(t));

      it(`#${t}`, () => {
        const bought = [...res.buyFills.values()].reduce((a, b) => a + b, 0);
        const sold = [...res.sellFills.values()].reduce((a, b) => a + b, 0);
        // 산 양 = 판 양 = 거래량
        expect(bought).toBe(res.volume);
        expect(sold).toBe(res.volume);
        if (res.price === null) return expect(res.volume).toBe(0);
        // 아무도 자기가 정한 값보다 비싸게 사거나 싸게 팔지 않는다
        for (const b of buys) if (res.buyFills.get(b.id)) expect(b.limit).toBeGreaterThanOrEqual(res.price);
        for (const s of sells) if (res.sellFills.get(s.id)) expect(s.limit).toBeLessThanOrEqual(res.price);
        // 신청한 양보다 많이 채우지 않는다
        for (const x of [...buys, ...sells]) {
          expect(res.buyFills.get(x.id) ?? res.sellFills.get(x.id) ?? 0).toBeLessThanOrEqual(x.qty);
        }
        // 가격 하나로 낼 수 있는 가장 많은 거래량이다
        let maxVol = 0;
        for (let p = 1; p <= 40; p++) {
          const d = buys.filter((b) => b.limit >= p).reduce((a, b) => a + b.qty, 0);
          const s = sells.filter((x) => x.limit <= p).reduce((a, x) => a + x.qty, 0);
          maxVol = Math.max(maxVol, Math.min(d, s));
        }
        expect(res.volume).toBe(maxVol);
      });
    }
  });
});
