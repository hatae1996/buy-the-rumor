// 견습 세계 (작업목록-0.2.0 7번, 답 111): 공유 세계 밖에서 혼자 쓰는 작은 세계. 같은 시즌 시드라 지도와 마을은
// 공유 세계와 같고, 사람 한 명에 봇이 없으며 "하루 보내기"로만 날이 간다. 졸업 장면에서 길을 떠나면
// 돈·짐·손수레·여행 식량만 들고 그날의 공유 세계 견습 마을에 들어가 바로 그 길을 떠난다.
// 견습 신문의 조선소 소식은 견습 세계에서만 일어나고, 공유 세계에는 그 사람만의 견습 손님을 둔다 (0.2.1, 답 137).
import { apprenticeGuestOf } from '../apprentice/guest';
import { startApprentice } from '../apprentice/progress';
import type { UnlockId } from '../apprentice/types';
import { cartCount } from '../cart';
import { seededStartTown } from '../economy/create';
import { createRng, mixSeed } from '../rng';
import { applyCommand, getPlayer, joinPlayer, type Command, type CommandResult, type JoinKit, type PlayerId, type PlayerSpec } from '../economy';
import { PRE_SEASON_PAPER_DAY } from '../news/daily';
import type { WorldMap } from '../worldgen';
import { assertSimVersion, openWorld, type WorldBlob } from './world';

export const APPRENTICE_WORLD_ID = 'apprentice';

/**
 * 견습 세계를 연다: 시작 화면에서 정한 상단으로, 견습 첫 장면부터.
 * 견습 세계에는 사람이 하나라 들어온 차례가 늘 0번이다. 그대로면 같은 시즌의 모든 사람이 같은 견습 마을·같은 목적지를
 * 받으므로(0.2.0 봇 시즌 측정에서 찾음), 상인 번호로 시작 마을을 뽑고 견습 마을을 다시 정한다
 * (로컬처럼: 모든 마을에 고르게 랜덤인 시작 마을이 생산 마을이면 그대로, 아니면 생산 마을 중 하나)
 */
export function openApprentice(map: WorldMap, opt: { seasonId: string; spec: PlayerSpec; warmupDays?: number }): WorldBlob {
  const blob = openWorld(map, {
    seasonId: opt.seasonId,
    worldId: APPRENTICE_WORLD_ID,
    humans: [{ ...opt.spec, apprentice: true }],
    bots: 0,
    warmupDays: opt.warmupDays,
  });
  const no = opt.spec.merchantNo ?? opt.spec.certificate?.merchantNo ?? null;
  if (no !== null) {
    const state = blob.state;
    const p = getPlayer(state, opt.spec.id);
    p.town = seededStartTown(state.seed, no, state.towns.length);
    startApprentice(state, p, map, createRng(mixSeed(state.seed ^ 0xa99e, 0x91a7, no)));
  }
  return blob;
}

/** 이 명령이 졸업인가: 졸업 장면에서 처음 길을 떠난다 (로컬에서는 이 명령으로 견습이 끝난다) */
export function isGraduation(blob: WorldBlob, pid: PlayerId, cmd: Command): cmd is Extract<Command, { type: 'travel' }> {
  return getPlayer(blob.state, pid).apprentice?.scene === 'graduation' && cmd?.type === 'travel';
}

export interface Graduation {
  kit: JoinKit;
  /** 견습 마을: 공유 세계에서 처음 서 있을 곳 */
  town: number;
  /** 첫 신문의 조선소 소식이 난 마을 (졸업하고 갈 곳) */
  destination: number;
}

/** 견습 세계에서 들고 나오는 것 (답 111)과 가는 마을의 견습 손님 (답 137) */
export function graduationKit(blob: WorldBlob, pid: PlayerId): Graduation {
  const p = getPlayer(blob.state, pid);
  if (!p.apprentice) throw new Error('견습 중이 아니다');
  const guest = apprenticeGuestOf(blob.state, p, cartCount(p.cart, 'wood'));
  return {
    kit: { gold: p.gold, cart: p.cart, unlocks: Object.keys(p.unlocks) as UnlockId[], notify: p.notify, guest },
    town: p.apprentice.town,
    destination: p.apprentice.destination,
  };
}

/**
 * 그날의 공유 세계에 들인다: 견습 마을에 앉히고, 그 세계에서 가장 최근에 찍은 신문 한 부를 주고(답 116·119),
 * 졸업 명령의 길을 떠난다. 공유 세계에는 조선소 사건을 일으키지 않는다(답 137): 견습 손님이 대신 산다
 */
export function enterWorld(shared: WorldBlob, map: WorldMap, spec: PlayerSpec, g: Graduation, travel: Extract<Command, { type: 'travel' }>): CommandResult {
  assertSimVersion(shared);
  const state = shared.state;
  const p = joinPlayer(state, { ...spec, apprentice: false }, g.town, g.kit);
  const papers = state.news.filter((n) => n.day <= Math.max(PRE_SEASON_PAPER_DAY, state.day - 1)).map((n) => n.day);
  if (papers.length) p.newspapers = [Math.max(...papers)];
  return applyCommand(state, map, spec.id, travel);
}
