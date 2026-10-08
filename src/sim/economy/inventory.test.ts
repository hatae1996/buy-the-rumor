import { describe, expect, it } from 'vitest';
import { addGoods, ageAndSpoil, capStorage, count, spoilingSoon, takeOldest, type Inventory } from './inventory';

describe('짐과 부패', () => {
  it('오래된 것부터 꺼낸다', () => {
    const inv: Inventory = [];
    addGoods(inv, 'fish', 3, 2);
    addGoods(inv, 'fish', 5, 0);
    const out = takeOldest(inv, 'fish', 4);
    expect(out).toEqual([
      { good: 'fish', qty: 3, age: 2 },
      { good: 'fish', qty: 1, age: 0 },
    ]);
    expect(count(inv, 'fish')).toBe(4);
  });

  it('생선은 3일, 고기는 5일이면 상하고, 목재는 안 상한다', () => {
    const inv: Inventory = [];
    addGoods(inv, 'fish', 2);
    addGoods(inv, 'meat', 2);
    addGoods(inv, 'wood', 2);
    expect(ageAndSpoil(inv)).toEqual({});
    expect(ageAndSpoil(inv)).toEqual({});
    expect(spoilingSoon(inv, 'fish')).toBe(2);
    expect(ageAndSpoil(inv)).toEqual({ fish: 2 });
    expect(ageAndSpoil(inv)).toEqual({});
    expect(ageAndSpoil(inv)).toEqual({ meat: 2 });
    for (let i = 0; i < 100; i++) ageAndSpoil(inv);
    expect(count(inv, 'wood')).toBe(2);
    expect(count(inv, 'fish')).toBe(0);
  });

  it('여름엔 빨리, 겨울엔 천천히 상한다', () => {
    const summer: Inventory = [];
    addGoods(summer, 'fish', 1);
    expect(ageAndSpoil(summer, 1.5)).toEqual({});
    expect(ageAndSpoil(summer, 1.5)).toEqual({ fish: 1 });
    const winter: Inventory = [];
    addGoods(winter, 'fish', 1);
    for (let d = 0; d < 5; d++) expect(ageAndSpoil(winter, 0.5)).toEqual({});
    expect(ageAndSpoil(winter, 0.5)).toEqual({ fish: 1 });
  });

  it('같은 물품, 같은 나이는 한 묶음', () => {
    const inv: Inventory = [];
    addGoods(inv, 'grain', 2);
    addGoods(inv, 'grain', 3);
    expect(inv).toHaveLength(1);
  });

  it('창고 한도를 넘으면 새것부터 버린다', () => {
    const inv: Inventory = [];
    addGoods(inv, 'ore', 20, 5);
    addGoods(inv, 'ore', 20, 0);
    expect(capStorage(inv, 30)).toBe(10);
    expect(count(inv, 'ore')).toBe(30);
    expect(inv.find((l) => l.age === 5)!.qty).toBe(20);
  });
});
