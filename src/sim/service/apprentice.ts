// 견습 세계 (작업목록-0.2.0 7번, 답 111): 공유 세계 밖에서 혼자 쓰는 작은 세계. 같은 시즌 시드라 지도와 마을은
// 공유 세계와 같고, 사람 한 명에 봇이 없으며 "하루 보내기"로만 날이 간다. 졸업 장면에서 길을 떠나면
// 돈·짐·손수레·여행 식량만 들고 그날의 공유 세계 견습 마을에 들어가 바로 그 길을 떠난다.
import type { UnlockId } from '../apprentice/types';
import { eventDef } from '../events/defs';
import { activate } from '../events/active';
import { applyCommand, getPlayer, joinPlayer, type Command, type CommandResult, type JoinKit, type PlayerId, type PlayerSpec } from '../economy';
import { PRE_SEASON_PAPER_DAY } from '../news/daily';
import { AUTUMN } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';
import { assertSimVersion, openWorld, type WorldBlob } from './world';

export const APPRENTICE_WORLD_ID = 'apprentice';

/** 견습 세계를 연다: 시작 화면에서 정한 상단으로, 견습 첫 장면부터 */
export function openApprentice(map: WorldMap, opt: { seasonId: string; spec: PlayerSpec; warmupDays?: number }): WorldBlob {
  return openWorld(map, {
    seasonId: opt.seasonId,
    worldId: APPRENTICE_WORLD_ID,
    humans: [{ ...opt.spec, apprentice: true }],
    bots: 0,
    warmupDays: opt.warmupDays,
  });
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

/** 견습 세계에서 들고 나오는 것 (답 111) */
export function graduationKit(blob: WorldBlob, pid: PlayerId): Graduation {
  const p = getPlayer(blob.state, pid);
  if (!p.apprentice) throw new Error('견습 중이 아니다');
  return {
    kit: { gold: p.gold, cart: p.cart, unlocks: Object.keys(p.unlocks) as UnlockId[], notify: p.notify },
    town: p.apprentice.town,
    destination: p.apprentice.destination,
  };
}

/**
 * 그날의 공유 세계에 들인다: 견습 마을에 앉히고, 그 세계에서 가장 최근에 찍은 신문 한 부를 주고(답 116·119),
 * 견습에서 배운 조선소 소식이 공유 세계에도 이어지게 하고(질문 137), 졸업 명령의 길을 떠난다
 */
export function enterWorld(shared: WorldBlob, map: WorldMap, spec: PlayerSpec, g: Graduation, travel: Extract<Command, { type: 'travel' }>): CommandResult {
  assertSimVersion(shared);
  const state = shared.state;
  const p = joinPlayer(state, { ...spec, apprentice: false }, g.town, g.kit);
  const papers = state.news.filter((n) => n.day <= Math.max(PRE_SEASON_PAPER_DAY, state.day - 1)).map((n) => n.day);
  if (papers.length) p.newspapers = [Math.max(...papers)];
  if (!state.events.some((e) => e.event === 'shipyard' && e.town === g.destination)) {
    const def = eventDef('shipyard');
    const days = typeof def.days === 'number' ? def.days : 5;
    const road = townTravelDays(map, AUTUMN)[g.town]![g.destination]!;
    activate(state, map, 'shipyard', g.destination, state.day + days + (Number.isFinite(road) ? road : 0));
  }
  return applyCommand(state, map, spec.id, travel);
}
