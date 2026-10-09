// 멀티플레이 준비 (기획서 "멀티플레이 구조", 0.0.5):
// 1) 플레이어에게 보내는 정보(playerView)에는 숨겨진 숫자가 없다.
// 2) 수레 최종 배치는 명령 하나로 보내고 시뮬이 다시 검사한다.
// 시뮬이 화면·시간 API 없이 서버에서 그대로 도는지는 tests/sim-purity.test.ts가 본다.
import { describe, expect, it } from 'vitest';
import { cartCount, cartWeight, createCart, loadGoods } from './cart';
import { advanceDay, applyCommand, createEconomy, playerView } from './economy';
import { generateWorld } from './worldgen';

describe('플레이어에게 보내는 정보에는 숨겨진 숫자가 없다', () => {
  it('일꾼, 금고, 자원지 남은 양, 소문의 진짜 여부, 소문꾼 성격, 사건 일정, 다른 마구간 재고가 보이지 않는다', () => {
    const map = generateWorld(20261008);
    const s = createEconomy(map, 20261008, { warmupDays: 20 });
    for (let d = 0; d < 20; d++) advanceDay(s, map);
    const json = JSON.stringify(playerView(s, map, 'me'));
    for (const key of ['"workers"', '"treasury"', '"amount"', '"capacity"', '"truth"', '"personality"', '"schedule"', '"fakeOmens"', '"rumorMill"', '"refPrice"', '"stables"']) {
      expect(json, key).not.toContain(key);
    }
  });

  it('가 본 마을을 따로 기억한다 (서버가 이 경계로 보낸다)', () => {
    const map = generateWorld(20261008);
    const s = createEconomy(map, 20261008);
    expect(playerView(s, map, 'me').visited).toEqual([s.players.me!.town]);
    const to = map.towns.find((t) => t.id !== s.players.me!.town)!.id;
    applyCommand(s, map, 'me', { type: 'travel', to });
    while (s.players.me!.travel) advanceDay(s, map);
    expect(playerView(s, map, 'me').visited).toContain(to);
  });
});

describe('수레 최종 배치 명령', () => {
  const map = generateWorld(3);

  it('맞는 배치는 그대로 받고, 무게와 짐 수는 바뀌지 않는다', () => {
    const s = createEconomy(map, 3);
    s.players.me!.cart = createCart('pack');
    loadGoods(s.players.me!.cart, 'ore', 3);
    loadGoods(s.players.me!.cart, 'wood', 1);
    const w = cartWeight(s.players.me!.cart);
    const [ore, wood] = s.players.me!.cart.pieces;
    // 목재(1×3)를 세로로 세우고 광석을 오른쪽 위로
    const r = applyCommand(s, map, 'me', {
      type: 'arrangeCart',
      pieces: [
        { id: wood!.id, x: 0, y: 0, rot: 1 },
        { id: ore!.id, x: 2, y: 0, rot: 0 },
      ],
    });
    expect(r.ok).toBe(true);
    expect(cartWeight(s.players.me!.cart)).toBe(w);
    expect(cartCount(s.players.me!.cart, 'ore')).toBe(3);
  });

  it('겹치거나, 칸 밖이거나, 조각이 빠지면 아무것도 바꾸지 않는다', () => {
    const s = createEconomy(map, 3);
    s.players.me!.cart = createCart('pack');
    loadGoods(s.players.me!.cart, 'ore', 3);
    loadGoods(s.players.me!.cart, 'wood', 1);
    const before = JSON.stringify(s.players.me!.cart);
    const [ore, wood] = s.players.me!.cart.pieces;
    const bad = [
      [{ id: wood!.id, x: 0, y: 0, rot: 0 }, { id: ore!.id, x: 1, y: 0, rot: 0 }],
      [{ id: wood!.id, x: 1, y: 0, rot: 0 }, { id: ore!.id, x: 0, y: 2, rot: 0 }],
      [{ id: wood!.id, x: 0, y: 0, rot: 0 }],
      [{ id: wood!.id, x: 0, y: 1, rot: 0 }, { id: 9999, x: 0, y: 0, rot: 0 }],
    ];
    for (const pieces of bad) {
      expect(applyCommand(s, map, 'me', { type: 'arrangeCart', pieces })).toEqual({ ok: false, error: 'badArrangement' });
      expect(JSON.stringify(s.players.me!.cart)).toBe(before);
    }
  });
});
