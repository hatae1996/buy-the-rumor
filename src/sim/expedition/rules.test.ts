// 원정 0.0.4 규칙: 카드 60장 데이터, 도구 소모, 장비, 위험, 안내인, 놓아 둔 덫, 이번 원정 상태, 말 카드.
import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { ECONOMY } from '../constants';
import { applyCommand } from '../economy/commands';
import { createEconomy } from '../economy/create';
import type { ActiveExpedition, EconomyState } from '../economy/state';
import { playerView } from '../economy/view';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { CARDS, cardById } from './cards';
import { chooseExpeditionCard } from './expedition';
import type { Effect } from './types';

const X = ECONOMY.expedition;
const map = generateWorld(20261008);
const town = map.towns.find((t) => t.tier === 'town')!.id;
let s: EconomyState;

/** 원정 하나를 손으로 짠다: 지금 카드와 뒤에 올 덱 */
function onCard(card: string, deck: string[] = ['log', 'log', 'log'], extra: Partial<ActiveExpedition> = {}): ActiveExpedition {
  const ex: ActiveExpedition = {
    town,
    rng: 7,
    deck: [...deck],
    card,
    left: 2,
    haul: [],
    rumors: [],
    log: [],
    flags: [],
    guide: false,
    markDays: {},
    ...extra,
  };
  s.player.expedition = ex;
  return ex;
}

const choose = (i: number) => applyCommand(s, map, { type: 'chooseExpeditionCard', choice: i });

beforeEach(() => {
  s = createEconomy(map, 20261008);
  s.player.town = town;
  s.player.cart = createCart('wagon');
  s.player.gold = 500;
});

describe('카드 데이터 (기획서 약 60장 + 지금 카드)', () => {
  it('60장 넘게 있고, id가 겹치지 않는다', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('연결·남기기·덱 바꾸기는 모두 있는 카드를 가리킨다', () => {
    const effects = (es: readonly Effect[]): Effect[] =>
      es.flatMap((e) => (e.kind === 'maybe' ? effects(e.effects) : e.kind === 'oneOf' ? e.options.flatMap(effects) : [e]));
    for (const c of CARDS) {
      for (const ch of c.choices) {
        for (const e of effects([...ch.success, ...(ch.failure ?? [])])) {
          if (e.kind === 'link' || e.kind === 'leave') expect(() => cardById(e.card), `${c.id} → ${e.card}`).not.toThrow();
        }
      }
      for (const id of [...Object.keys(c.deckChange?.add ?? {}), ...Object.keys(c.deckChange?.remove ?? {})]) {
        expect(() => cardById(id), `${c.id} → ${id}`).not.toThrow();
      }
    }
  });

  it('덧붙은 선택지(셋째부터)는 장비나 말이 여는 것이다', () => {
    for (const c of CARDS) for (const ch of c.choices.slice(2)) expect(ch.needs?.gear ?? ch.needs?.horse, c.id).toBeDefined();
  });

  it('카드마다 고를 수 있는 선택지가 늘 하나는 있다 (도구·장비·말 없이)', () => {
    for (const c of CARDS) expect(c.choices.slice(0, 2).some((ch) => !ch.needs), c.id).toBe(true);
  });

  it('나무 베기와 광석 캐기는 도구를 쓴다 (기획서 "도구는 소모품")', () => {
    for (const id of ['oak', 'vein', 'markedTree', 'markedVein', 'oldGrowth']) {
      expect(cardById(id).choices[0]!.needs?.tool, id).toBe(1);
    }
  });
});

describe('도구', () => {
  it('도구가 없으면 고를 수 없고, 있으면 하나를 쓴다', () => {
    onCard('oak');
    expect(choose(0)).toEqual({ ok: false, error: 'needTool' });
    expect(playerView(s, map).expedition!.card.choices[0]!.disabled).not.toBeNull();
    loadGoods(s.player.cart, 'tools', 2);
    expect(choose(0).ok).toBe(true);
    expect(cartCount(s.player.cart, 'tools')).toBe(2 - 1 / X.usesPerTool);
    expect(s.player.expedition!.haul.find((h) => h.good === 'wood')?.qty).toBeGreaterThan(0);
  });
});

describe('장비', () => {
  it('잡화점에서 사고, 그 장비가 여는 선택지가 보이고, 쓰면 닳는다', () => {
    onCard('wolfPack');
    expect(playerView(s, map).expedition!.card.choices.map((c) => c.label)).not.toContain('횃불로 쫓는다');
    s.player.expedition = null;
    expect(applyCommand(s, map, { type: 'buyGear', gear: 'torch' }).ok).toBe(true);
    expect(s.player.gold).toBe(500 - X.gear.torch.price);
    expect(applyCommand(s, map, { type: 'buyGear', gear: 'torch' })).toEqual({ ok: false, error: 'haveGear' });
    onCard('wolfPack');
    const torch = playerView(s, map).expedition!.card.choices.find((c) => c.label === '횃불로 쫓는다')!;
    expect(torch.extra).toBe(true);
    expect(choose(torch.index).ok).toBe(true);
    expect(s.player.gear.torch).toBe(X.gear.torch.durability - 1);
  });

  it('그물이 있으면 물고기 카드의 생선이 1 더, 망가지면 도구로 고친다', () => {
    const fishTown = s.towns.findIndex((t) => t.nodes.some((n) => n.kind === 'fish'));
    if (fishTown < 0) return;
    s.player.town = fishTown;
    const run = (withNet: boolean) => {
      s.player.gear = withNet ? { net: X.gear.net.durability } : {};
      s.player.cart = createCart('wagon');
      s.towns[fishTown]!.nodes.find((n) => n.kind === 'fish')!.amount = 1e6;
      const ex = onCard('school');
      ex.town = fishTown;
      choose(0);
      return ex.haul.find((h) => h.good === 'fish')?.qty ?? 0;
    };
    expect(run(true)).toBe(run(false) + 1);
    s.player.expedition = null;
    s.player.gear.net = 0;
    expect(applyCommand(s, map, { type: 'repairGear', gear: 'net' })).toEqual({ ok: false, error: 'needTool' });
    loadGoods(s.player.cart, 'tools', 1);
    expect(applyCommand(s, map, { type: 'repairGear', gear: 'net' }).ok).toBe(true);
    expect(s.player.gear.net).toBe(X.gear.net.durability);
    expect(cartCount(s.player.cart, 'tools')).toBe(0);
  });

  it('덫이 있어야 덫을 놓고, 놓은 지 오래되면 다른 짐승이 먹어 버린다', () => {
    onCard('foxDen');
    expect(playerView(s, map).expedition!.card.choices[0]!.disabled).toBe('덫이 없어요');
    expect(choose(0)).toEqual({ ok: false, error: 'needGear' });
    s.player.gear.trap = X.gear.trap.durability;
    expect(playerView(s, map).expedition!.card.choices[0]!.disabled).toBeNull();
    expect(choose(0).ok).toBe(true);
    expect(s.player.marks).toEqual([{ town, card: 'checkTrap', day: s.day }]);

    onCard('checkTrap', ['log', 'log'], { markDays: { checkTrap: s.day - X.trapGoneDays - 1 } });
    choose(0);
    expect(s.player.lastExpedition?.log[0]?.text ?? s.player.expedition?.log[0]?.text).toContain('먹어 치웠어요');
  });
});

describe('위험', () => {
  it('다치면 피로가 크게 오른다', () => {
    const ex = onCard('collapsed');
    ex.rng = 0;
    // 다칠 때까지 같은 카드를 여러 번 (20% 확률)
    let hurt = false;
    for (let seed = 1; seed < 200 && !hurt; seed++) {
      s.player.fatigue = 0;
      onCard('collapsed', ['log'], { rng: seed });
      choose(0);
      hurt = s.player.fatigue >= cardById('collapsed').choices[0]!.fatigue + X.hurtFatigue;
    }
    expect(hurt).toBe(true);
  });
});

describe('안내인', () => {
  it('여관에서 고용하면 다음 원정에서 위험한 카드 한 장을 건너뛴다', () => {
    expect(applyCommand(s, map, { type: 'hireGuide' }).ok).toBe(true);
    expect(applyCommand(s, map, { type: 'hireGuide' })).toEqual({ ok: false, error: 'alreadyGuide' });
    onCard('log', ['rockfall', 'gleaning', 'log'], { guide: true });
    choose(1);
    expect(s.player.expedition!.card).toBe('gleaning');
    expect(s.player.expedition!.guide).toBe(false);
  });
});

describe('이번 원정 상태', () => {
  it('눈 덮인 길이면 카드마다 피로 +1', () => {
    onCard('log', ['log', 'log'], { flags: ['snow'] });
    s.player.fatigue = 0;
    choose(0);
    expect(s.player.fatigue).toBe(cardById('log').choices[0]!.fatigue + 1);
  });

  it('무더위에 잡은 생선과 고기는 묵은 채로 싣는다', () => {
    const ex = onCard('log', [], { flags: ['heat'], left: 0 });
    ex.haul = [{ good: 'meat', qty: 2 }];
    applyCommand(s, map, { type: 'endExpedition' });
    const meat = s.player.cart.pieces.filter((p) => p.good === 'meat').flatMap((p) => p.lots);
    expect(meat.every((l) => l.age === X.heatAge)).toBe(true);
  });
});

describe('말 카드', () => {
  it('말이 있으면 곰 앞에서 말을 타고 빠져나오는 선택지가 열린다', () => {
    onCard('bear');
    expect(playerView(s, map).expedition!.card.choices.some((c) => c.label.includes('말을 타고'))).toBe(false);
    s.player.horses = [{ id: 1, kind: 'pony', fatigue: 0, hungry: 0, price: 90, home: town }];
    const horse = playerView(s, map).expedition!.card.choices.find((c) => c.label.includes('말을 타고'))!;
    expect(choose(horse.index).ok).toBe(true);
    expect(s.player.expedition).toBeNull();
  });

  it('말과 함께 가면 위험한 일 뒤에 말이 놀랄 수 있다', () => {
    s.player.horses = [{ id: 1, kind: 'pony', fatigue: 0, hungry: 0, price: 90, home: town }];
    let spooked = false;
    for (let seed = 1; seed < 300 && !spooked; seed++) {
      onCard('wolfPack', ['log', 'log'], { rng: seed, haul: [{ good: 'meat', qty: 4 }] });
      chooseExpeditionCard(s, map, 1);
      spooked = s.player.expedition?.card === 'horseSpooked';
    }
    expect(spooked).toBe(true);
  });

  it('말 카드는 말이 있을 때만 덱에 들어온다', () => {
    expect(cardById('packHorse').needsHorse).toBe(true);
    expect(createRng(1).next()).toBeLessThan(1);
  });
});

describe('목장 일손', () => {
  it('일하면 그 마을 금고에서 품삯을 받는다', () => {
    onCard('ranchHand');
    const treasury = s.towns[town]!.treasury;
    choose(0);
    expect(s.player.gold).toBe(508);
    expect(s.towns[town]!.treasury).toBe(treasury - 8);
  });
});
