// 시즌 결산 (기획서 "시즌 흐름 3", 0.1.0 작업 5): 시즌 마지막 장날 뒤 한 번.
// 순자산과 부문 순위를 매기고, 랭킹 인장(부문마다 1위·상위 3명·상위 10% 중 가장 좋은 것 하나, 그 부문에 5명 이상일 때만),
// 1위 칭호("3시즌 소금왕"), 완주 기념 인장과 상인 연차, 시즌 리포트를 남긴다.
// 결산 뒤에는 그 시즌 명령을 받지 않는다 (서버는 다음 날 쉬고, 로컬은 결산 화면을 닫으면 새 세계로).
// 0.1.3: 인장·칭호·상위 10%는 시즌 전체 순위(같은 시즌의 모든 세계)로 매긴다. 화면에는 내 세계 순위도 함께.
import { ECONOMY } from '../constants';
import { playerList } from '../economy/players';
import type { EconomyState, PlayerId, PlayerState } from '../economy/state';
import type { GoodId } from '../economy/goods';
import { CATEGORIES, categoryName, memorialBadge, RANKING_PLACES, rankingBadge } from './badges';
import { awardBadge } from './record';
import { bestSale } from './scores';
import type { Standing } from './standings';
import { rankAll, type RankTable, type ScoreRow } from './table';
import type { CategoryId } from './types';
import { netWorth } from './worth';

/** 시즌 리포트: 모두에게 (기획서 "그 밖의 보상") */
export interface SeasonReport {
  /** 시즌 끝 순자산 (내 것만 본다) */
  worth: number;
  /** 내 최고 거래 (산 값 대비 가장 크게 남긴 판매) */
  bestTrade: { day: number; town: number; good: GoodId; qty: number; price: number; profit: number } | null;
  /** 가장 믿었던 소문꾼 ("맞았다" 도장을 가장 많이 받은) */
  trustedGossip: { name: string; right: number } | null;
  /** 이번 시즌 "맞았다" 도장 수 */
  rumorsRight: number;
  /** 다닌 길: 가 본 마을 수, 떠난 횟수, 길 위에서 보낸 날 */
  towns: number;
  trips: number;
  roadDays: number;
}

export interface SeasonSettlement {
  season: number;
  /** 결산한 날 (시즌 마지막 장날) */
  day: number;
  /** 시즌 전체 순위 (인장과 칭호는 이것으로) */
  table: RankTable;
  /** 내 세계 순위 */
  worldTable: RankTable;
  reports: Record<PlayerId, SeasonReport>;
  /** 이번 결산에서 새로 찍힌 인장과 칭호 */
  awarded: Record<PlayerId, { badges: string[]; titles: string[] }>;
}

/** 부문 순위에서 받을 랭킹 인장 하나 (가장 좋은 것) */
export function placeOf(s: Standing): (typeof RANKING_PLACES)[number]['id'] | null {
  if (s.rank === 1) return 'first';
  if (s.rank <= 3) return 'top3';
  if (s.topShare <= 0.1) return 'top10';
  return null;
}

/**
 * 시즌 결산. 같은 시즌은 한 번만 (두 번 부르면 처음 결과를 그대로 돌려준다).
 * others: 같은 시즌 다른 세계의 점수 줄 (서버가 모아 넘긴다, 로컬은 없음)
 */
export function settleSeason(state: EconomyState, others: readonly ScoreRow[] = []): SeasonSettlement | null {
  const season = state.season;
  if (!season) return null;
  if (state.settlement?.season === season.number) return state.settlement;
  const { world, season: table } = rankAll(state, others);
  // 서버는 마지막 장날 뒤에 결산하므로(0.2.0) 결산한 날은 마지막 장날로 적는다
  const out: SeasonSettlement = { season: season.number, day: Math.min(state.day, season.startDay + season.length - 1), table, worldTable: world, reports: {}, awarded: {} };
  for (const p of playerList(state)) {
    if (p.record?.season !== season.number) continue;
    // 봇(떠돌이)은 인장·칭호·연차를 받지 않는다 (시즌 전체 순위에도 없다, 0.2.0 9번)
    if (p.bot) continue;
    const got = { badges: [] as string[], titles: [] as string[] };
    for (const c of CATEGORIES) {
      const mine = table[c]?.find((x) => x.id === p.id);
      if (!mine) continue;
      if (c === 'bigShot') p.certificate.bestBigShotRank = Math.min(p.certificate.bestBigShotRank ?? Infinity, mine.rank);
      // 그 부문에 오른 사람이 적으면 랭킹 인장과 칭호는 없다 (답 94)
      if (table[c]!.length < ECONOMY.ranking.minEntrants) continue;
      const place = placeOf(mine);
      if (!place) continue;
      if (awardBadge(state, p, rankingBadge(c, place).id, null, season.number)) got.badges.push(rankingBadge(c, place).id);
      if (place === 'first') got.titles.push(giveTitle(p, `${season.number}시즌 ${categoryName(c as CategoryId)}`));
    }
    // 완주: 기념 인장과 상인 연차
    if (awardBadge(state, p, memorialBadge(season.number).id, null, season.number)) got.badges.push(memorialBadge(season.number).id);
    p.certificate.seasonsCompleted++;
    out.awarded[p.id] = got;
    out.reports[p.id] = reportOf(state, p, season.startDay);
  }
  state.settlement = out;
  return out;
}

function giveTitle(p: PlayerState, title: string): string {
  const c = p.certificate;
  if (!c.titles.includes(title)) c.titles.push(title);
  // 대표 칭호가 없으면 처음 얻은 칭호를 단다 (나중에 고를 수 있다)
  c.title ??= title;
  return title;
}

function reportOf(state: EconomyState, p: PlayerState, startDay: number): SeasonReport {
  const right = p.rumors.filter((h) => h.stamp === 'right' && h.day >= startDay);
  const by = new Map<string, number>();
  for (const h of right) if (h.via === 'gossip') by.set(h.from, (by.get(h.from) ?? 0) + 1);
  const trusted = [...by].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const trips = p.ledger.filter((e) => e.kind === 'travel' && e.day >= startDay);
  return {
    worth: netWorth(state, p),
    bestTrade: bestSale(p.record?.trades ?? []),
    trustedGossip: trusted ? { name: trusted[0], right: trusted[1] } : null,
    rumorsRight: right.length,
    towns: p.visited.length,
    trips: trips.length,
    roadDays: trips.reduce((s, e) => s + (e.kind === 'travel' ? e.days : 0), 0),
  };
}

/** 이번 시즌 마지막 장날을 마쳤는가 (결산했거나, 서버에서 결산을 기다린다) */
export function seasonFinished(state: EconomyState): boolean {
  const s = state.season;
  return state.settlement !== null || (s !== null && state.day > s.startDay + s.length - 1);
}

/** 오늘이 이번 시즌 마지막 장날인가 */
export function lastSeasonDay(state: EconomyState): boolean {
  const s = state.season;
  return s !== null && state.day === s.startDay + s.length - 1;
}
