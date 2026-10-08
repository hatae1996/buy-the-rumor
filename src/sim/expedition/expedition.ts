// 원정 진행: 시작, 카드 고르기, 끝내기. 결과는 원정마다 따로 둔 시드 난수로 정해서
// 서버가 같은 선택을 받으면 같은 결과를 다시 낼 수 있다 (기획서 "채집: 원정 카드").
// 결과는 피로, 얻는 물품, 위험(다침, 짐 일부 잃음, 장비 망가짐) 세 가지뿐이다.
import { cartCount, loadGoods } from '../cart';
import { ECONOMY } from '../constants';
import type { GoodId } from '../economy/goods';
import { GOOD_NAME } from '../economy/goods';
import { depletes, findNode } from '../economy/nodes';
import { hasExpeditions } from '../economy/player';
import type { ActiveExpedition, EconomyState, ExpeditionLogLine } from '../economy/state';
import { createRng, mixSeed, type Rng } from '../rng';
import type { WorldMap } from '../worldgen';
import { APPRENTICE_DECK, cardById } from './cards';
import { buildDeck, EVENT_MEMORY_DAYS } from './deck';
import { hasGear, needsMet, useGear, useTool, type GearError } from './gear';
import { makeRumor } from './rumors';
import { noteSeen, verifyByExpedition } from '../rumors';
import { noteExpeditionMoments } from '../ranking/moments';
import { loadOverflow } from '../hire/boards';
import type { Chance, Choice, Effect } from './types';

const X = ECONOMY.expedition;

/** 많이 지쳤을 때 성공 확률이 이만큼 줄고, 얻는 양이 하나 준다 */
export const TIRED_PENALTY = 0.15;

export type ExpeditionError =
  | 'traveling'
  | 'noExpedition'
  | 'noChances'
  | 'tooTired'
  | 'inExpedition'
  | 'notInExpedition'
  | 'badChoice'
  | 'noHorse'
  | GearError;

export function startExpedition(state: EconomyState, map: WorldMap): ExpeditionError | null {
  const p = state.player;
  if (p.expedition) return 'inExpedition';
  if (p.travel) return 'traveling';
  if (!hasExpeditions(state.towns[p.town]!)) return 'noExpedition';
  if (p.expeditionChances <= 0) return 'noChances';
  if (p.fatigue >= ECONOMY.fatigue.max) return 'tooTired';

  const rng = createRng(mixSeed(state.seed, state.day, state.nextId++));
  // 견습 첫 원정은 스크립트로 정한 쉬운 카드 3장 (반드시 성공)
  const scripted = p.apprentice?.scene === 'start';
  const { deck, markDays } = scripted ? { deck: [...APPRENTICE_DECK], markDays: {} } : buildDeck(state, map, p.town, rng);
  if (deck.length === 0) return 'noExpedition';
  p.expeditionChances -= 1;
  // 자원지를 직접 보니 그 마을 자원지 소문에 도장을 찍는다
  verifyByExpedition(state, p.town);
  // 한 번의 원정은 카드 3~4장. 안내인은 이번 원정 한 번만 따라간다
  const total = scripted ? deck.length : rng.next() < 0.5 ? 3 : 4;
  const ex: ActiveExpedition = {
    town: p.town,
    rng: 0,
    deck,
    card: '',
    left: total,
    haul: [],
    rumors: [],
    log: [],
    flags: [],
    guide: p.guide,
    markDays,
  };
  p.guide = false;
  p.expedition = ex;
  drawNext(ex);
  ex.rng = rng.state();
  return null;
}

/** 다음 카드를 편다. 안내인이 있으면 위험한 카드 한 장을 건너뛴다 */
function drawNext(ex: ActiveExpedition): void {
  let next = ex.deck.shift()!;
  if (ex.guide && cardById(next).danger && ex.deck.length > 0) {
    ex.guide = false;
    ex.log.push({ title: cardById(next).title, choice: '안내인이 다른 길로 이끌었다', outcome: null, text: '위험한 곳을 피해 갔어요.' });
    next = ex.deck.shift()!;
  }
  ex.card = next;
  ex.left -= 1;
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

/** 선택지에 쌓이는 피로 (눈 덮인 길이면 모든 카드에 +1) */
export function choiceFatigue(choice: Choice, ex: ActiveExpedition): number {
  return choice.fatigue + (ex.flags.includes('snow') && choice.fatigue >= 0 ? 1 : 0);
}

export function chooseExpeditionCard(state: EconomyState, map: WorldMap, choiceIndex: number): ExpeditionError | null {
  const p = state.player;
  const ex = p.expedition;
  if (!ex) return 'notInExpedition';
  const card = cardById(ex.card);
  const choice = card.choices[choiceIndex];
  if (!Number.isInteger(choiceIndex) || !choice) return 'badChoice';
  const unmet = needsMet(state, choice.needs);
  if (unmet) return unmet;
  const rng = createRng(ex.rng);

  // 도구와 장비를 쓴다
  if (choice.needs?.tool) useTool(p, choice.needs.tool);
  if (choice.needs?.gear) useGear(p, choice.needs.gear);

  // 결과는 이 선택을 하기 전 몸 상태로 판단하고, 피로는 그다음에 쌓인다
  const chance = choice.chance ? chanceOf(choice.chance, state, ex.town) : null;
  const success = chance === null || rng.next() < chance;
  const effects = success ? choice.success : (choice.failure ?? []);
  const result = { ended: false, risk: !success && chance !== null, parts: [] as string[] };
  const before = new Map(ex.haul.map((h) => [h.good, h.qty]));
  for (const e of effects) applyEffect(e, state, map, ex, rng, result);
  // 랭킹: 이야기가 되는 순간 (곰을 횃불로 쫓음, 늑대를 무사히 지남 등)
  const gained: Partial<Record<string, number>> = {};
  let lost = 0;
  for (const g of new Set([...before.keys(), ...ex.haul.map((h) => h.good)])) {
    const d = (ex.haul.find((h) => h.good === g)?.qty ?? 0) - (before.get(g) ?? 0);
    if (d > 0) gained[g] = d;
    else lost -= d;
  }
  noteExpeditionMoments(state, { card: card.id, choice, success, gained, lost });
  p.fatigue = Math.min(ECONOMY.fatigue.max, Math.max(0, p.fatigue + choiceFatigue(choice, ex)));
  ex.log.push(logLine(card.title, choice, chance === null ? null : success ? 'success' : 'failure', result.parts));

  // 말과 함께 갔으면 위험한 일 뒤에 말이 놀랄 수 있다 (목장 화재가 있었던 마을은 더)
  if (result.risk && !result.ended && p.horses.length && card.id !== 'horseSpooked') {
    const fire = state.towns[ex.town]!.recentEvents.some((e) => e.kind === 'ranchFire' && state.day - e.day <= EVENT_MEMORY_DAYS);
    if (rng.next() < (fire ? X.spookChanceAfterFire : X.spookChance)) {
      ex.deck.unshift('horseSpooked');
      if (ex.left <= 0) ex.left = 1;
    }
  }

  ex.rng = rng.state();
  if (result.ended || ex.left <= 0 || p.fatigue >= ECONOMY.fatigue.max || ex.deck.length === 0) {
    finishExpedition(state);
  } else {
    drawNext(ex);
  }
  return null;
}

function logLine(title: string, choice: Choice, outcome: ExpeditionLogLine['outcome'], parts: string[]): ExpeditionLogLine {
  const text = parts.length ? parts.join(' ') : outcome === 'failure' ? '허탕을 쳤어요.' : '';
  return { title, choice: choice.label, outcome, text };
}

interface EffectResult {
  ended: boolean;
  /** 다치거나 짐을 잃는 등 위험한 일이 있었나 (말이 놀란다) */
  risk: boolean;
  parts: string[];
}

function applyEffect(e: Effect, state: EconomyState, map: WorldMap, ex: ActiveExpedition, rng: Rng, out: EffectResult): void {
  const p = state.player;
  const town = state.towns[ex.town]!;
  const say = (text: string): void => {
    out.parts.push(text);
  };
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
      if (qty <= 0) return say('건진 게 없어요.');
      // 그물, 살찐 사슴, 수확철, 말에 실은 바구니
      if (e.boost === 'net' && hasGear(p, 'net')) {
        useGear(p, 'net');
        qty++;
      }
      if (e.boost === 'deer' && ex.flags.includes('fatDeer')) qty++;
      if (e.boost === 'farm' && ex.flags.includes('harvest')) qty++;
      if (ex.flags.includes('packHorse')) qty++;
      addHaul(ex, e.good, qty);
      return say(`${GOOD_NAME[e.good]} ${qty}개를 얻었어요.`);
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
      if (lost) out.risk = true;
      return say(lost ? `짐 ${lost}개를 잃었어요.` : '다행히 잃을 게 없었어요.');
    }
    case 'hurt':
      p.fatigue = Math.min(ECONOMY.fatigue.max, p.fatigue + X.hurtFatigue);
      out.risk = true;
      return say(`다쳤어요 (피로 +${X.hurtFatigue}).`);
    case 'breakGear':
      if (!hasGear(p, e.gear)) return;
      useGear(p, e.gear, e.uses);
      out.risk = true;
      return say(`${X.gear[e.gear].name}${p.gear[e.gear] === 0 ? '이 망가졌어요' : '이 상했어요'}.`);
    case 'maybe':
      if (rng.next() < e.chance) for (const inner of e.effects) applyEffect(inner, state, map, ex, rng, out);
      return;
    case 'oneOf': {
      const pick = e.options[rng.int(0, e.options.length - 1)]!;
      if (!pick.length) say('쓸 만한 건 없었어요.');
      for (const inner of pick) applyEffect(inner, state, map, ex, rng, out);
      return;
    }
    case 'rumor': {
      const text = makeRumor(e.topic, state, map, ex.town, rng);
      ex.rumors.push(text);
      return say(`이야기를 들었어요: ${text}`);
    }
    case 'link':
      ex.deck.unshift(e.card);
      // 연결 카드는 남은 장 수와 상관없이 이어서 나온다
      if (ex.left <= 0) ex.left = 1;
      return;
    case 'leave':
      // 다시 남겨 둔 덫은 처음 놓은 날을 그대로 센다
      p.marks.push({ town: ex.town, card: e.card, day: ex.markDays[e.card] ?? state.day });
      return say('다음에 다시 와 볼 자리를 남겼어요.');
    case 'end':
      out.ended = true;
      return;
    case 'skip':
      ex.left -= e.cards;
      return;
    case 'more':
      ex.left += e.cards;
      return say(`카드를 ${e.cards}장 더 봐요.`);
    case 'flag':
      if (!ex.flags.includes(e.flag)) ex.flags.push(e.flag);
      return;
    case 'pay': {
      const paid = Math.min(p.gold, e.gold);
      p.gold -= paid;
      p.ledger.push({ day: state.day, kind: 'toll', town: ex.town, gold: paid });
      return say(`통행세를 냈어요 (−${paid}).`);
    }
    case 'earn': {
      const gold = Math.min(town.treasury, e.gold);
      town.treasury -= gold;
      p.gold += gold;
      p.ledger.push({ day: state.day, kind: 'earn', town: ex.town, gold });
      return say(gold ? `품삯 ${gold}을 받았어요.` : '목장 주인이 오늘은 줄 돈이 없대요.');
    }
    case 'trapCatch': {
      const age = state.day - (ex.markDays.checkTrap ?? state.day);
      const caught = age <= X.trapFreshDays || (age <= X.trapGoneDays && rng.next() < 0.5);
      if (!caught) return say('다른 짐승이 먼저 먹어 치웠어요.');
      applyEffect({ kind: 'goods', good: 'meat', min: 1, max: 2, from: 'forest' }, state, map, ex, rng, out);
      applyEffect({ kind: 'goods', good: 'leather', min: 1, max: 1, from: 'forest' }, state, map, ex, rng, out);
      return;
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
    // 무더위에 잡은 생선과 고기는 묵은 채로 싣는다
    const age = ex.flags.includes('heat') && (h.good === 'fish' || h.good === 'meat') ? X.heatAge : 0;
    const before = cartCount(p.cart, h.good);
    loadGoods(p.cart, h.good, h.qty, age);
    let n = cartCount(p.cart, h.good) - before;
    // 내 수레에 다 못 실으면 짐꾼 수레에
    if (n < h.qty) n += loadOverflow(p, h.good, h.qty - n, age);
    if (n > 0) loaded.push({ good: h.good, qty: n });
    if (h.qty - n > 0) leftBehind.push({ good: h.good, qty: h.qty - n });
  }
  for (const text of ex.rumors) noteSeen(state, ex.town, text);
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
