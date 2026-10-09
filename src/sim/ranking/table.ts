// 세계의 랭킹 표 (기획서 "랭킹 부문", 0.1.0 작업 5): 부문마다 모든 플레이어의 순위.
// 장날마다 한 번 새로 매겨 상태에 둔다 (화면 데이터와 신문이 이것을 읽는다).
// 점수가 없거나 0 이하인 사람은 그 부문에 오르지 않는다 (판 적 없는 물품왕, 아직 이른 수완가).
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
  table: RankTable;
}

function scoreOf(s: SeasonScores, c: CategoryId): number | null {
  if (c.startsWith('goodsKing:')) return s.goodsKing[c.slice('goodsKing:'.length) as keyof SeasonScores['goodsKing']];
  return s[c as 'bigShot' | 'multiplier' | 'oneShot' | 'buyTheRumor'];
}

/** 지금 점수로 모든 부문의 순위를 매긴다 */
export function rankAll(state: EconomyState): RankTable {
  const scores = new Map<PlayerId, SeasonScores>();
  for (const p of playerList(state)) {
    const s = seasonScores(state, p);
    if (s) scores.set(p.id, s);
  }
  const table: RankTable = {};
  for (const c of CATEGORIES) {
    const entries = [...scores].map(([id, s]) => {
      const score = scoreOf(s, c);
      return { id, score: score !== null && score > 0 ? score : null };
    });
    table[c] = standings(entries);
  }
  return table;
}

/** 장날 뒤에: 오늘 순위를 매겨 둔다 */
export function updateRankings(state: EconomyState): void {
  state.rankings = { day: state.day, table: rankAll(state) };
}

/**
 * 신문의 큰 거래에 실리는 상단 이름. 기본은 "어느 상단"으로 익명이고, 랭킹 상위권(어제 매긴 큰손 부문
 * ECONOMY.ranking.namedInNews위까지) 상단만 이름이 실린다 (기획서 "플레이어의 큰 거래도 신문에 실린다").
 * 이름을 짓지 않은 상단도 익명이다
 */
export function newsName(state: EconomyState, p: PlayerState): string {
  const top = (state.rankings?.table.bigShot ?? []).some((s) => s.id === p.id && s.rank <= ECONOMY.ranking.namedInNews);
  return top && p.certificate.name !== createCertificate().name ? p.certificate.name : '어느 상단';
}
