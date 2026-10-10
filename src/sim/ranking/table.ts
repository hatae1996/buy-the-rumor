// 랭킹 표 (기획서 "랭킹 부문", 0.1.0 작업 5): 부문마다 모든 플레이어의 순위.
// 장날마다 한 번 새로 매겨 상태에 둔다 (화면 데이터와 신문이 이것을 읽는다).
// 점수가 없거나 0 이하인 사람은 그 부문에 오르지 않는다 (판 적 없는 물품왕, 아직 이른 수완가).
// 0.1.3 세계는 작게, 랭킹은 크게: 점수 줄(시즌 id, 세계 id, 플레이어, 부문, 점수)을 모아 "시즌 전체"와 "내 세계" 두 순위를 매긴다.
// 인장·칭호는 시즌 전체로, 신문 큰손 기사는 내 세계로. 로컬은 세계가 하나라 둘이 같다.
// 플레이어 id는 시즌 전체에서 하나뿐이어야 한다 (서버: 계정 id, 봇도 세계마다 다른 id).
// 0.2.0 봇(떠돌이): 내 세계 순위에는 봇도 오르고, 시즌 전체 순위(인장·칭호·상위 10%·5명 문턱의 기준)는 사람만.
import { playerList } from '../economy/players';
import { ECONOMY } from '../constants';
import type { EconomyState, PlayerId, PlayerState } from '../economy/state';
import { createCertificate } from './certificate';
import { CATEGORIES } from './badges';
import { seasonScores, type SeasonScores } from './scores';
import { standings, type Standing } from './standings';
import type { CategoryId } from './types';

/** 부문마다 순위 (점수 높은 순) */
export type RankTable = Partial<Record<CategoryId, Standing[]>>;

export interface Rankings {
  /** 매긴 날 (그날 장날 뒤) */
  day: number;
  /** 내 세계 순위 */
  table: RankTable;
  /** 시즌 전체 순위 (같은 시즌의 모든 세계) */
  season: RankTable;
}

/** 점수 한 줄: 서버가 세계마다 모아 시즌 전체 순위를 매긴다 */
export interface ScoreRow {
  seasonId: string;
  worldId: string;
  playerId: PlayerId;
  /** 상단 이름 (증서) */
  name: string;
  /** 봇 상단 (시즌 전체 순위에서 뺀다) */
  bot: boolean;
  category: CategoryId;
  score: number;
}

function scoreOf(s: SeasonScores, c: CategoryId): number | null {
  if (c.startsWith('goodsKing:')) return s.goodsKing[c.slice('goodsKing:'.length) as keyof SeasonScores['goodsKing']];
  return s[c as 'bigShot' | 'multiplier' | 'oneShot' | 'buyTheRumor'];
}

/** 이 세계의 점수 줄: 부문마다 점수가 0보다 큰 사람만 */
export function scoreRows(state: EconomyState): ScoreRow[] {
  const { seasonId, worldId } = state.world;
  const rows: ScoreRow[] = [];
  for (const p of playerList(state)) {
    const s = seasonScores(state, p);
    if (!s) continue;
    for (const c of CATEGORIES) {
      const score = scoreOf(s, c);
      if (score !== null && score > 0) rows.push({ seasonId, worldId, playerId: p.id, name: p.certificate.name, bot: p.bot, category: c, score });
    }
  }
  return rows;
}

/** 점수 줄로 부문마다 순위를 매긴다 */
export function rankRows(rows: readonly ScoreRow[]): RankTable {
  const table: RankTable = {};
  for (const c of CATEGORIES) table[c] = standings(rows.filter((r) => r.category === c).map((r) => ({ id: r.playerId, score: r.score, worldId: r.worldId, name: r.name })));
  return table;
}

/**
 * 지금 점수로 두 순위를 매긴다: 내 세계(봇 포함), 그리고 시즌 전체(다른 세계의 점수 줄 others를 합쳐서, 같은 시즌만, 사람만).
 * 로컬은 others가 없어 시즌 전체 = 내 세계의 사람
 */
export function rankAll(state: EconomyState, others: readonly ScoreRow[] = []): { world: RankTable; season: RankTable } {
  const mine = scoreRows(state);
  const { seasonId, worldId } = state.world;
  const rest = others.filter((r) => r.seasonId === seasonId && r.worldId !== worldId);
  return { world: rankRows(mine), season: rankRows([...mine, ...rest].filter((r) => !r.bot)) };
}

/** 장날 뒤에: 오늘 순위를 매겨 둔다 (서버는 다른 세계의 점수 줄을 넘긴다) */
export function updateRankings(state: EconomyState, others: readonly ScoreRow[] = []): void {
  const { world, season } = rankAll(state, others);
  state.rankings = { day: state.day, table: world, season };
}

/**
 * 신문의 큰 거래에 실리는 상단 이름. 기본은 "어느 상단"으로 익명이고, 랭킹 상위권(어제 매긴 큰손 부문
 * ECONOMY.ranking.namedInNews위까지) 상단만 이름이 실린다 (기획서 "플레이어의 큰 거래도 신문에 실린다").
 * 상위권은 내 세계 순위로 본다 (0.1.3: 신문은 그 세계 소식이다).
 * 이름을 짓지 않은 상단도 익명이다
 */
export function newsName(state: EconomyState, p: PlayerState): string {
  const top = (state.rankings?.table.bigShot ?? []).some((s) => s.id === p.id && s.rank <= ECONOMY.ranking.namedInNews);
  if (!top || p.certificate.name === createCertificate().name) return '어느 상단';
  // 봇은 사람인 척하지 않는다 (0.2.0 9번)
  return p.bot ? `${p.certificate.name}(떠돌이)` : p.certificate.name;
}
