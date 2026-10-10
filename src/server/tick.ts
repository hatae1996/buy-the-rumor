// 하루 돌리기 (작업목록-0.2.0 3번). pg_cron이 몇 분마다 tick 함수를 부르면, 열린 시즌의 세계마다
// 열렸어야 할 장날까지 밀린 날을 돌린다. 늦거나 빠진 호출은 다음 호출이 따라잡는다(로컬의 catchUp과 같다).
// - 세계마다 트랜잭션 하나: 행을 잠그고(다른 tick이 잡고 있으면 건너뜀) 상태를 읽어 돌리고 다시 쓴다.
//   명령(5번)도 같은 행을 잠그므로, 장날이 도는 동안 온 명령은 장날이 끝난 뒤 다음 날 신청으로 들어간다.
// - 시뮬 버전이 다르면 상태를 건드리지 않고 세계를 멈추고 운영 로그에 남긴다 (handoff 0.2.0 3번).
// - 한 세계가 실패해도 다른 세계는 돈다.
import { SimVersionMismatch, tickWorld, type WorldBlob } from '../sim/service';
import type { WorldMap } from '../sim/worldgen';
import { ts, type Db } from './db';
import { mapFor } from './maps';
import { daysBehind } from './schedule';

export interface TickOptions {
  now: number;
  /** 한 세계를 한 번에 돌리는 최대 날 수. 오래 멈췄다 다시 돌 때 요청 하나의 CPU 한도를 넘지 않게 (나머지는 다음 호출) */
  maxDaysPerWorld?: number;
}

export interface WorldTick {
  seasonId: string;
  worldId: string;
  /** 돌리기 전과 뒤의 day (다음에 열 장날) */
  from: number;
  to: number;
  settled?: boolean;
  /** 멈췄거나 실패했으면 그 이유 */
  halted?: string;
  error?: string;
  /** 다른 호출이 잡고 있어 건너뜀 */
  busy?: boolean;
}

export interface TickSummary {
  worlds: WorldTick[];
  /** 모든 세계가 결산에 닿아 결산으로 넘긴 시즌 */
  settling: string[];
}

interface DueWorld {
  season_id: string;
  id: string;
  day: number;
  opens_ms: number;
}

export async function tickDue(db: Db, opt: TickOptions): Promise<TickSummary> {
  const maxDays = opt.maxDaysPerWorld ?? 20;
  const candidates = await db.query<DueWorld>(
    `select w.season_id, w.id, w.day, (extract(epoch from s.opens_at) * 1000)::float8 as opens_ms
       from public.worlds w join public.seasons s on s.id = w.season_id
      where s.status = 'open' and s.opens_at <= $1::timestamptz and w.halted is null and not w.settled
      order by w.season_id, w.id`,
    [ts(opt.now)],
  );
  const worlds: WorldTick[] = [];
  for (const w of candidates) {
    if (daysBehind(w.opens_ms, opt.now, w.day) === 0) continue;
    try {
      worlds.push(await tickOne(db, w, mapFor(w.season_id), opt.now, maxDays));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await log(db, 'error', '장날을 돌리다 실패했다', { seasonId: w.season_id, worldId: w.id, error });
      worlds.push({ seasonId: w.season_id, worldId: w.id, from: w.day, to: w.day, error });
    }
  }
  const settling = await settleSeasons(db, [...new Set(worlds.filter((w) => w.settled).map((w) => w.seasonId))]);
  return { worlds, settling };
}

async function tickOne(db: Db, w: DueWorld, map: WorldMap, now: number, maxDays: number): Promise<WorldTick> {
  return db.transaction(async (tx) => {
    const base = { seasonId: w.season_id, worldId: w.id };
    const [row] = await tx.query<{ state: string }>(
      `select state::text as state from public.worlds
        where season_id = $1 and id = $2 and halted is null and not settled
        for update skip locked`,
      [w.season_id, w.id],
    );
    if (!row) return { ...base, from: w.day, to: w.day, busy: true };
    const blob = JSON.parse(row.state) as WorldBlob;
    const from = blob.state.day;
    const due = Math.min(maxDays, daysBehind(w.opens_ms, now, from));
    const bots = new Set(blob.crew.map((b) => b.pid));
    const members = await tx.query<{ account_id: string }>('select account_id from public.members where season_id = $1 and world_id = $2', [
      w.season_id,
      w.id,
    ]);
    const scoreRows: unknown[] = [];
    const reports: unknown[] = [];
    try {
      for (let i = 0; i < due; i++) {
        const r = tickWorld(blob, map, members.map((m) => m.account_id));
        if (!r) break;
        const day = r.report.day;
        for (const s of r.rows) {
          scoreRows.push({ season_id: w.season_id, world_id: w.id, day, player_id: s.playerId, bot: bots.has(s.playerId), category: s.category, name: s.name, score: s.score });
        }
        // 사람마다 하루치 기록 (PlayerDigest): "자리를 비운 사이"를 마지막으로 본 날부터 모은다
        for (const [account_id, report] of Object.entries(r.digests)) reports.push({ season_id: w.season_id, account_id, day, report });
      }
    } catch (e) {
      if (!(e instanceof SimVersionMismatch)) throw e;
      // 상태는 건드리지 않았다 (tickWorld가 돌기 전에 버전을 본다). 세계를 멈추고 알린다
      await tx.query('update public.worlds set halted = $3 where season_id = $1 and id = $2', [w.season_id, w.id, e.message]);
      await log(tx, 'error', '시뮬 버전이 달라 장날을 멈췄다', { ...base, world: e.world, bundle: e.bundle });
      return { ...base, from, to: from, halted: e.message };
    }
    const settled = blob.state.settlement !== null;
    await tx.query(
      `update public.worlds
          set state = $3::text::json, day = $4, rev = rev + 1, last_tick_at = $5::timestamptz, settled = $6
        where season_id = $1 and id = $2`,
      [w.season_id, w.id, JSON.stringify(blob), blob.state.day, ts(now), settled],
    );
    if (scoreRows.length) {
      await tx.query('insert into public.score_rows select * from json_populate_recordset(null::public.score_rows, $1::text::json)', [JSON.stringify(scoreRows)]);
    }
    if (reports.length) {
      await tx.query('insert into public.day_reports select * from json_populate_recordset(null::public.day_reports, $1::text::json)', [JSON.stringify(reports)]);
    }
    return { ...base, from, to: blob.state.day, ...(settled ? { settled } : {}) };
  });
}

/** 세계가 모두 결산에 닿은 시즌을 결산으로 넘긴다 (결산 자체는 10번) */
async function settleSeasons(db: Db, seasonIds: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of seasonIds) {
    const rows = await db.query<{ id: string }>(
      `update public.seasons set status = 'settling'
        where id = $1 and status = 'open'
          and not exists (select 1 from public.worlds where season_id = $1 and not settled)
        returning id`,
      [id],
    );
    if (rows.length) {
      out.push(id);
      await log(db, 'info', '시즌의 모든 세계가 마지막 장날을 마쳤다', { seasonId: id });
    }
  }
  return out;
}

async function log(db: Db, level: 'info' | 'warn' | 'error', message: string, data: unknown): Promise<void> {
  await db.query('insert into public.ops_log (level, message, data) values ($1, $2, $3::text::json)', [level, message, JSON.stringify(data)]);
}
