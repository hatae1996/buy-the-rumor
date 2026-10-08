// 원정 진행: 시작, 카드 고르기, 끝내기. 결과는 원정마다 따로 둔 시드 난수로 정해서
// 서버가 같은 선택을 받으면 같은 결과를 다시 낼 수 있다 (기획서 "채집: 원정 카드").
import { cartCount, loadGoods } from '../cart';
import { ECONOMY } from '../constants';
import type { GoodId } from '../economy/goods';
import { GOOD_NAME } from '../economy/goods';
import { depletes, findNode } from '../economy/nodes';
import { hasExpeditions } from '../economy/player';
import type { ActiveExpedition, EconomyState, ExpeditionLogLine } from '../economy/state';
import { createRng, mixSeed, shuffle, type Rng } from '../rng';
import type { WorldMap } from '../worldgen';
import { cardById } from './cards';
import { buildDeck } from './deck';
import { makeRumor } from './rumors';
import type { Chance, Choice, Effect } from './types';

/** 많이 지쳤을 때 성공 확률이 이만큼 줄고, 얻는 양이 하나 준다 */
export const TIRED_PENALTY = 0.15;

export type ExpeditionError = 'traveling' | 'noExpedition' | 'noChances' | 'tooTired' | 'inExpedition' | 'notInExpedition' | 'badChoice';

export function startExpedition(state: EconomyState, map: WorldMap): ExpeditionError | null {
  const p = state.player;
  if (p.expedition) return 'inExpedition';
  if (p.travel) return 'traveling';
  if (!hasExpeditions(state.towns[p.town]!)) return 'noExpedition';
  if (p.expeditionChances <= 0) return 'noChances';
  if (p.fatigue >= ECONOMY.fatigue.max) return 'tooTired';

  const rng = createRng(mixSeed(state.seed, state.day, state.nextId++));
  const deck = shuffle(buildDeck(state, map, p.town), rng);
  if (deck.length === 0) return 'noExpedition';
  p.expeditionChances -= 1;
  // 한 번의 원정은 카드 3~4장
  const total = rng.next() < 0.5 ? 3 : 4;
  const card = deck.shift()!;
  p.expedition = { town: p.town, rng: rng.state(), deck, card, left: total - 1, haul: [], rumors: [], log: [] };
  return null;
}

/** 성공 확률 (화면에 대략 보여 줄 때도 같은 식을 쓴다) */
export function chanceOf(chance: Chance, state: EconomyState, townId: number): number {
  let p = chance.base;
  if (chance.node) {
    const node = findNode(state.towns[townId]!, chance.node);
    const fullness = node ? node.amount / node.capacity : 0;
    p += (chance.nodeWeight ?? 0) * (fullness - 0.5);
  }
  if (state.player.fatigue >= ECONOMY.fatigue.tiredAt) p -= TIRED_PENALTY;
  return Math.min(0.95, Math.max(0.05, p));
}

export function chooseExpeditionCard(state: EconomyState, map: WorldMap, choiceIndex: number): ExpeditionError | null {
  const p = state.player;
  const ex = p.expedition;
  if (!ex) return 'notInExpedition';
  if (choiceIndex !== 0 && choiceIndex !== 1) return 'badChoice';
  const card = cardById(ex.card);
  const choice = card.choices[choiceIndex]!;
  const rng = createRng(ex.rng);

  // 결과는 이 선택을 하기 전 몸 상태로 판단하고, 피로는 그다음에 쌓인다
  const chance = choice.chance ? chanceOf(choice.chance, state, ex.town) : null;
  const success = chance === null || rng.next() < chance;
  const effects = success ? choice.success : (choice.failure ?? []);
  let ended = false;
  const parts: string[] = [];
  for (const e of effects) {
    const r = applyEffect(e, state, map, ex, rng);
    if (r.text) parts.push(r.text);
    if (r.end) ended = true;
  }
  p.fatigue = Math.min(ECONOMY.fatigue.max, Math.max(0, p.fatigue + choice.fatigue));
  ex.log.push(logLine(card.title, choice, chance === null ? null : success ? 'success' : 'failure', parts));

  ex.rng = rng.state();
  ex.left -= 1;
  if (ended || ex.left < 0 || p.fatigue >= ECONOMY.fatigue.max || ex.deck.length === 0) {
    finishExpedition(state);
  } else {
    ex.card = ex.deck.shift()!;
  }
  return null;
}

function logLine(title: string, choice: Choice, outcome: ExpeditionLogLine['outcome'], parts: string[]): ExpeditionLogLine {
  const text = parts.length ? parts.join(' ') : outcome === 'failure' ? '허탕을 쳤어요.' : '';
  return { title, choice: choice.label, outcome, text };
}

function applyEffect(
  e: Effect,
  state: EconomyState,
  map: WorldMap,
  ex: ActiveExpedition,
  rng: Rng,
): { text?: string; end?: boolean } {
  const p = state.player;
  const town = state.towns[ex.town]!;
  switch (e.kind) {
    case 'goods': {
      let qty = rng.int(e.min, e.max);
      // 결과는 세계 상태를 따른다: 줄어드는 자원지는 남은 양만큼, 얻은 만큼 줄어든다
      const node = e.from ? findNode(town, e.from) : undefined;
      if (node && depletes(node.kind)) {
        qty = Math.min(Math.floor(node.amount), Math.round(qty * (0.4 + 0.6 * (node.amount / node.capacity))));
        node.amount -= qty;
      }
      if (p.fatigue >= ECONOMY.fatigue.tiredAt) qty = Math.max(0, qty - 1);
      if (qty <= 0) return { text: '건진 게 없어요.' };
      addHaul(ex, e.good, qty);
      return { text: `${GOOD_NAME[e.good]} ${qty}개를 얻었어요.` };
    }
    case 'loseHaul': {
      let lost = 0;
      for (const h of ex.haul) {
        if (e.good && h.good !== e.good) continue;
        const n = Math.ceil(h.qty * e.fraction);
        h.qty -= n;
        lost += n;
      }
      ex.haul = ex.haul.filter((h) => h.qty > 0);
      return { text: lost ? `짐 ${lost}개를 잃었어요.` : '다행히 잃을 게 없었어요.' };
    }
    case 'rumor': {
      const text = makeRumor(e.topic, state, map, ex.town, rng);
      ex.rumors.push(text);
      return { text: `이야기를 들었어요: ${text}` };
    }
    case 'link':
      ex.deck.unshift(e.card);
      // 연결 카드는 남은 장 수와 상관없이 이어서 나온다
      if (ex.left <= 0) ex.left = 1;
      return {};
    case 'leave':
      p.marks.push({ town: ex.town, card: e.card });
      return { text: '다음에 다시 와 볼 자리를 남겼어요.' };
    case 'end':
      return { end: true };
    case 'skip':
      ex.left -= e.cards;
      return {};
    case 'pay': {
      const paid = Math.min(p.gold, e.gold);
      p.gold -= paid;
      p.ledger.push({ day: state.day, kind: 'toll', town: ex.town, gold: paid });
      return { text: `통행세를 냈어요 (−${paid}).` };
    }
  }
}

function addHaul(ex: ActiveExpedition, good: GoodId, qty: number): void {
  const same = ex.haul.find((h) => h.good === good);
  if (same) same.qty += qty;
  else ex.haul.push({ good, qty });
}

/** 원정을 마치고 돌아온다: 얻은 것을 수레에 싣고(자리가 없으면 두고 온다), 들은 이야기를 수첩에 적는다 */
export function finishExpedition(state: EconomyState): ExpeditionError | null {
  const p = state.player;
  const ex = p.expedition;
  if (!ex) return 'notInExpedition';
  const loaded: { good: GoodId; qty: number }[] = [];
  const leftBehind: { good: GoodId; qty: number }[] = [];
  for (const h of ex.haul) {
    const before = cartCount(p.cart, h.good);
    loadGoods(p.cart, h.good, h.qty, 0);
    const n = cartCount(p.cart, h.good) - before;
    if (n > 0) loaded.push({ good: h.good, qty: n });
    if (h.qty - n > 0) leftBehind.push({ good: h.good, qty: h.qty - n });
  }
  for (const text of ex.rumors) p.rumors.push({ day: state.day, town: ex.town, text });
  p.ledger.push({
    day: state.day,
    kind: 'expedition',
    town: ex.town,
    goods: loaded,
    leftBehind: leftBehind.reduce((s, h) => s + h.qty, 0),
  });
  p.lastExpedition = { day: state.day, town: ex.town, loaded, leftBehind, rumors: ex.rumors, log: ex.log };
  p.expedition = null;
  return null;
}
