// 기록 표 (작업목록-0.2.0 12·13번, handoff 0.2.0 4번): 비공개 테스트에서 사람마다 한 줄, 상인 번호로(이메일 없이).
// 세계 상태(시작 마을, 첫 5일, 말·고용), 하루치 기록(순자산), 기록 사건(처음 흐름 시간, 접속), 명령 기록(시스템을 쓰는지)을 모은다.
import { getPlayer } from '../sim/economy';
import { dailyProfit, firstDays, monopoly, reliefRows, startGroup, type Monopoly, type ReliefRow, type StartGroup, type WorldBlob } from '../sim/service';
import type { Db } from './db';
import { mapFor } from './maps';
import { DAY_MS } from './schedule';
import { seasonOpensAt } from './season';

export interface MetricsRow {
  merchantNo: number;
  worldId: string;
  startGroup: StartGroup;
  joinedDay: number;
  /** 첫 5일 판 이익 (장날마다), 하루 평균 */
  first5Profit: number[];
  first5ProfitPerDay: number;
  /** 첫 5일 장날 뒤 순자산, 하루 증가 평균 */
  first5Worth: number[];
  first5WorthPerDay: number | null;
  /** 처음 흐름 (초): 시작 화면, 견습 시작 → 졸업(실제 시간), 졸업 → 첫 거래 체결 */
  foundingSec: number | null;
  apprenticeSec: number | null;
  firstTradeSec: number | null;
  /** 접속: 들어온 날 수, 하루 평균 접속 횟수와 머문 분(5분 신호로 어림), 마지막으로 들어온 때 */
  activeDays: number;
  sessionsPerDay: number;
  minutesPerDay: number;
  lastSeen: string | null;
  /** 시스템을 쓰는지 (성공한 명령만) */
  newspaperDays: number;
  rumorsNoted: number;
  rumorsDismissed: number;
  reservations: number;
  secondCaravan: boolean;
  boughtHorse: boolean;
  hired: boolean;
  /** 판 이익 합 (시즌 지금까지) */
  profitTotal: number;
}

export interface WorldMetrics {
  worldId: string;
  humans: number;
  bots: number;
  day: number;
  /** 독점 (답 92): 전체, 사람 기준 (답 133) */
  monopolyAll: Monopoly;
  monopolyHumans: Monopoly;
  /** 봄 구휼 (0.2.1, 답 139): 시즌에 난 것마다 */
  relief: ReliefRow[];
}

interface EventRow {
  account_id: string;
  kind: string;
  at_ms: number;
  kst_day: string;
}

const secBetween = (a: number | undefined, b: number | undefined) => (a !== undefined && b !== undefined && b >= a ? Math.round((b - a) / 1000) : null);

export async function metricsTable(db: Db, seasonId: string): Promise<{ rows: MetricsRow[]; worlds: WorldMetrics[] }> {
  const map = mapFor(seasonId);
  const opens = seasonOpensAt(seasonId);
  const worlds = await db.query<{ id: string; state: string; humans: number; bots: number }>(
    'select id, state::text as state, humans, bots from public.worlds where season_id = $1 order by id',
    [seasonId],
  );
  const members = await db.query<{ account_id: string; world_id: string; merchant_no: number; last_seen: string | null }>(
    `select m.account_id, m.world_id, a.merchant_no, to_char(a.last_seen_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as last_seen
       from public.members m join public.accounts a on a.id = m.account_id where m.season_id = $1 order by a.merchant_no`,
    [seasonId],
  );
  const reports = await db.query<{ account_id: string; day: number; worth: number | null }>(
    `select account_id, day, (report->>'worth')::float8 as worth from public.day_reports where season_id = $1`,
    [seasonId],
  );
  const events = await db.query<EventRow>(
    `select account_id, kind, (extract(epoch from at) * 1000)::float8 as at_ms, to_char(at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as kst_day
       from public.play_events where account_id in (select account_id from public.members where season_id = $1) order by at`,
    [seasonId],
  );
  const commands = await db.query<{ account_id: string; type: string; days: number; n: number }>(
    `select account_id, cmd->>'type' as type, count(distinct day)::int as days, count(*)::int as n
       from public.commands where season_id = $1 and error is null group by account_id, cmd->>'type'`,
    [seasonId],
  );

  const blobs = new Map(worlds.map((w) => [w.id, JSON.parse(w.state) as WorldBlob]));
  const rows: MetricsRow[] = [];
  for (const m of members) {
    const blob = blobs.get(m.world_id);
    const p = blob?.state.players[m.account_id];
    if (!blob || !p) continue;
    const worth = new Map(reports.filter((r) => r.account_id === m.account_id && r.worth !== null).map((r) => [r.day, r.worth!]));
    const f = firstDays(blob.state, m.account_id, worth);
    const ev = events.filter((e) => e.account_id === m.account_id);
    const first = (kind: string) => ev.find((e) => e.kind === kind)?.at_ms;
    const firstTradeDay = getPlayer(blob.state, m.account_id).ledger.find((e) => e.kind === 'buy' || e.kind === 'sell')?.day;
    const sessionDays = new Map<string, { sessions: number; beats: number }>();
    for (const e of ev) {
      if (e.kind !== 'session_start' && e.kind !== 'heartbeat') continue;
      const d = sessionDays.get(e.kst_day) ?? { sessions: 0, beats: 0 };
      if (e.kind === 'session_start') d.sessions++;
      else d.beats++;
      sessionDays.set(e.kst_day, d);
    }
    const days = Math.max(1, sessionDays.size);
    const cmd = (type: string) => commands.find((c) => c.account_id === m.account_id && c.type === type);
    rows.push({
      merchantNo: m.merchant_no,
      worldId: m.world_id,
      startGroup: startGroup(map, p.homeTown),
      joinedDay: p.record?.joinedDay ?? 1,
      first5Profit: f.profit,
      first5ProfitPerDay: f.profitPerDay,
      first5Worth: f.worth,
      first5WorthPerDay: f.worthPerDay,
      foundingSec: secBetween(first('founding_start'), first('founding_done')),
      apprenticeSec: secBetween(first('apprentice_start'), first('graduate')),
      firstTradeSec: firstTradeDay === undefined ? null : secBetween(first('graduate'), opens + firstTradeDay * DAY_MS),
      activeDays: sessionDays.size,
      sessionsPerDay: Math.round(([...sessionDays.values()].reduce((a, d) => a + d.sessions, 0) / days) * 10) / 10,
      minutesPerDay: Math.round(([...sessionDays.values()].reduce((a, d) => a + d.beats, 0) * 5) / days),
      lastSeen: m.last_seen,
      newspaperDays: cmd('buyNewspaper')?.days ?? 0,
      rumorsNoted: cmd('noteRumor')?.n ?? 0,
      rumorsDismissed: cmd('dismissRumor')?.n ?? 0,
      reservations: (cmd('reserveOrder')?.n ?? 0) + (cmd('reserveOnArrival')?.n ?? 0),
      secondCaravan: (cmd('formCaravan')?.n ?? 0) > 0,
      boughtHorse: p.ledger.some((e) => e.kind === 'horse' && e.what === 'buy'),
      hired: p.ledger.some((e) => e.kind === 'hire' && e.what === 'hire'),
      profitTotal: Math.round([...dailyProfit(p.ledger).values()].reduce((a, b) => a + b, 0)),
    });
  }
  const worldRows = worlds.map((w) => {
    const blob = blobs.get(w.id)!;
    return { worldId: w.id, humans: w.humans, bots: w.bots, day: blob.state.day, monopolyAll: monopoly(blob.state, false), monopolyHumans: monopoly(blob.state, true), relief: reliefRows(blob.state) };
  });
  return { rows, worlds: worldRows };
}

/** 기록 표를 CSV로 (관찰 화면에서 내려받기). 배열 칸은 "|"로 잇는다 */
export function metricsCsv(rows: readonly MetricsRow[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]!) as (keyof MetricsRow)[];
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('|') : v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\n');
}
