// 시즌 기록과 인장 찍기: 거래, 들은 징조, 이야기가 되는 순간을 적고, 조건이 맞으면 증서에 인장을 찍는다.
// 시즌이 바뀌면 새로 센다. 완주 기념 인장, 연차, 랭킹 인장은 시즌 결산에서 (settle.ts, 0.1.0).
// 공동 의뢰 인장은 서버 전체 합으로 (멀티플레이 버전).
import { ECONOMY } from '../constants';
import type { GoodId } from '../economy/goods';
import { playerList } from '../economy/players';
import type { EconomyState, PlayerState } from '../economy/state';
import type { ScheduledEventId } from '../events/types';
import { seasonOfDay } from '../season';
import { ACHIEVEMENTS } from './badges';
import { themeDef } from './quests';
import { buyTheRumorProfit } from './scores';
import type { EarnedBadge, MomentId, QuestDef, SeasonRecord, Tier, TradeRecord } from './types';
import { netWorth } from './worth';

const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold'];

/** 시즌이 바뀌었으면 플레이어마다 새 기록을 연다. 하루를 시작할 때와 새 판에서 부른다 */
export function ensureRecord(state: EconomyState): void {
  for (const p of playerList(state)) ensurePlayerRecord(state, p);
}

export function ensurePlayerRecord(state: EconomyState, p: PlayerState): void {
  const season = state.season;
  if (!season) return;
  if (p.record?.season === season.number) return;
  const worth = netWorth(state, p);
  const { seasonId, worldId } = state.world;
  p.record = { season: season.number, seasonId, worldId, joinedDay: state.day, startWorth: worth, minWorth: worth, trades: [], heardOmens: [], moments: [] };
}

export function noteTrade(p: PlayerState, t: TradeRecord): void {
  p.record?.trades.push(t);
}

export function noteOmenHeard(state: EconomyState, p: PlayerState, event: ScheduledEventId, town: number): void {
  p.record?.heardOmens.push({ event, town, day: state.day });
}

export function noteMoment(state: EconomyState, p: PlayerState, id: MomentId): void {
  p.record?.moments.push({ id, day: state.day });
}

export const momentCount = (record: SeasonRecord, id: MomentId): number => record.moments.filter((m) => m.id === id).length;

/** 밤에: 시즌 동안 가장 낮았던 순자산을 기억한다 (오뚝이) */
export function trackWorth(state: EconomyState, p: PlayerState): void {
  const r = p.record;
  if (r) r.minWorth = Math.min(r.minWorth, netWorth(state, p));
}

/** 증서에 인장을 찍는다. 의뢰 인장은 단계가 오르면 그 줄을 고친다 */
export function awardBadge(state: EconomyState, p: PlayerState, badge: string, tier: Tier | null, season = state.season?.number ?? 0): EarnedBadge | null {
  // 봇(떠돌이)은 인장을 받지 않는다 (0.2.0 9번)
  if (p.bot) return null;
  const c = p.certificate;
  const same = c.badges.find((b) => b.badge === badge && (tier === null ? true : b.season === season));
  if (same) {
    if (tier && same.tier && TIERS.indexOf(tier) > TIERS.indexOf(same.tier)) {
      same.tier = tier;
      same.day = state.day;
      return same;
    }
    return null;
  }
  const earned: EarnedBadge = { badge, tier, season, day: state.day };
  c.badges.push(earned);
  return earned;
}

/** 길드 의뢰가 잰 값 (이번 시즌, 로컬에서는 공동 의뢰도 내 기여만) */
export function questProgress(state: EconomyState, p: PlayerState, quest: QuestDef): number {
  const r = p.record;
  if (!r) return 0;
  const m = quest.measure;
  if (m.kind === 'moment') return momentCount(r, m.moment);
  return r.trades
    .filter((t) => t.side === 'sell' && m.goods.includes(t.good))
    .filter((t) => !m.seasons || m.seasons.includes(seasonOfDay(t.day, state.startSeason)))
    .filter((t) => !m.tier || state.towns[t.town]!.tier === m.tier)
    .reduce((s, t) => s + t.qty, 0);
}

/** 문턱을 넘은 가장 높은 단계 */
export function questTier(quest: QuestDef, value: number): Tier | null {
  let tier: Tier | null = null;
  quest.tiers.forEach((need, i) => {
    if (value >= need) tier = TIERS[i]!;
  });
  return tier;
}

/** 명령 뒤와 장날 뒤에: 업적 인장과 이번 시즌 테마의 개인 의뢰 인장을 찍는다. 새로 찍힌 인장을 돌려준다 */
export function checkBadges(state: EconomyState, p: PlayerState): EarnedBadge[] {
  const r = p.record;
  if (!r) return [];
  const out: EarnedBadge[] = [];
  const push = (e: EarnedBadge | null) => e && out.push(e);
  const worth = netWorth(state, p);
  for (const a of ACHIEVEMENTS) {
    // 업적은 언제 얻었든 한 번만
    if (p.certificate.badges.some((b) => b.badge === a.id)) continue;
    const ok =
      (a.moment && momentCount(r, a.moment.id) >= a.moment.count) ||
      (a.comeback && r.minWorth <= r.startWorth * ECONOMY.ranking.comebackBelow && worth >= r.startWorth) ||
      (a.rumorProfit && buyTheRumorProfit(state, r) > 0);
    if (ok) push(awardBadge(state, p, a.id, null));
  }
  const theme = themeDef(state.season?.theme ?? '');
  for (const q of theme?.quests ?? []) {
    // 공동 의뢰는 서버 전체 합으로 시즌 결산 때 (멀티플레이 버전)
    if (q.scope !== 'personal') continue;
    const tier = questTier(q, questProgress(state, p, q));
    if (tier) push(awardBadge(state, p, `quest-${q.id}`, tier));
  }
  return out;
}

/** 거래 기록 한 줄 (장날 정산 결과에서) */
export function tradeRecord(day: number, side: 'buy' | 'sell', town: number, good: GoodId, qty: number, price: number): TradeRecord {
  return { day, side, town, good, qty, price };
}
