// 말하기: 소문꾼은 들은 소문을 성격대로 고쳐 말한다 (기획서 "소문꾼의 성격").
// 믿을 만한 노인은 부푼 숫자를 덜어 내고, 허풍쟁이는 부풀리고, 장사꾼은 자기 물품 값이 오른다고 하고,
// 겁쟁이는 나쁜 소식을 크게 말한다. 여관 손님(teller가 null)은 들은 그대로 전한다.
import { RUMORS } from '../constants';
import { basePrice } from '../economy/goods';
import { eventDef } from '../events/defs';
import type { RegionTagId, WorldMap } from '../worldgen';
import { claimText, type TellFlavor } from './text';
import type { Claim, Gossip, RumorCopy, RumorFact, WorldRumor } from './types';

export interface Telling {
  claim: Claim;
  text: string;
  importance: number;
}

const SCARY_TAGS: readonly RegionTagId[] = ['bears', 'wolves', 'bandits'];
const BAD_CATEGORIES = ['supplyDown', 'road', 'demandDown'];

/** 나쁜 소식인가 (겁쟁이가 크게 말한다) */
export function isBadNews(f: RumorFact): boolean {
  switch (f.kind) {
    case 'omen':
      return BAD_CATEGORIES.includes(eventDef(f.event).category);
    case 'node':
      return f.level === 'low';
    case 'trait':
      return SCARY_TAGS.includes(f.tag);
    default:
      return false;
  }
}

export function tell(r: WorldRumor, copy: RumorCopy, teller: Gossip | null, map: WorldMap): Telling {
  const p = teller ? RUMORS.personality[teller.personality] : null;
  // 노인은 부푼 만큼을 덜어 내고, 나머지는 자기 버릇대로 부풀린다
  let scale = p ? 1 + (copy.scale - 1) * (1 - p.calm) : copy.scale;
  scale *= p?.inflate ?? 1;
  const f = r.fact;
  const scared = teller?.personality === 'coward' && isBadNews(f);
  const flavor: TellFlavor = { strong: scared || scale >= RUMORS.hop.exaggerate, scared };
  let importance = r.importance + (scared ? RUMORS.cowardBadBonus : 0);
  const pitching = teller?.personality === 'merchant' && 'good' in f && f.good === teller.good;

  let claim: Claim;
  switch (f.kind) {
    case 'omen':
      claim = { kind: 'omen', event: f.event, town: f.town, from: r.day, until: r.day + RUMORS.verify.omenDays };
      break;
    case 'node':
      claim = { kind: 'node', town: f.town, resource: f.resource, level: f.level };
      break;
    case 'trait':
      claim = { kind: 'trait', town: f.town, tag: f.tag };
      break;
    case 'price': {
      // 장사꾼은 자기 물품이면 값이 오른다고 한다
      const dir = pitching ? 'high' : f.dir;
      const base = pitching ? Math.max(f.price, basePrice(f.good)) * RUMORS.merchantInflate : f.price;
      const said = dir === 'high' ? base * scale : base / scale;
      claim = { kind: 'price', town: f.town, good: f.good, dir, ...blurPrice(said, dir, copy.blur) };
      break;
    }
    case 'orders': {
      const side = pitching ? 'buy' : f.side;
      claim = { kind: 'orders', town: f.town, good: f.good, side, qty: copy.blur === 0 ? Math.max(1, Math.round(f.qty * scale)) : null };
      break;
    }
  }
  if (pitching) importance += 1;
  return { claim, text: claimText(claim, map, flavor), importance };
}

/** 장사꾼이 할 말이 없을 때: 자기 물품이 다른 마을에서 비싸다고 한다 (근거 없음) */
export function pitch(teller: Gossip, town: number, map: WorldMap): Telling | null {
  if (!teller.good) return null;
  const claim: Claim = { kind: 'price', town, good: teller.good, dir: 'high', price: null, bound: null };
  return { claim, text: claimText(claim, map), importance: 1 };
}

/** 흐려진 정도에 따라 숫자를 뭉갠다: 그대로 → 어림 ("40은 넘는다") → 숫자 없음 ("금값") */
function blurPrice(price: number, dir: 'high' | 'low', blur: number): Pick<Extract<Claim, { kind: 'price' }>, 'price' | 'bound'> {
  const p = Math.max(1, price);
  if (blur <= 0) return { price: Math.round(p), bound: 'about' };
  if (blur === 1) {
    const step = p >= 20 ? 10 : p >= 10 ? 5 : 1;
    return dir === 'high'
      ? { price: Math.max(step, Math.floor(p / step) * step), bound: 'atLeast' }
      : { price: Math.ceil(p / step) * step, bound: 'atMost' };
  }
  return { price: null, bound: null };
}
