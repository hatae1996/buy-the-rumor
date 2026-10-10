// 서버의 견습 세계와 졸업 (작업목록-0.2.0 7번)을 PGlite 위에서: game 함수로 시작 → 일곱 장면 → 졸업해 공유 세계에 들어가기
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Command } from '../../src/sim/economy';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { openWorld, seasonMap, SIM_VERSION, type WorldBlob } from '../../src/sim/service';
import { foundCompany, redeemInvite } from '../../src/server/account';
import type { Db } from '../../src/server/db';
import { commandFor, gameRequest, passDayFor, viewFor, type Screen } from '../../src/server/game';
import { tickDue } from '../../src/server/tick';
import { DAY_MS } from '../../src/server/schedule';
import { createTestDb } from '../db/pglite';
import { walkApprentice } from '../helpers/apprentice';

const SEASON = '2026-10-26';
const OPENS = Date.parse('2026-10-26T09:00:00+09:00');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let pg: PGlite;
let db: Db;

async function addWorld(id: string, humans = 0, bots = 11): Promise<void> {
  const blob: WorldBlob = openWorld(seasonMap(SEASON), { seasonId: SEASON, worldId: id, bots, warmupDays: 2 });
  await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, $2, $3, $4, $5::text::json, 1, $6)`, [
    SEASON,
    id,
    humans,
    bots,
    JSON.stringify(blob),
    SIM_VERSION,
  ]);
}

async function screen(uid: string): Promise<Screen> {
  const r = await viewFor(db, uid);
  if (!r.ok) throw new Error(r.error);
  return r.screen;
}

/** game 함수로 견습을 졸업 장면까지 */
function walk(uid: string) {
  return walkApprentice({
    cmd: async (c) => {
      const r = await commandFor(db, uid, c);
      if (!r.ok) throw new Error(r.error);
      return r.result;
    },
    view: async () => (await screen(uid)).view,
    passDay: async () => {
      const r = await passDayFor(db, uid);
      if (!r.ok) throw new Error(r.error);
    },
  });
}

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
  const look = createCertificate(5);
  for (const [id, name] of [
    [A, '소금 상단'],
    [B, '바람 상단'],
  ] as const) {
    await db.query('insert into auth.users (id) values ($1)', [id]);
    await redeemInvite(db, id, 'CODE2345');
    await foundCompany(db, id, { name, face: look.face, emblem: look.emblem });
  }
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

describe('견습 시작', () => {
  it('열린 시즌이 없거나 상단을 세우지 않았으면 못 한다', async () => {
    await db.query(`update public.seasons set status = 'ended'`);
    expect((await gameRequest(db, A, { action: 'startApprentice' })).body).toEqual({ ok: false, error: 'noSeason' });
    await db.query(`update public.seasons set status = 'open'`);
    await db.query('insert into auth.users (id) values ($1)', ['00000000-0000-0000-0000-00000000000c']);
    await redeemInvite(db, '00000000-0000-0000-0000-00000000000c', 'CODE2345');
    expect((await gameRequest(db, '00000000-0000-0000-0000-00000000000c', { action: 'startApprentice' })).body).toEqual({ ok: false, error: 'notFounded' });
  });

  it('시작하면 견습 세계의 첫 장면, 다시 눌러도 같은 견습', async () => {
    expect(await viewFor(db, A)).toEqual({ ok: false, error: 'noWorld' });
    const r = await gameRequest(db, A, { action: 'startApprentice' });
    expect(r.body).toMatchObject({ ok: true, screen: { place: 'apprentice', seasonId: SEASON, worldId: 'apprentice', view: { apprentice: { scene: 'start' } } } });
    await gameRequest(db, A, { action: 'startApprentice' });
    const rows = await db.query<{ n: number }>('select count(*)::int as n from public.apprentice_worlds');
    expect(rows[0]!.n).toBe(1);
    expect((await screen(A)).view.certificates).toBeDefined();
  });
});

describe('견습에서 졸업해 공유 세계로', () => {
  it('일곱 장면을 지나 졸업하면 사람이 가장 적은 세계에 들어가 길을 떠난다', async () => {
    await addWorld('w1', 1, 11);
    await addWorld('w2', 0, 11);
    await gameRequest(db, A, { action: 'startApprentice' });
    const destination = await walk(A);
    // 견습 명령은 세계 id 없이 기록된다
    const before = await db.query<{ n: number }>('select count(*)::int as n from public.commands where world_id is null');
    expect(before[0]!.n).toBeGreaterThan(5);

    const r = await commandFor(db, A, { type: 'travel', to: destination } as Command);
    expect(r.ok && r.result.ok).toBe(true);
    expect(r.ok && r.screen).toMatchObject({ place: 'world', worldId: 'w2' });
    expect(r.ok && r.screen.view.travel).toBeTruthy();
    // 표: 세계 사람 수, 들어온 날, 견습 졸업
    const [w] = await db.query<{ humans: number; rev: number }>(`select humans, rev::int as rev from public.worlds where id = 'w2'`);
    expect(w).toEqual({ humans: 1, rev: 1 });
    expect(await db.query(`select world_id, joined_day, seen_day from public.members where account_id = $1`, [A])).toEqual([
      { world_id: 'w2', joined_day: 1, seen_day: 1 },
    ]);
    const [ap] = await db.query<{ done: boolean }>(`select graduated_at is not null as done from public.apprentice_worlds where account_id = $1`, [A]);
    expect(ap!.done).toBe(true);
    const [last] = await db.query<{ world_id: string }>(`select world_id from public.commands order by id desc limit 1`);
    expect(last!.world_id).toBe('w2');

    // 이제 화면은 공유 세계, 하루 보내기는 없다
    expect((await screen(A)).place).toBe('world');
    expect(await passDayFor(db, A)).toEqual({ ok: false, error: 'notApprentice' });
    expect((await gameRequest(db, A, { action: 'startApprentice' })).body).toEqual({ ok: false, error: 'alreadyInWorld' });

    // 장날이 돌면 새 사람의 하루치 기록도 남는다
    await tickDue(db, { now: OPENS + DAY_MS + 60_000 });
    const reports = await db.query<{ day: number }>(`select day from public.day_reports where account_id = $1`, [A]);
    expect(reports).toEqual([{ day: 1 }]);
  });

  it('첫 장날 전에 세계가 모두 찼으면 새 세계를 연다', async () => {
    await addWorld('w1', 4, 11);
    await gameRequest(db, A, { action: 'startApprentice' });
    const destination = await walk(A);
    const r = await commandFor(db, A, { type: 'travel', to: destination } as Command);
    expect(r).toMatchObject({ ok: true, screen: { place: 'world', worldId: 'w2' } });
  });

  it('첫 장날 뒤에 세계가 모두 찼으면 졸업 장면에서 기다린다', async () => {
    await addWorld('w1', 4, 11);
    await db.query(`update public.worlds set day = 2`);
    await gameRequest(db, A, { action: 'startApprentice' });
    const destination = await walk(A);
    const r = await commandFor(db, A, { type: 'travel', to: destination } as Command);
    expect(r).toMatchObject({ ok: false, error: 'worldsFull', screen: { place: 'apprentice' } });
    expect((await screen(A)).view.apprentice?.scene).toBe('graduation');
    expect(await db.query('select * from public.members')).toEqual([]);
  });

  it('두 사람이 차례로 졸업하면 사람이 적은 세계부터 채운다', async () => {
    await addWorld('w1', 0, 11);
    await addWorld('w2', 0, 11);
    for (const uid of [A, B]) {
      await gameRequest(db, uid, { action: 'startApprentice' });
      const destination = await walk(uid);
      await commandFor(db, uid, { type: 'travel', to: destination } as Command);
    }
    const rows = await db.query<{ world_id: string }>(`select world_id from public.members order by world_id`);
    expect(rows.map((r) => r.world_id)).toEqual(['w1', 'w2']);
  });
});
