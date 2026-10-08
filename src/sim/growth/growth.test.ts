// 살 수 있는 것과 마을 건물 (기획서 "성장", "화면 구성 - 마을 탭", 0.0.5).
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { applyCommand, createEconomy, playerView } from '../economy';
import { hasExpeditions } from '../economy/player';
import { horseMorning, stableTowns } from '../horses';
import { generateWorld } from '../worldgen';
import { BUILDINGS, buildingAlerts, PURCHASES, purchasesAt, townBuildings } from './index';

const SEEDS = Array.from({ length: 20 }, (_, i) => i * 7919 + 3);

describe('마을 건물', () => {
  it('시장·여관·잡화점·창고는 모든 마을, 바깥은 자원지 마을, 마구간은 목장 마을, 수레방은 목재 마을과 도시, 작업장·은행·길드 회관은 도시', () => {
    for (const seed of SEEDS) {
      const map = generateWorld(seed);
      const s = createEconomy(map, seed);
      horseMorning(s, map);
      for (const t of map.towns) {
        const b = townBuildings(s, map, t.id);
        const city = t.tier === 'city';
        for (const id of ['market', 'inn', 'store', 'warehouse'] as const) expect(b).toContain(id);
        expect(b.includes('outside')).toBe(hasExpeditions(s.towns[t.id]!));
        expect(b.includes('stable')).toBe(stableTowns(map).includes(t.id));
        expect(b.includes('cartShop')).toBe(city || s.towns[t.id]!.nodes.some((n) => n.kind === 'forest'));
        for (const id of ['workshop', 'bank', 'guildHall'] as const) expect(b.includes(id)).toBe(city);
        // 화면 차례: 기획서 표 순서를 따른다
        expect(b).toEqual(BUILDINGS.map((x) => x.id).filter((id) => b.includes(id)));
      }
    }
  });

  it('수레방이 없는 마을에서는 수레를 바꿀 수 없다', () => {
    for (const seed of SEEDS) {
      const map = generateWorld(seed);
      const s = createEconomy(map, seed);
      const none = map.towns.find((t) => !townBuildings(s, map, t.id).includes('cartShop'));
      if (!none) continue;
      s.player.town = none.id;
      s.player.gold = 1000;
      expect(applyCommand(s, map, { type: 'buyCart', cart: 'handcart' })).toEqual({ ok: false, error: 'noCartShop' });
      expect(playerView(s, map).carts).toEqual([]);
      return;
    }
    throw new Error('수레방이 없는 마을이 있는 시드가 없다');
  });

  it('할 일이 있으면 도장(!): 원정 기회가 가득, 망가진 장비', () => {
    const map = generateWorld(SEEDS[0]!);
    const s = createEconomy(map, SEEDS[0]!);
    const town = map.towns.find((t) => hasExpeditions(s.towns[t.id]!))!.id;
    s.player.town = town;
    s.player.expeditionChances = ECONOMY.expedition.maxChances;
    s.player.gear.torch = 0;
    const a = buildingAlerts(s, map);
    expect(a.outside).toBeDefined();
    expect(a.store).toBeDefined();
    expect(playerView(s, map).buildings.find((b) => b.id === 'outside')?.alert).toBe(a.outside);
  });
});

describe('살 수 있는 것', () => {
  it('종류마다 있고, 파는 곳은 있는 건물이다', () => {
    const kinds = new Set(PURCHASES.map((p) => p.kind));
    for (const k of ['cart', 'horse', 'gear', 'porter', 'gatherer', 'warehouse', 'caravan', 'informant', 'workshop', 'loan']) expect(kinds).toContain(k);
    for (const p of PURCHASES) expect(BUILDINGS.map((b) => b.id)).toContain(p.building);
    expect(new Set(PURCHASES.map((p) => p.id)).size).toBe(PURCHASES.length);
  });

  it('작업장과 대출은 구조만 (0.0.5)', () => {
    expect(PURCHASES.filter((p) => !p.ready).map((p) => p.kind).sort()).toEqual(['loan', 'workshop']);
  });

  it('고용은 여관, 말은 마구간, 수레는 수레방, 장비는 잡화점', () => {
    expect(purchasesAt('inn').map((p) => p.kind).sort()).toEqual(['caravan', 'gatherer', 'informant', 'porter']);
    expect(purchasesAt('stable').every((p) => p.kind === 'horse')).toBe(true);
    expect(purchasesAt('cartShop').every((p) => p.kind === 'cart')).toBe(true);
    expect(purchasesAt('store').every((p) => p.kind === 'gear')).toBe(true);
  });
});
