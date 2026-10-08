// 봇의 살 것 고르기 (0.0.5 작업 9): 셈이 맞을 때만 사고, 써 보니 손해면 줄이고, 잘하는 봇은 두 번째 행렬까지 꾸린다.
import { beforeEach, describe, expect, it } from 'vitest';
import { createCart } from '../cart';
import { applyCommand, createEconomy, playerView, type Command, type EconomyState } from '../economy';
import { hasBuilding } from '../growth/buildings';
import { stableTowns, type Horse } from '../horses';
import { generateWorld } from '../worldgen';
import { caravanPlanStep, createGrowthMind, growthStep, type GrowthMind } from './growth';
import { botProfile } from './profiles';
import { runBotOn } from './run';

const SEED = 20261008;
const map = generateWorld(SEED);
const casual = botProfile('casual').growth!;
const trader = botProfile('trader').growth!;
let s: EconomyState;
let g: GrowthMind;

const horse = (id: number, kind: Horse['kind'] = 'draft'): Horse => ({ id, kind, fatigue: 0, hungry: 0, price: 220, home: 0 });
/** 봇이 고른 명령 하나를 보내고 돌려준다 */
const step = (growth = casual): Command | null => {
  const c = growthStep(playerView(s, map), growth, g, (x) => x);
  if (c) expect(applyCommand(s, map, c)).toEqual(expect.objectContaining({ ok: true }));
  return c;
};

/** 수레방과 여관이 있고 일꾼이 넉넉한 원정 마을 */
function shopTown(st: EconomyState): number {
  return map.towns
    .filter((t) => hasBuilding(st, map, t.id, 'cartShop') && hasBuilding(st, map, t.id, 'inn'))
    .map((t) => ({ id: t.id, n: st.workers.filter((w) => w.town === t.id).length }))
    .sort((a, b) => b.n - a.n)[0]!.id;
}

beforeEach(() => {
  s = createEconomy(map, SEED, { warmupDays: 20 });
  s.player.town = shopTown(s);
  s.player.gold = 3000;
  s.player.cart = createCart('handcart');
  s.horses.stables.forEach((st) => (st.stock = { pony: 0, draft: 0, swift: 0 }));
  g = createGrowthMind();
});

describe('셈이 맞을 때만 산다', () => {
  it('돈이 많아도 살 이유(두고 온 짐, 원정 값)가 없으면 아무것도 사지 않는다. 살 수 있게 된 날은 적는다', () => {
    expect(step()).toBeNull();
    expect(g.firsts).toEqual({});
    expect(g.couldAfford.porter).toBe(s.day);
  });

  it('원정에서 두고 온 짐 값이 일당보다 크면 짐꾼을 데려온다', () => {
    g.lost = [{ day: s.day - 1, value: 200 }];
    expect(step()).toEqual({ type: 'hire', role: 'porter' });
    expect(g.firsts.porter).toBe(s.day);
  });

  it('마구간에 손수레보다 많이 끄는 말이 있으면 말이 먼저다 (먹이 값보다 두고 온 짐이 클 때)', () => {
    // 시즌이 없는 테스트 세계라 마구간을 직접 연다
    const town = stableTowns(map)[0]!;
    s.horses.stables.push({ town, stock: { pony: 2, draft: 1, swift: 0 } });
    s.player.town = town;
    g.lost = [{ day: s.day - 1, value: 400 }];
    // 조랑말(60)은 손수레(70)보다 못 끈다
    expect(step()).toEqual({ type: 'buyHorse', kind: 'draft' });
  });

  it('원정 값의 채집꾼 몫이 일당 + 보관료보다 크면 창고를 빌리고 채집꾼을 데려온다', () => {
    g.hauls = [80, 80, 80];
    expect(step()).toEqual({ type: 'rentWarehouse' });
    expect(step()).toEqual({ type: 'hire', role: 'gatherer' });
    expect(g.firsts).toMatchObject({ warehouse: s.day, gatherer: s.day });
  });
});

describe('줄이기', () => {
  it('써 보니 채집꾼 몫이 일당 + 보관료보다 적으면 열흘 뒤 내보낸다', () => {
    g.hauls = [80, 80, 80];
    step();
    step();
    const id = s.player.hires.find((h) => h.role === 'gatherer')!.id;
    g.hiredOn[id] = s.day - 11;
    g.gathered = [{ day: s.day - 1, value: 5 }];
    g.hauls = [];
    expect(step()).toEqual({ type: 'dismissHire', hireId: id });
  });

  it('돈이 비상금 절반 아래로 떨어지면 일꾼부터 내보낸다', () => {
    g.lost = [{ day: s.day - 1, value: 200 }];
    step();
    s.player.gold = 10;
    const id = s.player.hires[0]!.id;
    expect(step()).toEqual({ type: 'dismissHire', hireId: id });
  });
});

describe('두 번째 행렬 (잘하는 봇만)', () => {
  it('돈이 모이면 마부를 데려오고, 남는 말로 행렬을 꾸려, 기억하는 비싼 마을로 지시서를 보낸다', () => {
    s.player.horses = [horse(901), horse(902)];
    const here = s.player.town;
    const to = map.towns.find((t) => t.id !== here)!.id;
    const price = playerView(s, map).market!.price;
    s.player.memory[to] = { day: s.day, prices: Object.fromEntries(Object.entries(price).map(([k, v]) => [k, v * 3])) as typeof price, previous: null };
    expect(step(trader)).toEqual({ type: 'hire', role: 'carter' });
    expect(step(trader)).toEqual(expect.objectContaining({ type: 'formCaravan', cart: 'handcart' }));
    expect(g.firsts.caravan).toBe(s.day);
    const plan = caravanPlanStep(playerView(s, map));
    expect(plan).toEqual(expect.objectContaining({ type: 'setCaravanPlan' }));
    expect(applyCommand(s, map, plan!)).toEqual({ ok: true });
    const stops = s.player.caravan!.plan!.stops;
    expect(stops.map((x) => x.town)).toEqual([here, to]);
    expect(stops[0]!.buys).toHaveLength(1);
    expect(stops[1]!.sells[0]!.good).toBe(stops[0]!.buys[0]!.good);
  });

  it('보통 사람은 두 번째 행렬을 꾸리지 않는다', () => {
    s.player.horses = [horse(901), horse(902)];
    expect(step()).toBeNull();
    expect(s.player.hires).toEqual([]);
  });
});

describe('시즌을 돌려도', () => {
  it('장사꾼은 짐꾼을 들이고, 그 때문에 크게 잃지 않는다', () => {
    const seed = SEED;
    const run = (withGrowth: boolean) => {
      const st = createEconomy(map, seed, { warmupDays: 20 });
      st.player.cart = createCart('handcart');
      const p = botProfile('trader');
      return runBotOn(st, map, withGrowth ? p : { ...p, growth: null }, { days: 144 });
    };
    const on = run(true);
    const off = run(false);
    expect(on.firsts.porter).toBeDefined();
    expect(on.worth.at(-1)!).toBeGreaterThan(off.worth.at(-1)! * 0.8);
  }, 60000);
});
