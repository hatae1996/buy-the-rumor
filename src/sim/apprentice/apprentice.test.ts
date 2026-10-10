// 견습 (기획서 "첫 5분의 흐름"): 7장면을 명령으로 차례로 지나고, 첫 이익은 반드시 나고, 탭이 하나씩 열린다.
import { describe, expect, it } from 'vitest';
import { cartCount, cartLots } from '../cart';
import { ECONOMY } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { hasExpeditions } from '../economy/player';
import { generateWorld, townTravelDays, type WorldMap } from '../worldgen';
import { seasonOfDay } from '../season';
import { ALL_UNLOCKS, SCENES } from './index';

const SEEDS = Array.from({ length: 15 }, (_, i) => i * 7919 + 3);

function world(seed: number): { map: WorldMap; state: EconomyState } {
  const map = generateWorld(seed);
  return { map, state: createEconomy(map, seed, { warmupDays: ECONOMY.warmupDays, apprentice: true }) };
}

const ok = (state: EconomyState, map: WorldMap, cmd: Parameters<typeof applyCommand>[3]) => {
  const r = applyCommand(state, map, 'me', cmd);
  expect(r, JSON.stringify(cmd)).toEqual(expect.objectContaining({ ok: true }));
};

/** 견습을 처음부터 끝까지 지난다. picks: 첫 원정 카드마다 고를 쪽 */
function graduate(state: EconomyState, map: WorldMap, picks = [1, 1, 0]): { firstProfit: number } {
  const scene = () => state.players.me!.apprentice?.scene;
  // 1. 시작 → 2. 첫 원정 (스크립트 카드 3장)
  ok(state, map, { type: 'startExpedition' });
  expect(scene()).toBe('firstExpedition');
  for (const pick of picks) ok(state, map, { type: 'chooseExpeditionCard', choice: pick });
  expect(state.players.me!.expedition).toBeNull();
  // 3. 첫 짐 싣기: 짐을 하나 돌려 본다
  expect(scene()).toBe('firstLoad');
  ok(state, map, { type: 'packCart' });
  // 4. 첫 판매: 추천 값(시세의 0.9)으로 다 내고 하루 보낸다
  expect(scene()).toBe('firstSale');
  const v = playerView(state, map, 'me');
  const goldBefore = state.players.me!.gold;
  for (const g of new Set(v.cargo.map((l) => l.good))) {
    const qty = v.cargo.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0);
    if (g === 'meat') continue; // 고기는 내일 먹을 수도 있으니 남겨 둔다
    ok(state, map, { type: 'placeSellOrder', good: g, qty, minPrice: Math.max(1, Math.round(v.market!.price[g] * 0.9)) });
  }
  advanceDay(state, map);
  const firstProfit = state.players.me!.gold - goldBefore;
  // 낸 것은 모두 팔렸다 (견습 마을 손님)
  expect(cartLots(state.players.me!.cart).filter((l) => l.good !== 'meat')).toEqual([]);
  // 5. 첫 신문: 소식 탭을 여는 것만으로는 넘어가지 않고, 신문팔이에게서 받아(무료) 읽는다 (0.1.2)
  expect(scene()).toBe('firstNews');
  ok(state, map, { type: 'readNews' });
  expect(scene()).toBe('firstNews');
  const gold = state.players.me!.gold;
  ok(state, map, { type: 'buyNewspaper' });
  expect(state.players.me!.gold).toBe(gold);
  const paper = playerView(state, map, 'me').newspaper.papers[0]!;
  expect(paper.headline).toContain('조선소');
  ok(state, map, { type: 'readPaper', day: paper.day });
  // 6. 첫 구매: 목재를 산다
  expect(scene()).toBe('firstBuy');
  const price = playerView(state, map, 'me').market!.price.wood;
  ok(state, map, { type: 'placeBuyOrder', good: 'wood', qty: 2, maxPrice: Math.round(price * 1.1) });
  advanceDay(state, map);
  // 7. 졸업: 손수레를 받고 첫 출발
  expect(scene()).toBe('graduation');
  expect(state.players.me!.cart.type).toBe('handcart');
  // 졸업 식량은 첫 두 번의 이동에 넉넉하게: 첫 길보다 많이, 길 둘을 갈 만큼 (0.1.3)
  const ap = state.players.me!.apprentice!;
  const firstTrip = Math.ceil(townTravelDays(map, seasonOfDay(state.day, state.startSeason))[ap.town]![ap.destination]!);
  expect(cartCount(state.players.me!.cart, 'rations')).toBeGreaterThan(firstTrip);
  // 그날 신문 한 부도 선물로 (0.1.6): 안 읽은 신문이고, 도시 시세가 실려 있다
  const gift = playerView(state, map, 'me').newspaper.papers[0]!;
  expect(gift.day).toBe(state.day - 1);
  expect(gift.read).toBe(false);
  expect(state.news.some((n) => n.day === gift.day && n.section === 'prices' && n.prices)).toBe(true);
  // 노상인이 견습 손님 값을 한 번 말해 둔다 (답 140)
  const hint = playerView(state, map, 'me').apprentice!.hint;
  const offered = Number(/목재 하나에 (\d+)골드는 쳐 줄 걸세/.exec(hint)?.[1]);
  expect(offered).toBeGreaterThan(0);
  ok(state, map, { type: 'travel', to: ap.destination });
  expect(state.players.me!.apprentice).toBeNull();
  // 로컬도 서버처럼 (답 141): 조선소는 신문에만, 목재는 가는 마을의 견습 손님이 말해 둔 값에
  expect(state.events.some((e) => e.event === 'shipyard' && e.town === ap.destination && e.start >= state.day - 3)).toBe(false);
  expect(state.players.me!.apprenticeGuest).toEqual({ town: ap.destination, good: 'wood', qty: cartCount(state.players.me!.cart, 'wood'), price: offered });
  // 그 마을 추천 최소 가격을 손님 값 이하로 맞추도록 화면에 알린다
  expect(playerView(state, map, 'me').apprenticeGuest).toMatchObject({ town: ap.destination, price: offered });
  return { firstProfit };
}

describe('견습 시작', () => {
  it('자원지가 있는 생산 마을에서 빈 등짐과 금화 50으로, 마을 화면만 열고 시작한다', () => {
    for (const seed of SEEDS) {
      const { state } = world(seed);
      const p = state.players.me!;
      expect(p.apprentice?.scene).toBe('start');
      expect(hasExpeditions(state.towns[p.town]!)).toBe(true);
      expect(p.gold).toBe(ECONOMY.apprentice.startGold);
      expect(p.cart.type).toBe('pack');
      expect(cartLots(p.cart)).toEqual([]);
      expect(p.unlocks).toEqual({});
      expect(p.apprentice!.destination).not.toBe(p.town);
    }
  });

  it('견습 없이 시작하면 처음부터 모두 열려 있다 (봇, 두 번째 시즌부터)', () => {
    const map = generateWorld(SEEDS[0]!);
    const state = createEconomy(map, SEEDS[0]!);
    expect(state.players.me!.apprentice).toBeNull();
    expect(Object.keys(state.players.me!.unlocks).sort()).toEqual([...ALL_UNLOCKS].sort());
  });
});

describe('7장면 (시드 15개)', () => {
  it('명령으로 차례로 지나고, 첫 판매는 반드시 이익이 난다', () => {
    for (const seed of SEEDS) {
      const { map, state } = world(seed);
      const { firstProfit } = graduate(state, map);
      expect(firstProfit, `시드 ${seed}`).toBeGreaterThan(0);
    }
  });

  it('첫 원정은 무엇을 골라도 다 성공하고, 얻은 짐이 등짐에 다 들어간다', () => {
    for (let combo = 0; combo < 8; combo++) {
      const { map, state } = world(SEEDS[combo]!);
      ok(state, map, { type: 'startExpedition' });
      for (let i = 0; i < 3; i++) ok(state, map, { type: 'chooseExpeditionCard', choice: (combo >> i) & 1 });
      const r = state.players.me!.lastExpedition!;
      expect(r.leftBehind, `조합 ${combo}`).toEqual([]);
      expect(r.log.every((l) => l.outcome !== 'failure')).toBe(true);
      if (combo !== 7) expect(r.loaded.length).toBeGreaterThan(0);
    }
  });

  it('탭이 짐칸 → 장부 → 소식 → 지도 순서로 열린다 (0.1.2: 짐칸은 첫 짐 싣기, 장부는 첫 판매 때)', () => {
    const { map, state } = world(SEEDS[1]!);
    expect(playerView(state, map, 'me').unlocks).toEqual([]);
    graduate(state, map);
    expect(playerView(state, map, 'me').unlocks).toEqual(expect.arrayContaining(['cart', 'ledger', 'news', 'map']));
    expect(state.players.me!.unlocks.cart! <= state.players.me!.unlocks.ledger!).toBe(true);
    expect(state.players.me!.unlocks.ledger! <= state.players.me!.unlocks.news!).toBe(true);
    expect(state.players.me!.unlocks.news! <= state.players.me!.unlocks.map!).toBe(true);
  });

  it('첫 신문에는 졸업하고 갈 마을의 사건이 실린다', () => {
    const { map, state } = world(SEEDS[2]!);
    const dest = state.players.me!.apprentice!.destination;
    graduate(state, map);
    expect(state.news.some((n) => n.text.includes(map.towns[dest]!.name))).toBe(true);
  });

  it('장면 수는 기획서대로 7개', () => {
    expect(SCENES.map((s) => s.id)).toEqual(['start', 'firstExpedition', 'firstLoad', 'firstSale', 'firstNews', 'firstBuy', 'graduation']);
  });
});

describe('견습 뒤에도 하나씩 열린다', () => {
  it('다른 마을에 처음 닿으면 내가 아는 시세와 소문이 열린다', () => {
    const { map, state } = world(SEEDS[3]!);
    graduate(state, map);
    expect(state.players.me!.unlocks.memory).toBeUndefined();
    while (state.players.me!.travel) advanceDay(state, map);
    expect(state.players.me!.unlocks.memory).toBeDefined();
    expect(state.players.me!.unlocks.rumors).toBeDefined();
  });

  it('장날에 다 안 팔리면 최소 가격을 직접 고칠 수 있게 된다', () => {
    const { map, state } = world(SEEDS[4]!);
    graduate(state, map);
    while (state.players.me!.travel) advanceDay(state, map);
    expect(state.players.me!.unlocks.editPrice).toBeUndefined();
    const wood = cartLots(state.players.me!.cart).filter((l) => l.good === 'wood').reduce((s, l) => s + l.qty, 0);
    if (wood === 0) return;
    // 아무도 안 살 값으로 내놓는다
    ok(state, map, { type: 'placeSellOrder', good: 'wood', qty: wood, minPrice: 999 });
    advanceDay(state, map);
    expect(state.players.me!.unlocks.editPrice).toBeDefined();
  });

  it('금화 300이면 예약 주문, 도시에 가면 은행이 열린다 (말과 큰 수레는 막지 않는다)', () => {
    const { map, state } = world(SEEDS[5]!);
    graduate(state, map);
    while (state.players.me!.travel) advanceDay(state, map);
    state.players.me!.gold = ECONOMY.apprentice.reservationGold;
    applyCommand(state, map, 'me', { type: 'readNews' });
    expect(state.players.me!.unlocks.reservation).toBeDefined();
    const city = map.towns.find((t) => t.tier === 'city')!;
    state.players.me!.town = city.id;
    applyCommand(state, map, 'me', { type: 'readNews' });
    expect(state.players.me!.unlocks.bank).toBeDefined();
  });
});
