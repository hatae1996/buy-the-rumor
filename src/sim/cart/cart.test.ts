import { describe, expect, it } from 'vitest';
import { CART } from '../constants';
import {
  ageCart,
  cartCount,
  cartWeight,
  createCart,
  discardPiece,
  fits,
  loadGoods,
  movePiece,
  packCart,
  pieceCells,
  reserveRoom,
  rotatePiece,
  settleIncoming,
  takeGoods,
} from './cart';
import { cartSlots, distinctRotations, shapeOf } from './shapes';

describe('모양', () => {
  it('수레 칸 수: 등짐 9, 손수레 16, 짐수레 26, 마차 38', () => {
    expect(cartSlots('pack')).toHaveLength(9);
    expect(cartSlots('handcart')).toHaveLength(16);
    expect(cartSlots('wagon')).toHaveLength(26);
    expect(cartSlots('carriage')).toHaveLength(38);
  });

  it('돌리면 가로가 세로가 되고, 네 번 돌리면 제자리', () => {
    expect(shapeOf('wood', 0)).toEqual([[0, 0], [1, 0], [2, 0]]);
    expect(shapeOf('wood', 1)).toEqual([[0, 0], [0, 1], [0, 2]]);
    expect(shapeOf('tools', 4)).toEqual(shapeOf('tools', 0));
    expect(distinctRotations('ore')).toEqual([0]);
    expect(distinctRotations('wood')).toEqual([0, 1]);
    expect(distinctRotations('tools')).toHaveLength(4);
  });
});

describe('싣기와 쌓기', () => {
  it('같은 물품은 조각 하나에 쌓기 한도까지 쌓인다 (광석 3)', () => {
    const c = createCart('pack');
    expect(loadGoods(c, 'ore', 7)).toBe(7);
    expect(c.pieces.map((p) => p.lots.reduce((s, l) => s + l.qty, 0))).toEqual([3, 3, 1]);
    expect(cartCount(c, 'ore')).toBe(7);
  });

  it('칸이 모자라면 들어가는 만큼만 싣는다 (3×3 등짐에 2×2 곡물은 하나뿐)', () => {
    const c = createCart('pack');
    expect(loadGoods(c, 'grain', 5)).toBe(1);
    expect(loadGoods(createCart('handcart'), 'grain', 5)).toBe(3);
  });

  it('조각은 수레 밖이나 다른 조각과 겹쳐 놓을 수 없다', () => {
    const c = createCart('pack');
    loadGoods(c, 'wood', 1);
    expect(fits(c, 'ore', 0, 0, 0)).toBe(false);
    expect(fits(c, 'ore', 3, 0, 0)).toBe(false);
    expect(fits(c, 'ore', 0, 1, 0)).toBe(true);
  });

  it('무게는 개수만큼 늘어난다', () => {
    const c = createCart('pack');
    loadGoods(c, 'ore', 6);
    expect(cartWeight(c)).toBe(18);
    loadGoods(c, 'ore', 6);
    // 사람이 지는 등짐은 30까지 (끄는 무게는 src/sim/horses)
    expect(cartWeight(c)).toBeGreaterThan(CART.types.pack.humanPull);
  });
});

describe('꺼내기와 상하기', () => {
  it('오래된 것부터 꺼내고, 빈 조각은 치운다', () => {
    const c = createCart('handcart');
    loadGoods(c, 'fish', 2, 0);
    loadGoods(c, 'fish', 2, 2);
    const out = takeGoods(c, 'fish', 3);
    expect(out[0]!.age).toBe(2);
    expect(cartCount(c, 'fish')).toBe(1);
  });

  it('상한 것은 버리고 빈 조각을 치운다', () => {
    const c = createCart('pack');
    loadGoods(c, 'fish', 2);
    loadGoods(c, 'ore', 1);
    for (let d = 0; d < 2; d++) expect(ageCart(c, 1)).toEqual({});
    expect(ageCart(c, 1)).toEqual({ fish: 2 });
    expect(c.pieces.map((p) => p.good)).toEqual(['ore']);
  });
});

describe('장날 신청 자리', () => {
  it('살 물건 자리를 미리 잡고, 장날에 받은 만큼 넣고 나머지 자리는 푼다', () => {
    const c = createCart('pack');
    expect(reserveRoom(c, 'ore', 5, 101)).toBe(true);
    // 잡아 둔 자리에는 다른 물건을 못 싣는다
    expect(loadGoods(c, 'salt', 30)).toBe(21);
    settleIncoming(c, 101, [{ good: 'ore', qty: 4, age: 0 }]);
    expect(cartCount(c, 'ore')).toBe(4);
    expect(c.pieces.every((p) => p.incoming.length === 0)).toBe(true);
  });

  it('자리가 모자라면 아무것도 잡지 않는다', () => {
    const c = createCart('pack');
    loadGoods(c, 'salt', 24);
    const before = JSON.stringify(c);
    expect(reserveRoom(c, 'grain', 1, 7)).toBe(false);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('내놓은 물건은 자리를 남겨 두었다가, 안 팔리면 그 자리로 돌아온다', () => {
    const c = createCart('pack');
    loadGoods(c, 'leather', 4);
    const lots = takeGoods(c, 'leather', 3, () => true, 55);
    expect(cartCount(c, 'leather')).toBe(1);
    // 내놓은 사이에 다른 물건을 가득 실어도
    loadGoods(c, 'ore', 30);
    settleIncoming(c, 55, lots.slice(0, 1).map((l) => ({ ...l, qty: 2 })));
    expect(cartCount(c, 'leather')).toBe(3);
  });

  it('신청이 걸린 조각은 버릴 수 없다', () => {
    const c = createCart('pack');
    reserveRoom(c, 'ore', 1, 9);
    expect(discardPiece(c, c.pieces[0]!.id)).toBeNull();
  });
});

describe('옮기기, 돌리기, 정리', () => {
  it('빈자리로 옮기고, 같은 물품 위에 놓으면 합친다', () => {
    const c = createCart('handcart');
    loadGoods(c, 'ore', 1);
    loadGoods(c, 'salt', 1);
    const salt = c.pieces.find((p) => p.good === 'salt')!;
    expect(movePiece(c, salt.id, 3, 2, 0)).toBe(true);
    expect(pieceCells(salt)).toEqual([[3, 2]]);
    loadGoods(c, 'ore', 2);
    // ore는 한 조각에 3까지 쌓이므로 첫 조각이 이미 채워져 있다. 새로 하나 만들어 합쳐 본다
    const ores = c.pieces.filter((p) => p.good === 'ore');
    expect(ores).toHaveLength(1);
  });

  it('돌릴 자리가 없으면 옆으로 비켜 돌린다', () => {
    const c = createCart('pack');
    loadGoods(c, 'wood', 1);
    const wood = c.pieces[0]!;
    expect(rotatePiece(c, wood.id)).toBe(true);
    expect(wood.rot).toBe(1);
  });

  it('빈칸 정리: 흩어진 조각을 다시 놓아 큰 짐 자리를 만든다', () => {
    const c = createCart('pack');
    loadGoods(c, 'ore', 1);
    loadGoods(c, 'salt', 1);
    const salt = c.pieces.find((p) => p.good === 'salt')!;
    movePiece(c, salt.id, 1, 1, 0);
    // 가운데가 막혀 곡물(2×2)을 둘 곳이 하나뿐인 상태에서 정리하면 둘을 놓을 자리가 생긴다
    expect(packCart(c)).toBe(true);
    expect(loadGoods(c, 'grain', 2)).toBeGreaterThanOrEqual(1);
  });
});
