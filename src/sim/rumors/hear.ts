// 듣기 (기획서 "소문 - 듣는 방법"): 마을에 있으면 소문꾼에게 하루 2~3개를 공짜로 듣고,
// 여관에서 술 한 잔을 사면 여행자에게 1개 더 듣는다. 중요한 소문(징조)이 먼저 나온다.
import { RUMORS } from '../constants';
import type { EconomyState } from '../economy/state';
import { mixSeed, shuffle, type Rng } from '../rng';
import { townHops, type WorldMap } from '../worldgen';
import { addNote } from './notebook';
import { pitch, tell, type Telling } from './telling';
import type { Gossip, HeardRumor, RumorCopy, RumorFact, WorldRumor } from './types';

/** 소문꾼이 오늘 이 소문을 아나. 알면 그 마을에 닿은 사본 */
export function knownCopy(g: Gossip, r: WorldRumor, day: number): RumorCopy | null {
  if (day > r.expires) return null;
  const copy = r.reach.find((c) => c.town === g.town);
  if (!copy) return null;
  return day >= copy.day + RUMORS.personality[g.personality].lag ? copy : null;
}

/** 소문꾼이 헛소문을 믿고 옮기나. 같은 소문꾼, 같은 소문이면 늘 같은 답 (난수를 쓰지 않는다) */
export function believes(g: Gossip, r: WorldRumor): boolean {
  if (r.truth) return true;
  return mixSeed(g.id, r.id) / 4294967296 >= RUMORS.personality[g.personality].trust;
}

/** 지금 있는 마을의 시세와 신청 현황은 직접 보이니 소문으로 듣지 않는다 */
function seenHere(f: RumorFact, here: number): boolean {
  return (f.kind === 'price' || f.kind === 'orders') && f.town === here;
}

function heardIds(state: EconomyState): Set<number> {
  return new Set(state.player.rumors.map((h) => h.rumor).filter((id): id is number => id !== null));
}

interface Option {
  gossip: Gossip;
  rumor: WorldRumor | null;
  told: Telling;
}

/** 밤에: 마을에 있으면 소문꾼에게 공짜로 듣는다 */
export function hearFromGossips(state: EconomyState, map: WorldMap, rng: Rng): HeardRumor[] {
  const p = state.player;
  if (p.travel) return [];
  const here = p.town;
  const day = state.day;
  const mill = state.rumorMill;
  let budget = rng.int(RUMORS.freePerDay[0], RUMORS.freePerDay[1]);
  // 여럿이 같은 소문을 알면 그날그날 다른 사람이 먼저 꺼낸다
  const gossips = shuffle(
    mill.gossips.filter((g) => g.town === here),
    rng,
  );
  const heard = heardIds(state);

  const options: Option[] = [];
  for (const gossip of gossips) {
    for (const rumor of mill.live) {
      if (heard.has(rumor.id) || seenHere(rumor.fact, here) || !believes(gossip, rumor)) continue;
      const copy = knownCopy(gossip, rumor, day);
      if (copy) options.push({ gossip, rumor, told: tell(rumor, copy, gossip, map) });
    }
  }
  // 중요한 것부터, 같으면 새 소문부터
  options.sort((a, b) => b.told.importance - a.told.importance || b.rumor!.day - a.rumor!.day || a.rumor!.id - b.rumor!.id);

  const talked = new Map<number, number>();
  const told = new Set<number>();
  const out: HeardRumor[] = [];
  const say = (o: Option) => {
    talked.set(o.gossip.id, (talked.get(o.gossip.id) ?? 0) + 1);
    if (o.rumor) told.add(o.rumor.id);
    budget--;
    out.push(
      addNote(state, {
        town: here,
        text: o.told.text,
        via: 'gossip',
        from: o.gossip.name,
        gossip: o.gossip.id,
        rumor: o.rumor?.id ?? null,
        importance: o.told.importance,
        claim: o.told.claim,
      }),
    );
  };
  const canTalk = (g: Gossip) => (talked.get(g.id) ?? 0) < RUMORS.personality[g.personality].talk;
  for (const o of options) {
    if (budget <= 0) break;
    if (!told.has(o.rumor!.id) && canTalk(o.gossip)) say(o);
  }
  // 할 말이 없는 장사꾼은 자기 물품이 다른 마을에서 비싸다고 한다
  const others = map.towns.filter((t) => t.id !== here).map((t) => t.id);
  for (const gossip of gossips) {
    if (budget <= 0 || gossip.personality !== 'merchant' || !canTalk(gossip) || !others.length) continue;
    if (rng.next() >= RUMORS.merchantPitchChance) continue;
    const t = pitch(gossip, rng.pick(others), map);
    if (t) say({ gossip, rumor: null, told: t });
  }
  return out;
}

/**
 * 여관 손님(여행자)이 아는 소문 하나. 이웃 마을에 이미 닿은 소문도 안다 (먼 마을 소문).
 * 들은 그대로 전한다. 들려줄 게 없으면 null
 */
export function innRumor(state: EconomyState, map: WorldMap): { rumor: WorldRumor; told: Telling } | null {
  const here = state.player.town;
  const day = state.day;
  const hops = townHops(map)[here]!;
  const heard = heardIds(state);
  let best: { rumor: WorldRumor; copy: RumorCopy; score: number } | null = null;
  for (const rumor of state.rumorMill.live) {
    if (day > rumor.expires || heard.has(rumor.id) || seenHere(rumor.fact, here)) continue;
    // 여행자는 이 마을이나 이웃 마을에 닿은 소문을 갖고 온다
    const copies = rumor.reach.filter((c) => c.day <= day && hops[c.town]! <= 1);
    if (!copies.length) continue;
    const copy = copies.reduce((a, c) => (c.blur < a.blur ? c : a));
    const local = rumor.reach.find((c) => c.town === here);
    // 아직 이 마을에 닿지 않은 소문이 더 값지다
    const score = rumor.importance + (!local || local.day > day ? 1 : 0);
    if (!best || score > best.score || (score === best.score && rumor.day > best.rumor.day)) best = { rumor, copy, score };
  }
  return best ? { rumor: best.rumor, told: tell(best.rumor, best.copy, null, map) } : null;
}
