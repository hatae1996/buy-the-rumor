// 하루 끝의 소문: 새 소문이 생기고, 오래된 소문은 사라지고, 플레이어가 듣고, 수첩에 도장이 찍힌다.
// 소문은 따로 둔 난수와 번호를 써서 경제 결과(시세, 일꾼)를 바꾸지 않는다.
import { playerOrder, playerSeed } from '../economy/players';
import type { EconomyState, PlayerId } from '../economy/state';
import { createRng, mixSeed } from '../rng';
import type { WorldMap } from '../worldgen';
import { makeRumorsToday } from './facts';
import { createGossips } from './gossips';
import { hearFromGossips } from './hear';
import { deliverPigeons, informantReports } from './pigeon';
import type { HeardRumor, RumorMill } from './types';
import { logMarkets, verifyNotebook } from './verify';

export function emptyRumorMill(): RumorMill {
  return { live: [], gossips: [], gossipSeason: 0, cooldown: {}, lastSaid: {}, nextId: 1, marketLog: {} };
}

export interface RumorNight {
  /** 오늘 밤 수첩에 새로 적힌 줄 */
  heard: HeardRumor[];
  /** 오늘 밤 새로 찍힌 도장 수 */
  stamped: number;
}

/**
 * 장날과 생산이 끝난 뒤 부른다. 시즌이 없는 미리 돌리기 동안은 아무것도 하지 않는다.
 * 플레이어마다 따로 듣는다 (그날 차례로, 난수도 플레이어마다)
 */
export function rumorNight(state: EconomyState, map: WorldMap): Record<PlayerId, RumorNight> {
  const out: Record<PlayerId, RumorNight> = {};
  const season = state.season;
  if (!season) return out;
  const mill = state.rumorMill;
  const seed = mixSeed(state.seed, 0x7a1e, state.day);
  const rng = createRng(seed);

  // 소문꾼 성격은 시즌마다 새로 정한다
  if (mill.gossipSeason !== season.number) {
    mill.gossips = createGossips(state.seed, season.number, state.towns.length);
    mill.gossipSeason = season.number;
  }
  mill.live = mill.live.filter((r) => r.expires >= state.day);
  for (const [key, until] of Object.entries(mill.cooldown)) if (until <= state.day) delete mill.cooldown[key];
  logMarkets(state);
  mill.live.push(...makeRumorsToday(state, map, rng));

  for (const p of playerOrder(state)) {
    // 첫 플레이어는 소문을 만들고 남은 난수를 이어 쓴다 (한 사람 세계와 같게)
    const heardRng = p.seq === 0 ? rng : createRng(playerSeed(seed, p));
    const heard = [...deliverPigeons(state, p, map), ...informantReports(state, p, map), ...hearFromGossips(state, p, map, heardRng)];
    out[p.id] = { heard, stamped: verifyNotebook(state, p, map) };
  }
  return out;
}
