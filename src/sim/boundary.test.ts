// 멀티플레이 준비 (기획서 "멀티플레이 구조", 0.0.5):
// 1) 시뮬은 서버에서 그대로 돈다: 화면·시간 API를 쓰지 않고, Math.random 대신 시드 난수만.
// 2) 플레이어에게 보내는 정보(playerView)에는 숨겨진 숫자가 없다.
// 3) 수레 최종 배치는 명령 하나로 보내고 시뮬이 다시 검사한다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cartCount, cartWeight, createCart, loadGoods } from './cart';
import { advanceDay, applyCommand, createEconomy, playerView } from './economy';
import { generateWorld } from './worldgen';

function simFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return simFiles(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('시뮬은 서버에서 그대로 돈다', () => {
  const files = simFiles(join(__dirname));
  const banned: [RegExp, string][] = [
    [/Math\.random\s*\(/, 'Math.random (시드 난수만 쓴다)'],
    [/Date\.now\s*\(|new Date\s*\(/, '실제 시간'],
    [/setTimeout|setInterval|requestAnimationFrame/, '타이머'],
    [/\bdocument\.|\bwindow\.|localStorage/, '화면·저장소'],
    [/from ['"]three['"]|from ['"]\.\.\/(ui|view3d|dev)\//, '화면 코드'],
  ];

  it('시뮬 파일이 있다', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const [re, what] of banned) {
    it(`${what}을(를) 쓰지 않는다`, () => {
      const hits = files.filter((f) =>
        readFileSync(f, 'utf-8')
          .split('\n')
          .some((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && re.test(line)),
      );
      expect(hits).toEqual([]);
    });
  }
});

describe('플레이어에게 보내는 정보에는 숨겨진 숫자가 없다', () => {
  it('일꾼, 금고, 자원지 남은 양, 소문의 진짜 여부, 소문꾼 성격, 사건 일정, 다른 마구간 재고가 보이지 않는다', () => {
    const map = generateWorld(20261008);
    const s = createEconomy(map, 20261008, { warmupDays: 20 });
    for (let d = 0; d < 20; d++) advanceDay(s, map);
    const json = JSON.stringify(playerView(s, map));
    for (const key of ['"workers"', '"treasury"', '"amount"', '"capacity"', '"truth"', '"personality"', '"schedule"', '"fakeOmens"', '"rumorMill"', '"refPrice"', '"stables"']) {
      expect(json, key).not.toContain(key);
    }
  });

  it('가 본 마을을 따로 기억한다 (서버가 이 경계로 보낸다)', () => {
    const map = generateWorld(20261008);
    const s = createEconomy(map, 20261008);
    expect(playerView(s, map).visited).toEqual([s.player.town]);
    const to = map.towns.find((t) => t.id !== s.player.town)!.id;
    applyCommand(s, map, { type: 'travel', to });
    while (s.player.travel) advanceDay(s, map);
    expect(playerView(s, map).visited).toContain(to);
  });
});

describe('수레 최종 배치 명령', () => {
  const map = generateWorld(3);

  it('맞는 배치는 그대로 받고, 무게와 짐 수는 바뀌지 않는다', () => {
    const s = createEconomy(map, 3);
    s.player.cart = createCart('pack');
    loadGoods(s.player.cart, 'ore', 3);
    loadGoods(s.player.cart, 'wood', 1);
    const w = cartWeight(s.player.cart);
    const [ore, wood] = s.player.cart.pieces;
    // 목재(1×3)를 세로로 세우고 광석을 오른쪽 위로
    const r = applyCommand(s, map, {
      type: 'arrangeCart',
      pieces: [
        { id: wood!.id, x: 0, y: 0, rot: 1 },
        { id: ore!.id, x: 2, y: 0, rot: 0 },
      ],
    });
    expect(r.ok).toBe(true);
    expect(cartWeight(s.player.cart)).toBe(w);
    expect(cartCount(s.player.cart, 'ore')).toBe(3);
  });

  it('겹치거나, 칸 밖이거나, 조각이 빠지면 아무것도 바꾸지 않는다', () => {
    const s = createEconomy(map, 3);
    s.player.cart = createCart('pack');
    loadGoods(s.player.cart, 'ore', 3);
    loadGoods(s.player.cart, 'wood', 1);
    const before = JSON.stringify(s.player.cart);
    const [ore, wood] = s.player.cart.pieces;
    const bad = [
      [{ id: wood!.id, x: 0, y: 0, rot: 0 }, { id: ore!.id, x: 1, y: 0, rot: 0 }],
      [{ id: wood!.id, x: 1, y: 0, rot: 0 }, { id: ore!.id, x: 0, y: 2, rot: 0 }],
      [{ id: wood!.id, x: 0, y: 0, rot: 0 }],
      [{ id: wood!.id, x: 0, y: 1, rot: 0 }, { id: 9999, x: 0, y: 0, rot: 0 }],
    ];
    for (const pieces of bad) {
      expect(applyCommand(s, map, { type: 'arrangeCart', pieces })).toEqual({ ok: false, error: 'badArrangement' });
      expect(JSON.stringify(s.player.cart)).toBe(before);
    }
  });
});
