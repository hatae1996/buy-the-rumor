// 하루 돌리기 (작업목록-0.2.0 3번)를 PGlite 위에서
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openWorld, seasonMap, SIM_VERSION, stateHash, tickWorld, type WorldBlob } from '../../src/sim/service';
import type { Db } from '../../src/server/db';
import { DAY_MS, daysBehind, marketsDue } from '../../src/server/schedule';
import { tickDue } from '../../src/server/tick';
import { DAY_MS as LOCAL_DAY_MS } from '../../src/ui/game';
import { addAccount, createTestDb } from '../db/pglite';

const SEASON = '2026-10-26';
// 2026-10-26 월요일 아침 9시 (한국 시간)
const OPENS = Date.parse('2026-10-26T09:00:00+09:00');
const HUMAN = '00000000-0000-0000-0000-00000000000a';

let pg: PGlite;
let db: Db;

function blobFor(worldId: string, humans = [HUMAN]): WorldBlob {
  return openWorld(seasonMap(SEASON), {
    seasonId: SEASON,
    worldId,
    humans: humans.map((id, i) => ({ id, name: `시험 상단 ${i + 1}`, merchantNo: i + 1, apprentice: false })),
    bots: 11,
    warmupDays: 2,
  });
}

async function addWorld(worldId: string, blob: WorldBlob, humans = [HUMAN]): Promise<void> {
  await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, $2, $3, $4, $5::json, $6, $7)`, [
    SEASON,
    worldId,
    humans.length,
    blob.crew.length,
    JSON.stringify(blob),
    blob.state.day,
    blob.simVersion,
  ]);
  for (const id of humans) {
    await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, $2, $3, 1, 1)`, [SEASON, worldId, id]);
  }
}

async function stored(worldId: string): Promise<{ blob: WorldBlob; day: number; rev: number; halted: string | null; settled: boolean }> {
  const [r] = await db.query<{ state: string; day: number; rev: number; halted: string | null; settled: boolean }>(
    `select state::text as state, day, rev::int as rev, halted, settled from public.worlds where season_id = $1 and id = $2`,
    [SEASON, worldId],
  );
  return { ...r!, blob: JSON.parse(r!.state) as WorldBlob };
}

const at = (markets: number) => OPENS + markets * DAY_MS + 60_000;

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  await addAccount(db, HUMAN);
  await db.query(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, 1, 'closed_test', $2, $3, $4)`, [
    SEASON,
    new Date(OPENS).toISOString(),
    new Date(OPENS + 14 * 24 * 3600_000).toISOString(),
    SIM_VERSION,
  ]);
}, 60_000);

afterEach(async () => {
  await pg.close();
});

describe('장날 시각', () => {
  it('로컬과 같은 하루 길이', () => {
    expect(DAY_MS).toBe(LOCAL_DAY_MS);
  });

  it('첫 장날은 여는 때 + 2시간 30분, 시즌 13일이면 장날 124번', () => {
    expect(marketsDue(OPENS, OPENS - 1)).toBe(0);
    expect(marketsDue(OPENS, OPENS + DAY_MS - 1)).toBe(0);
    expect(marketsDue(OPENS, OPENS + DAY_MS)).toBe(1);
    expect(marketsDue(OPENS, OPENS + 13 * 24 * 3600_000)).toBe(124);
    // 1일째 세계(장날 0번 연 것)가 장날 3번 뒤에 돌릴 날
    expect(daysBehind(OPENS, at(3), 1)).toBe(3);
    expect(daysBehind(OPENS, at(3), 4)).toBe(0);
  });
});

describe('tick', () => {
  it('시즌이 열리기 전에는 돌리지 않는다', async () => {
    await addWorld('w1', blobFor('w1'));
    const r = await tickDue(db, { now: OPENS - 3600_000 });
    expect(r.worlds).toEqual([]);
    expect((await stored('w1')).day).toBe(1);
  });

  it('밀린 장날만큼 돌리고 점수 줄과 사람의 그날 요약을 남긴다', async () => {
    const blob = blobFor('w1');
    const local = structuredClone(blob);
    await addWorld('w1', blob);
    const r = await tickDue(db, { now: at(3) });
    expect(r.worlds).toEqual([{ seasonId: SEASON, worldId: 'w1', from: 1, to: 4 }]);
    const s = await stored('w1');
    expect(s.day).toBe(4);
    expect(s.rev).toBe(1);
    // 로컬에서 같은 세계를 3일 돌린 것과 같다
    const map = seasonMap(SEASON);
    for (let i = 0; i < 3; i++) tickWorld(local, map);
    expect(stateHash(s.blob)).toBe(stateHash(local));
    const days = await db.query<{ day: number }>(`select distinct day from public.score_rows order by day`);
    expect(days.map((d) => d.day)).toEqual([1, 2, 3]);
    const bots = await db.query<{ n: number }>(`select count(*)::int as n from public.score_rows where bot`);
    const humans = await db.query<{ player_id: string }>(`select distinct player_id from public.score_rows where not bot`);
    expect(bots[0]!.n).toBeGreaterThan(0);
    expect(humans.every((h) => h.player_id === HUMAN)).toBe(true);
    const reports = await db.query<{ day: number; report: { stamped: number } }>(`select day, report from public.day_reports order by day`);
    expect(reports.map((x) => x.day)).toEqual([1, 2, 3]);
    expect(typeof reports[0]!.report.stamped).toBe('number');
  });

  it('같은 때에 다시 불러도 더 돌리지 않는다', async () => {
    await addWorld('w1', blobFor('w1'));
    await tickDue(db, { now: at(2) });
    const r = await tickDue(db, { now: at(2) });
    expect(r.worlds).toEqual([]);
    expect((await stored('w1')).day).toBe(3);
  });

  it('오래 멈췄으면 한 번에 정한 날까지만, 나머지는 다음 호출에', async () => {
    await addWorld('w1', blobFor('w1'));
    await tickDue(db, { now: at(12), maxDaysPerWorld: 5 });
    expect((await stored('w1')).day).toBe(6);
    await tickDue(db, { now: at(12), maxDaysPerWorld: 5 });
    await tickDue(db, { now: at(12), maxDaysPerWorld: 5 });
    expect((await stored('w1')).day).toBe(13);
  });

  it('세계마다 따로 돈다', async () => {
    await addAccount(db, '00000000-0000-0000-0000-00000000000b');
    await addWorld('w1', blobFor('w1'));
    await addWorld('w2', blobFor('w2', ['00000000-0000-0000-0000-00000000000b']), ['00000000-0000-0000-0000-00000000000b']);
    const r = await tickDue(db, { now: at(1) });
    expect(r.worlds.map((w) => [w.worldId, w.to])).toEqual([
      ['w1', 2],
      ['w2', 2],
    ]);
  });

  it('시뮬 버전이 다르면 상태를 건드리지 않고 멈추고 운영 로그에 남긴다', async () => {
    const blob = blobFor('w1');
    blob.simVersion = SIM_VERSION + 1;
    await addWorld('w1', blob);
    const before = stateHash((await stored('w1')).blob);
    const r = await tickDue(db, { now: at(2) });
    expect(r.worlds[0]!.halted).toMatch(/시뮬 버전/);
    const s = await stored('w1');
    expect(s.halted).toMatch(/시뮬 버전/);
    expect(stateHash(s.blob)).toBe(before);
    expect(s.day).toBe(1);
    const log = await db.query<{ level: string }>(`select level from public.ops_log`);
    expect(log.map((l) => l.level)).toEqual(['error']);
    // 멈춘 세계는 다음 호출에서도 돌리지 않는다
    expect((await tickDue(db, { now: at(3) })).worlds).toEqual([]);
  });

  it('상태가 깨진 세계는 실패로 적고, 다른 세계는 돈다', async () => {
    await addAccount(db, '00000000-0000-0000-0000-00000000000b');
    await addWorld('w1', blobFor('w1'));
    await addWorld('w2', blobFor('w2', ['00000000-0000-0000-0000-00000000000b']), ['00000000-0000-0000-0000-00000000000b']);
    await db.query(`update public.worlds set state = '{"simVersion":${SIM_VERSION},"state":{"day":1},"crew":[]}'::json where id = 'w1'`);
    const r = await tickDue(db, { now: at(1) });
    expect(r.worlds.find((w) => w.worldId === 'w1')!.error).toBeTruthy();
    expect(r.worlds.find((w) => w.worldId === 'w2')!.to).toBe(2);
    expect((await stored('w1')).rev).toBe(0);
    const log = await db.query<{ message: string }>(`select message from public.ops_log`);
    expect(log).toHaveLength(1);
  });

  it('모든 세계가 마지막 장날을 마치면 시즌을 결산으로 넘긴다', async () => {
    await addAccount(db, '00000000-0000-0000-0000-00000000000b');
    for (const [w, h] of [
      ['w1', HUMAN],
      ['w2', '00000000-0000-0000-0000-00000000000b'],
    ] as const) {
      const blob = blobFor(w, [h]);
      blob.state.season!.length = 3;
      await addWorld(w, blob, [h]);
    }
    const r = await tickDue(db, { now: at(10) });
    expect(r.worlds.every((w) => w.settled)).toBe(true);
    expect(r.settling).toEqual([SEASON]);
    const [season] = await db.query<{ status: string }>(`select status from public.seasons where id = $1`, [SEASON]);
    expect(season!.status).toBe('settling');
    // 결산 뒤에는 돌리지 않는다
    expect((await tickDue(db, { now: at(20) })).worlds).toEqual([]);
  });
});
