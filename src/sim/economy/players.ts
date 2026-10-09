// 한 세계의 여러 플레이어. 차례가 결과를 바꾸는 곳은 시드로 날마다 섞는다 (기획서 "멀티플레이 구조").
import { createRng, mixSeed, shuffle } from '../rng';
import type { EconomyState, OrderOwner, PlayerId, PlayerOwner, PlayerState } from './state';

/** 로컬 게임의 사람 플레이어 id */
export const LOCAL_PLAYER: PlayerId = 'me';

export function getPlayer(state: EconomyState, id: PlayerId): PlayerState {
  const p = state.players[id];
  if (!p) throw new Error(`없는 플레이어: ${id}`);
  return p;
}

/** 들어온 차례대로 (저장과 서버에서 순서가 흔들리지 않게 seq로 센다) */
export function playerList(state: EconomyState): PlayerState[] {
  return Object.values(state.players).sort((a, b) => a.seq - b.seq);
}

/**
 * 오늘 플레이어 차례: 시드와 날짜로 섞는다. 세계의 난수(state.rng)는 건드리지 않는다.
 * 한 사람뿐이면 섞지 않는다
 */
export function playerOrder(state: EconomyState): PlayerState[] {
  const list = playerList(state);
  if (list.length < 2) return list;
  return shuffle(list, createRng(mixSeed(state.seed, 0x0bde, state.day)));
}

/** 플레이어마다 다른 시드. 첫 플레이어(seq 0)는 한 사람 세계와 같은 시드를 그대로 쓴다 */
export function playerSeed(base: number, p: PlayerState): number {
  return p.seq === 0 ? base : mixSeed(base, 0x91a7, p.seq);
}

export function isPlayerOwner(owner: OrderOwner): owner is PlayerOwner {
  return owner.kind === 'player' || owner.kind === 'store' || owner.kind === 'caravan';
}

/** 이 플레이어의 신청인가 */
export function ownedBy(owner: OrderOwner, id: PlayerId): boolean {
  return isPlayerOwner(owner) && owner.pid === id;
}
