// 판 모양이 바뀐 예전 저장 맞추기 (0.1.6 세로형 수레)
import { describe, expect, it } from 'vitest';
import { cartCount, createCart, fits, loadGoods, type Board } from './cart';
import { refitBoard, refitBoards } from './refit';

describe('예전 저장의 수레를 새 모양에 맞추기', () => {
  it('다 맞으면 그대로 둔다', () => {
    const c = createCart('handcart');
    loadGoods(c, 'wood', 1);
    loadGoods(c, 'salt', 2);
    const before = JSON.stringify(c);
    expect(refitBoard(c)).toBe(true);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('판 밖에 있던 짐(예전 가로형 자리)은 빈자리로 다시 놓고, 짐은 잃지 않는다', () => {
    const c = createCart('handcart');
    loadGoods(c, 'grain', 2);
    loadGoods(c, 'salt', 3);
    // 예전 6×3 손수레의 오른쪽 자리를 흉내 낸다
    c.pieces[0]!.x = 4;
    c.pieces[0]!.y = 1;
    expect(refitBoard(c)).toBe(true);
    expect(c.pieces.every((p) => fits(c, p.good, p.x, p.y, p.rot, p.id))).toBe(true);
    expect(cartCount(c, 'grain')).toBe(2);
    expect(cartCount(c, 'salt')).toBe(3);
  });

  it('망가진 칸은 판 안의 것만 남긴다', () => {
    const c = createCart('handcart');
    c.broken = ['5,1', '1,2'];
    refitBoard(c);
    expect(c.broken).toEqual(['1,2']);
  });

  it('상태 안의 모든 판을 찾아 맞춘다 (플레이어, 행렬, 창고)', () => {
    const a = createCart('carriage');
    loadGoods(a, 'wood', 1);
    a.pieces[0]!.x = 7;
    const store: Board = createCart('warehouse');
    loadGoods(store, 'ore', 1);
    const state = { players: { me: { cart: a, caravan: { cart: createCart('wagon') } } }, warehouses: [store] };
    expect(refitBoards(state)).toBe(1);
    expect(fits(a, 'wood', a.pieces[0]!.x, a.pieces[0]!.y, a.pieces[0]!.rot, a.pieces[0]!.id)).toBe(true);
  });
});
