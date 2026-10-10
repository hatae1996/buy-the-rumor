// 세계와 시즌 (0.1.3 "세계는 작게, 랭킹은 크게"): 세계(시장 하나)에는 10~15명, 랭킹은 같은 시즌의 모든 세계를 합쳐 매긴다.
// 같은 시즌의 세계는 모두 같은 시드로 연다(지도, 마을 특색, 사건 일정, 말 입고 일정이 같고 들어간 사람만 다르다).
// 로컬은 세계가 하나다. 서버(0.2.0)가 세계를 여러 개 열고 점수 줄을 모아 합친 순위를 매긴다.
import type { EconomyState } from './state';

export interface WorldRef {
  /** 시즌 id: 같은 시즌의 세계는 모두 같다 (서버: 시즌 여는 날 등) */
  seasonId: string;
  /** 세계 id: 시즌 안에서 세계마다 다르다 */
  worldId: string;
}

export const LOCAL_WORLD_ID = 'local';

/** 로컬 게임의 세계: 시드마다 시즌 하나, 세계 하나 */
export function localWorld(seed: number): WorldRef {
  return { seasonId: `local-${seed}`, worldId: LOCAL_WORLD_ID };
}

export function worldOf(state: EconomyState): WorldRef {
  return state.world;
}

/**
 * 시즌 id로 정하는 시드: 같은 시즌의 세계는 모두 이 시드로 연다 (서버가 쓴다).
 * 글자열 해시(FNV-1a)를 1_000_000_007 안으로
 */
export function seasonSeed(seasonId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seasonId.length; i++) {
    h ^= seasonId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 1_000_000_007;
}
