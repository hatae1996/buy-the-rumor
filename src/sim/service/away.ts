// 자리를 비운 사이 (작업목록-0.2.0 6번). 장날마다 사람마다 하루치 기록(PlayerDigest)을 남기고,
// 다시 열면 마지막으로 본 날부터 모아 요약(AwaySummary)을 만든다. 로컬 게임(src/ui/game.ts)과 서버가 같은 함수를 쓴다.
import { getPlayer, noteView, playerView, type EconomyState, type LedgerEntry, type NewsItem, type NoteView, type PlayerDayReport, type PlayerId } from '../economy';
import type { HeardRumor } from '../rumors/types';
import type { NotifyEvent } from '../notify';
import type { WorldMap } from '../worldgen';

/** 한 사람의 장날 하루치 (서버는 day_reports 표에) */
export interface PlayerDigest {
  /** 연 장날 */
  day: number;
  /** 그날 밤 수첩에 새로 적힌 줄 */
  heard: HeardRumor[];
  stamped: number;
  notices: NotifyEvent[];
  /** 장날을 돌리는 동안 새로 생긴 장부 줄 (그날 낮에 내가 한 일은 빼고) */
  ledger: LedgerEntry[];
  /** 그날 밤 길에서 내려 닿은 마을 */
  arrivedAt: number | null;
}

/** 장날을 돌리기 전에 적어 두는 것 */
export interface DigestMark {
  ledger: number;
  onRoad: boolean;
}

export function markBefore(state: EconomyState, pid: PlayerId): DigestMark {
  const p = getPlayer(state, pid);
  return { ledger: p.ledger.length, onRoad: p.travel !== null };
}

export function digestAfter(state: EconomyState, pid: PlayerId, mark: DigestMark, day: number, report: PlayerDayReport | undefined): PlayerDigest {
  const p = getPlayer(state, pid);
  return {
    day,
    heard: report?.heard ?? [],
    stamped: report?.stamped ?? 0,
    notices: report?.notices ?? [],
    ledger: p.ledger.slice(mark.ledger),
    arrivedAt: mark.onRoad && p.travel === null ? p.town : null,
  };
}

/** 자리를 비운 사이 일어난 일 */
export interface AwaySummary {
  days: number;
  fromDay: number;
  toDay: number;
  ledger: LedgerEntry[];
  news: NewsItem[];
  /** 그 사이 도착한 마을 (지금도 그 마을에 있을 때) */
  arrivedAt: number | null;
  /** 그 사이 수첩에 새로 적힌 이야기 */
  heard: NoteView[];
  /** 그 사이 새로 찍힌 도장 수 */
  stamped: number;
  /** 그 사이 알림을 보낼 만한 사건 (장날 결과, 급한 일, 도착 등) */
  notices: NotifyEvent[];
  /** 지금 마을 여관에 아직 못 들은 소문이 있다 (0.1.2: 자리를 비운 사이에는 표시만) */
  innFresh: boolean;
}

/** 하루치 기록을 모아 요약한다. fromDay: 처음 돌린 장날 (= 마지막으로 본 날) */
export function awaySummary(state: EconomyState, map: WorldMap, pid: PlayerId, digests: readonly PlayerDigest[], fromDay: number): AwaySummary {
  const view = playerView(state, map, pid);
  const lastArrival = [...digests].reverse().find((d) => d.arrivedAt !== null)?.arrivedAt ?? null;
  return {
    days: digests.length,
    fromDay,
    toDay: state.day,
    ledger: digests.flatMap((d) => d.ledger),
    // 신문은 산 날만 전문, 아니면 머리기사만 (0.1.0, playerView가 가른다)
    news: view.news.filter((n) => n.day >= fromDay),
    arrivedAt: getPlayer(state, pid).travel === null ? lastArrival : null,
    heard: digests.flatMap((d) => d.heard.map(noteView)),
    stamped: digests.reduce((s, d) => s + d.stamped, 0),
    notices: digests.flatMap((d) => d.notices),
    innFresh: view.gossip !== null && view.gossip.canListen && view.gossip.fresh > 0,
  };
}
