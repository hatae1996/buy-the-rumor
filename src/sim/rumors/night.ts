// 하루 끝의 소문: 새 소문이 생기고, 오래된 소문은 사라지고, 플레이어가 듣고, 수첩에 도장이 찍힌다.
// 소문은 따로 둔 난수와 번호를 써서 경제 결과(시세, 일꾼)를 바꾸지 않는다.
import type { EconomyState } from '../economy/state';
import { createRng, mixSeed } from '../rng';
import type { WorldMap } from '../worldgen';
import { makeRumorsToday } from './facts';
import { createGossips } from './gossips';
import { hearFromGossips } from './hear';
import { deliverPigeons, informantReports } from './pigeon';
import type { HeardRumor, RumorMill } from './types';
import { verifyNotebook } from './verify';

export function emptyRumorMill(): RumorMill {
  return { live: [], gossips: [], gossipSeason: 0, cooldown: {}, lastSaid: {}, nextId: 1 };
}

export interface RumorNight {
  /** 오늘 밤 수첩에 새로 적힌 줄 */
  heard: HeardRumor[];
  /** 오늘 밤 새로 찍힌 도장 수 */
  stamped: number;
}

/** 장날과 생산이 끝난 뒤 부른다. 시즌이 없는 미리 돌리기 동안은 아무것도 하지 않는다 */
export function rumorNight(state: EconomyState, map: WorldMap): RumorNight {
  const season = state.season;
  if (!season) return { heard: [], stamped: 0 };
  const mill = state.rumorMill;
  const rng = createRng(mixSeed(state.seed, 0x7a1e, state.day));

  // 소문꾼 성격은 시즌마다 새로 정한다
  if (mill.gossipSeason !== season.number) {
    mill.gossips = createGossips(state.seed, season.number, state.towns.length);
    mill.gossipSeason = season.number;
  }
  mill.live = mill.live.filter((r) => r.expires >= state.day);
  for (const [key, until] of Object.entries(mill.cooldown)) if (until <= state.day) delete mill.cooldown[key];
  mill.live.push(...makeRumorsToday(state, map, rng));

  const heard = [...deliverPigeons(state, map), ...informantReports(state, map), ...hearFromGossips(state, map, rng)];
  const stamped = verifyNotebook(state, map);
  return { heard, stamped };
}
