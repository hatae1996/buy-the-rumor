// 자리를 비운 사이와 화면 안 알림 (작업목록-0.2.0 6번)을 PGlite 위에서
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPlayer } from '../../src/sim/economy';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { awaySummary, commandWorld, openWorld, seasonMap, SIM_VERSION, tickWorld, type PlayerDigest, type WorldBlob } from '../../src/sim/service';
import { foundCompany, redeemInvite } from '../../src/server/account';
import type { Db } from '../../src/server/db';
import { markSeen, viewFor } from '../../src/server/game';
import { DAY_MS, kstHour } from '../../src/server/schedule';
import { tickDue } from '../../src/server/tick';
import { createTestDb } from '../db/pglite';

const SEASON = '2026-10-26';
const OPENS = Date.parse('2026-10-26T09:00:00+09:00');
const A = '00000000-0000-0000-0000-00000000000a';
const at = (markets: number) => OPENS + markets * DAY_MS + 60_000;

let pg: PGlite;
let db: Db;
let opened: WorldBlob;

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
  await db.query('insert into auth.users (id) values ($1)', [A]);
  await redeemInvite(db, A, 'CODE2345');
  const look = createCertificate(5);
  await foundCompany(db, A, { name: '소금 상단', face: look.face, emblem: look.emblem });
  await db.query(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, 1, 'closed_test', $2, $3, $4)`, [
    SEASON,
    new Date(OPENS).toISOString(),
    new Date(OPENS + 14 * 24 * 3600_000).toISOString(),
    SIM_VERSION,
  ]);
  const map = seasonMap(SEASON);
  opened = openWorld(map, { seasonId: SEASON, worldId: 'w1', humans: [{ id: A, name: '소금 상단', merchantNo: 1, apprentice: false }], bots: 11, warmupDays: 2 });
  // 내 명령이 든 채로 장날을 맞는다 (요약이 로컬과 같은지 볼 때 내 장부·신청도 같이 비교되게)
  commandWorld(opened, map, A, { type: 'placeBuyOrder', good: 'grain', qty: 1, maxPrice: 40 });
  await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, 'w1', 1, 11, $2::text::json, 1, $3)`, [
    SEASON,
    JSON.stringify(opened),
    SIM_VERSION,
  ]);
  await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, 'w1', $2, 1, 1)`, [SEASON, A]);
}, 60_000);

afterEach(async () => {
  await pg.close();
});

/** 로컬에서 같은 세계를 n일 돌린 요약 */
function localAway(days: number) {
  const local = structuredClone(opened);
  const map = seasonMap(SEASON);
  const digests: PlayerDigest[] = [];
  for (let i = 0; i < days; i++) digests.push(tickWorld(local, map, [A])!.digests[A]!);
  return awaySummary(local.state, map, A, digests, 1);
}

describe('자리를 비운 사이', () => {
  it('장날이 지나지 않았으면 없다', async () => {
    const r = await viewFor(db, A, at(0));
    expect(r.ok && r.away).toBeNull();
  });

  it('밀린 장날의 요약은 로컬 게임에서 같은 날을 돌린 요약과 같다', async () => {
    await tickDue(db, { now: at(3) });
    const r = await viewFor(db, A, at(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const local = localAway(3);
    expect(r.away!.summary).toEqual(local);
    expect(r.away!.summary).toMatchObject({ days: 3, fromDay: 1, toDay: 4 });
  });

  it('tick 여러 번에 걸친 날도 한 번에 모은다', async () => {
    await tickDue(db, { now: at(12), maxDaysPerWorld: 5 });
    await tickDue(db, { now: at(12), maxDaysPerWorld: 5 });
    await tickDue(db, { now: at(12), maxDaysPerWorld: 5 });
    const r = await viewFor(db, A, at(12));
    expect(r.ok && r.away!.summary).toEqual(localAway(12));
  });

  it('보여 준 뒤 본 날을 올리면 다음에는 그 뒤만', async () => {
    await tickDue(db, { now: at(3) });
    expect(await markSeen(db, A, 4)).toEqual({ ok: true, seenDay: 4 });
    const r = await viewFor(db, A, at(3));
    expect(r.ok && r.away).toBeNull();
    await tickDue(db, { now: at(5) });
    const r2 = await viewFor(db, A, at(5));
    expect(r2.ok && r2.away!.summary).toMatchObject({ days: 2, fromDay: 4, toDay: 6 });
  });

  it('본 날은 세계의 오늘을 넘지 않고 내려가지 않는다', async () => {
    await tickDue(db, { now: at(3) });
    expect(await markSeen(db, A, 99)).toEqual({ ok: true, seenDay: 4 });
    expect(await markSeen(db, A, 2)).toEqual({ ok: true, seenDay: 4 });
    expect(await markSeen(db, A, 'x')).toEqual({ ok: false, error: 'badRequest' });
  });
});

describe('화면 안 알림 (한국 시간)', () => {
  it('한국 시간으로 몇 시인가', () => {
    expect(kstHour(Date.parse('2026-10-26T09:00:00+09:00'))).toBe(9);
    expect(kstHour(Date.parse('2026-10-26T23:30:00+09:00'))).toBe(23);
    expect(kstHour(Date.parse('2026-10-27T02:00:00+09:00'))).toBe(2);
  });

  it('낮에는 띠로, 조용한 시간(밤 11시~아침 8시)에는 띠 없이 요약에만', async () => {
    await tickDue(db, { now: at(3) });
    // 장날 결과 알림 하나를 하루치 기록에 넣어 둔다 (시장 체결과 상관없이 알림 나누기만 본다)
    const notice = { kind: 'market', day: 2, text: '장날 결과: 곡물 1개 삼 (개당 30)', target: { tab: 'ledger' } };
    await db.query(
      `update public.day_reports set report = json_build_object('day', day, 'heard', '[]'::json, 'stamped', 0, 'notices', json_build_array($1::text::json), 'ledger', '[]'::json, 'arrivedAt', null) where day = 2`,
      [JSON.stringify(notice)],
    );
    const quiet = getPlayer(opened.state, A).notify;
    expect([quiet.quietStart, quiet.quietEnd]).toEqual([23, 8]);
    const day = await viewFor(db, A, Date.parse('2026-10-26T18:00:00+09:00'));
    expect(day.ok && day.away!.summary.notices).toContainEqual(notice);
    expect(day.ok && day.away!.delivery.send).toEqual([expect.objectContaining({ kind: 'market', body: notice.text })]);
    expect(day.ok && day.away!.delivery.later).toEqual([]);
    const night = await viewFor(db, A, Date.parse('2026-10-27T02:00:00+09:00'));
    expect(night.ok && night.away!.delivery.send).toEqual([]);
    expect(night.ok && night.away!.delivery.later).toContainEqual(notice);
  });
});
