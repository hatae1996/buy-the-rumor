// 소문꾼: 마을마다 2~3명, 성격은 시즌마다 시드로 정한다 (기획서 "소문꾼의 성격").
// 이름과 자리에는 성격이 드러나지 않는다. 플레이어가 겪어 보며 알아낸다.
import { RUMORS } from '../constants';
import { GOODS } from '../economy/goods';
import { createRng, mixSeed, shuffle } from '../rng';
import type { Gossip, Personality } from './types';

export const PERSONALITIES: readonly Personality[] = ['elder', 'braggart', 'merchant', 'coward'];

const PLACES = ['우물가', '빵집', '방앗간', '마구간', '광장', '술집', '부둣가', '대장간 앞', '시장 어귀', '푸줏간', '빨래터', '성문'];
const NAMES = ['마르타', '한스', '베른', '토마', '일자', '오토', '리나', '게르다', '파울', '엘사', '욘', '카를', '미나', '헤다', '루카', '브람'];

/** 시즌의 소문꾼. 같은 시드, 같은 시즌이면 같다 */
export function createGossips(seed: number, season: number, towns: number): Gossip[] {
  const rng = createRng(mixSeed(seed, 0x9055, season));
  const out: Gossip[] = [];
  const [lo, hi] = RUMORS.gossipsPerTown;
  for (let town = 0; town < towns; town++) {
    const n = rng.int(lo, hi);
    const places = shuffle([...PLACES], rng);
    const names = shuffle([...NAMES], rng);
    for (let i = 0; i < n; i++) {
      const personality = rng.pick(PERSONALITIES);
      out.push({
        id: season * 1000 + out.length,
        town,
        name: `${places[i]} ${names[i]}`,
        personality,
        good: personality === 'merchant' ? rng.pick(GOODS) : null,
      });
    }
  }
  return out;
}
