import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, createCart, loadGoods } from '../cart';
import { ECONOMY } from '../constants';
import { applyCommand } from '../economy/commands';
import { createEconomy } from '../economy/create';
import { findNode } from '../economy/nodes';
import type { EconomyState } from '../economy/state';
import { generateWorld } from '../worldgen';
import { CARDS, cardById } from './cards';
import { buildDeck, tagsNearTown } from './deck';

const map = generateWorld(20261008);
const producers = map.towns.filter((t) => t.tier === 'town').map((t) => t.id);
const city = map.towns.find((t) => t.tier === 'city')!.id;
let s: EconomyState;

function setup(town: number): EconomyState {
  const st = createEconomy(map, 20261008);
  st.player.town = town;
  st.player.expeditionChances = 6;
  st.player.cart = createCart('wagon');
  return st;
}

/** 원정을 끝까지: 늘 고른 쪽(0 또는 1)만 고른다 */
function runExpedition(st: EconomyState, pick: (i: number) => number = () => 0): void {
  expect(applyCommand(st, map, { type: 'startExpedition' }).ok).toBe(true);
  for (let i = 0; st.player.expedition && i < 20; i++) {
    expect(applyCommand(st, map, { type: 'chooseExpeditionCard', choice: pick(i) }).ok).toBe(true);
  }
  expect(st.player.expedition).toBeNull();
}

beforeEach(() => {
  s = setup(producers[0]!);
});

describe('카드 데이터', () => {
  it('카드 id는 겹치지 않고, 연결·남기기 카드는 모두 있는 카드를 가리킨다', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) {
      for (const ch of c.choices) {
        for (const e of [...ch.success, ...(ch.failure ?? [])]) {
          if (e.kind === 'link' || e.kind === 'leave') expect(() => cardById(e.card)).not.toThrow();
        }
      }
    }
  });

  it('자원지 5종마다 지형 기본 카드가 있다', () => {
    for (const r of ['forest', 'ore', 'fish', 'field', 'salt'] as const) {
      expect(CARDS.some((c) => c.sources.some((x) => x.kind === 'terrain' && x.resource === r)), r).toBe(true);
    }
  });
});

describe('마을마다 다른 덱', () => {
  it('마을 자원지의 지형 카드만 들어간다', () => {
    for (const id of producers) {
      const st = setup(id);
      const kinds = new Set(st.towns[id]!.nodes.map((n) => n.kind));
      for (const cardId of buildDeck(st, map, id)) {
        const card = cardById(cardId);
        const terrain = card.sources.filter((x) => x.kind === 'terrain').map((x) => (x.kind === 'terrain' ? x.resource : null));
        if (terrain.length && card.sources.every((x) => x.kind === 'terrain')) {
          expect(terrain.some((r) => r && kinds.has(r)), `${map.towns[id]!.name} ${cardId}`).toBe(true);
        }
      }
    }
  });

  it('주변 지역 특색 태그 카드가 섞인다', () => {
    for (const id of producers) {
      const st = setup(id);
      const tags = new Set(tagsNearTown(map, id));
      const deck = buildDeck(st, map, id);
      for (const card of CARDS) {
        const byTag = card.sources.find((x) => x.kind === 'tag' && tags.has(x.tag));
        if (byTag) expect(deck, `${map.towns[id]!.name} ${card.id}`).toContain(card.id);
      }
    }
  });

  it('최근 사건 카드: 늑대가 나왔다는 신문이 있으면 늑대 카드가 섞인다', () => {
    const id = producers[0]!;
    s.towns[id]!.recentEvents = [{ kind: 'wolves', day: s.day }];
    expect(buildDeck(s, map, id)).toContain('wolfPack');
  });

  it('남겨 둔 카드는 다음 원정 덱에 한 번 들어간다', () => {
    const id = producers[0]!;
    s.player.marks = [{ town: id, card: 'checkTrap' }];
    expect(buildDeck(s, map, id)).toContain('checkTrap');
    expect(s.player.marks).toEqual([]);
  });

  it('연결 카드는 덱에 바로 들어가지 않는다', () => {
    for (const id of producers) expect(buildDeck(setup(id), map, id)).not.toContain('bear');
  });
});

describe('원정 진행', () => {
  it('기회 하나를 쓰고, 3~4장 고르면 끝나고, 얻은 것을 수레에 싣는다', () => {
    runExpedition(s);
    expect(s.player.expeditionChances).toBe(5);
    const r = s.player.lastExpedition!;
    expect(r.log.length).toBeGreaterThanOrEqual(1);
    expect(r.log.length).toBeLessThanOrEqual(6);
    for (const g of r.loaded) expect(cartCount(s.player.cart, g.good)).toBeGreaterThanOrEqual(g.qty);
    expect(s.player.ledger.at(-1)!.kind).toBe('expedition');
  });

  it('같은 세계에서 같은 선택을 하면 결과가 똑같다 (서버가 다시 계산할 수 있다)', () => {
    const a = setup(producers[1]!);
    const b = setup(producers[1]!);
    runExpedition(a, (i) => i % 2);
    runExpedition(b, (i) => i % 2);
    expect(b.player.lastExpedition).toEqual(a.player.lastExpedition);
    expect(b.player.fatigue).toBe(a.player.fatigue);
  });

  it('피로가 쌓이고, 다 차면 그 자리에서 돌아온다', () => {
    s.player.fatigue = ECONOMY.fatigue.max - 1;
    applyCommand(s, map, { type: 'startExpedition' });
    // 피로가 드는 선택을 찾아 고른다
    for (let i = 0; s.player.expedition && i < 10; i++) {
      const card = cardById(s.player.expedition.card);
      const tiring = card.choices.findIndex((c) => c.fatigue > 0);
      applyCommand(s, map, { type: 'chooseExpeditionCard', choice: tiring < 0 ? 0 : tiring });
    }
    expect(s.player.expedition).toBeNull();
    expect(s.player.fatigue).toBeLessThanOrEqual(ECONOMY.fatigue.max);
  });

  it('기회가 없거나, 너무 지쳤거나, 도시거나, 길 위면 나갈 수 없다', () => {
    s.player.expeditionChances = 0;
    expect(applyCommand(s, map, { type: 'startExpedition' })).toEqual({ ok: false, error: 'noChances' });
    s.player.expeditionChances = 1;
    s.player.fatigue = ECONOMY.fatigue.max;
    expect(applyCommand(s, map, { type: 'startExpedition' })).toEqual({ ok: false, error: 'tooTired' });
    const c = setup(city);
    expect(applyCommand(c, map, { type: 'startExpedition' })).toEqual({ ok: false, error: 'noExpedition' });
  });

  it('원정 중에는 다른 마을로 떠날 수 없고, 그만두면 모은 것을 싣고 돌아온다', () => {
    applyCommand(s, map, { type: 'startExpedition' });
    const to = map.towns.find((t) => t.id !== s.player.town)!.id;
    expect(applyCommand(s, map, { type: 'travel', to })).toEqual({ ok: false, error: 'inExpedition' });
    expect(applyCommand(s, map, { type: 'endExpedition' }).ok).toBe(true);
    expect(s.player.expedition).toBeNull();
    expect(applyCommand(s, map, { type: 'chooseExpeditionCard', choice: 0 })).toEqual({ ok: false, error: 'notInExpedition' });
  });

  it('잡은 만큼 숲(자원지)이 준다: 결과가 세계 상태를 따른다', () => {
    const forestTown = producers.find((id) => findNode(s.towns[id]!, 'forest'));
    if (forestTown === undefined) return;
    const st = setup(forestTown);
    const node = findNode(st.towns[forestTown]!, 'forest')!;
    const before = node.amount;
    for (let n = 0; n < 6 && st.player.expeditionChances > 0; n++) {
      st.player.fatigue = 0;
      runExpedition(st);
    }
    const gathered = st.player.ledger
      .filter((e) => e.kind === 'expedition')
      .flatMap((e) => (e.kind === 'expedition' ? e.goods : []))
      .filter((g) => g.good === 'meat' || g.good === 'wood')
      .reduce((a, g) => a + g.qty, 0);
    if (gathered > 0) expect(node.amount).toBeLessThan(before);
  });

  it('수레에 자리가 없으면 얻은 것을 두고 온다', () => {
    s.player.cart = createCart('pack');
    loadGoods(s.player.cart, 'salt', 27);
    for (let n = 0; n < 6 && s.player.expeditionChances > 0; n++) {
      s.player.fatigue = 0;
      runExpedition(s);
      const r = s.player.lastExpedition!;
      expect(r.loaded).toEqual([]);
    }
  });

  it('원정에서 본 것은 수첩에 "직접 봄"으로 날짜와 마을과 함께 적힌다', () => {
    for (let n = 0; n < 6 && s.player.expeditionChances > 0; n++) {
      s.player.fatigue = 0;
      // 말 걸기처럼 이야기를 듣는 선택을 고른다
      applyCommand(s, map, { type: 'startExpedition' });
      while (s.player.expedition) {
        const card = cardById(s.player.expedition.card);
        const talk = card.choices.findIndex((c) => c.success.some((e) => e.kind === 'rumor'));
        applyCommand(s, map, { type: 'chooseExpeditionCard', choice: talk < 0 ? 1 : talk });
      }
    }
    const seen = s.player.rumors.filter((r) => r.via === 'seen');
    expect(seen.length).toBeGreaterThan(0);
    for (const r of seen) {
      expect(r.town).toBe(s.player.town);
      expect(r.text.length).toBeGreaterThan(5);
      expect(r.from).toBe('원정에서 직접 봄');
    }
  });
});
