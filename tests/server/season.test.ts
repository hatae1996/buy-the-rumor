// 시즌 열기, 세계 배정, 봇으로 12명 채우기 (작업목록-0.2.0 8번)를 PGlite 위에서
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { joinPlayer, playerList } from '../../src/sim/economy';
import { fillBots, seasonMap, SIM_VERSION, stateHash, type WorldBlob } from '../../src/sim/service';
import type { Db } from '../../src/server/db';
import { DAY_MS } from '../../src/server/schedule';
import { JOIN_LAST_DAY, openSeason, pickWorld, seasonOpensAt } from '../../src/server/season';
import { tickDue } from '../../src/server/tick';
import { createTestDb } from '../db/pglite';

const SEASON = '2026-10-26'; // 월요일
let pg: PGlite;
let db: Db;

async function world(id: string): Promise<{ blob: WorldBlob; humans: number; bots: number; day: number }> {
  const [r] = await db.query<{ state: string; humans: number; bots: number; day: number }>(
    'select state::text as state, humans, bots, day from public.worlds where season_id = $1 and id = $2',
    [SEASON, id],
  );
  return { ...r!, blob: JSON.parse(r!.state) as WorldBlob };
}

/** 세계에 사람 n명을 바로 앉힌다 (견습 없이, 표의 사람 수도) */
async function seatHumans(id: string, n: number, from = 0): Promise<void> {
  const w = await world(id);
  for (let i = 0; i < n; i++) {
    const uid = `00000000-0000-0000-0000-${String(from + i + 1).padStart(12, '0')}`;
    await db.query('insert into auth.users (id) values ($1) on conflict do nothing', [uid]);
    await db.query('insert into public.accounts (id) values ($1) on conflict do nothing', [uid]);
    joinPlayer(w.blob.state, { id: uid, name: `사람 ${from + i + 1} 상단`, apprentice: false }, null);
    await db.query('insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, $2, $3, 1, 1)', [SEASON, id, uid]);
  }
  await db.query('update public.worlds set state = $3::text::json, humans = humans + $4 where season_id = $1 and id = $2', [SEASON, id, JSON.stringify(w.blob), n]);
}

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
}, 60_000);

afterEach(async () => {
  await pg.close();
});

describe('시즌 열기', () => {
  it('격주 월요일 아침 9시(한국 시간)에 2주, 빈 세계를 미리 n개', async () => {
    const r = await openSeason(db, { id: SEASON, kind: 'closed_test', worlds: 2 });
    expect(r).toEqual({ ok: true, seasonId: SEASON, worlds: ['w1', 'w2'] });
    const [s] = await db.query<{ opens: string; ends: string; status: string; sim_version: number }>(
      `select to_char(opens_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as opens, to_char(ends_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as ends, status, sim_version from public.seasons`,
    );
    expect(s).toEqual({ opens: '2026-10-26 09:00', ends: '2026-11-09 09:00', status: 'open', sim_version: SIM_VERSION });
    expect(seasonOpensAt(SEASON)).toBe(Date.parse('2026-10-26T00:00:00Z'));
    const w1 = await world('w1');
    const w2 = await world('w2');
    expect([w1.humans, w1.bots, w1.day]).toEqual([0, 0, 1]);
    expect(playerList(w1.blob.state)).toEqual([]);
    expect(w1.blob.state.towns).toHaveLength(6);
    // 같은 시즌의 세계는 세계 id만 다르다
    const a = JSON.stringify(w1.blob);
    expect(stateHash(JSON.parse(JSON.stringify(w2.blob).replaceAll('"worldId":"w2"', '"worldId":"w1"')))).toBe(stateHash(JSON.parse(a)));
  });

  it('여는 날 모양, 월요일(예행연습은 아무 날), 이미 있는 시즌, 세계 수', async () => {
    expect(await openSeason(db, { id: '2026-10-27', kind: 'closed_test', worlds: 2 })).toEqual({ ok: false, error: 'notMonday' });
    expect(await openSeason(db, { id: '10/26', kind: 'live', worlds: 2 })).toEqual({ ok: false, error: 'badSeasonId' });
    expect(await openSeason(db, { id: SEASON, kind: 'live', worlds: 0 })).toEqual({ ok: false, error: 'badWorldCount' });
    expect((await openSeason(db, { id: '2026-10-29', kind: 'rehearsal', worlds: 1 })).ok).toBe(true);
    await openSeason(db, { id: SEASON, kind: 'live', worlds: 1 });
    expect(await openSeason(db, { id: SEASON, kind: 'live', worlds: 1 })).toEqual({ ok: false, error: 'seasonExists' });
  });
});

describe('들어갈 세계 고르기', () => {
  beforeEach(async () => {
    await openSeason(db, { id: SEASON, kind: 'closed_test', worlds: 2 });
  });

  const pick = () => db.transaction((tx) => pickWorld(tx, SEASON));

  it('첫 장날 전: 사람이 가장 적은 세계부터, 모두 15명이면 새 세계', async () => {
    expect(await pick()).toEqual({ ok: true, worldId: 'w1' });
    await seatHumans('w1', 1);
    expect(await pick()).toEqual({ ok: true, worldId: 'w2' });
    await seatHumans('w2', 15, 100);
    await seatHumans('w1', 14, 200);
    expect(await pick()).toEqual({ ok: true, worldId: 'w3' });
    const w3 = await world('w3');
    expect(w3.day).toBe(1);
    expect(w3.blob.state.world.worldId).toBe('w3');
  });

  it('첫 장날 뒤: 자리가 남은 세계에만, 모두 찼으면 다음 시즌', async () => {
    await seatHumans('w1', 15);
    await db.query(`update public.worlds set day = 5`);
    expect(await pick()).toEqual({ ok: true, worldId: 'w2' });
    await seatHumans('w2', 15, 100);
    expect(await pick()).toEqual({ ok: false, error: 'worldsFull' });
    expect((await db.query('select id from public.worlds')).length).toBe(2);
  });

  it('들어올 수 있는 마지막 날이 지나면 다음 시즌 (실제 10일째 = 장날 96번)', async () => {
    expect(JOIN_LAST_DAY).toBe(96);
    await db.query(`update public.worlds set day = $1`, [JOIN_LAST_DAY]);
    expect((await pick()).ok).toBe(true);
    await db.query(`update public.worlds set day = $1`, [JOIN_LAST_DAY + 1]);
    expect(await pick()).toEqual({ ok: false, error: 'seasonClosed' });
  });

  it('멈춘 세계, 끝난 세계에는 넣지 않는다', async () => {
    await db.query(`update public.worlds set halted = '시험' where id = 'w1'`);
    expect(await pick()).toEqual({ ok: true, worldId: 'w2' });
    await db.query(`update public.worlds set settled = true where id = 'w2'`);
    expect(await pick()).toEqual({ ok: true, worldId: 'w3' });
  });
});

describe('봇으로 12명 채우기 (첫 장날 직전)', () => {
  const opens = seasonOpensAt(SEASON);

  beforeEach(async () => {
    await openSeason(db, { id: SEASON, kind: 'closed_test', worlds: 2 });
  });

  it('사람이 12명이 안 되는 세계만 12명까지, 봇은 번호 없이 사람과 다른 이름', async () => {
    await seatHumans('w1', 3);
    await seatHumans('w2', 13, 100);
    await tickDue(db, { now: opens + DAY_MS + 60_000 });
    const w1 = await world('w1');
    const w2 = await world('w2');
    expect([w1.humans, w1.bots, w1.day]).toEqual([3, 9, 2]);
    expect([w2.humans, w2.bots, w2.day]).toEqual([13, 0, 2]);
    const bots = playerList(w1.blob.state).filter((p) => p.id.startsWith('bot'));
    expect(bots).toHaveLength(9);
    expect(bots.every((b) => b.certificate.merchantNo === null && b.cart.type === 'handcart')).toBe(true);
    const names = playerList(w1.blob.state).map((p) => p.certificate.name);
    expect(new Set(names).size).toBe(names.length);
    expect(w1.blob.crew.map((c) => c.pid)).toEqual(bots.map((b) => b.id));
  });

  it('봇은 시즌 중에 빠지지도 다시 채우지도 않는다', async () => {
    await seatHumans('w1', 2);
    await tickDue(db, { now: opens + DAY_MS + 60_000 });
    expect((await world('w1')).bots).toBe(10);
    await seatHumans('w1', 2, 100);
    await tickDue(db, { now: opens + 5 * DAY_MS + 60_000 });
    const w1 = await world('w1');
    expect([w1.humans, w1.bots]).toEqual([4, 10]);
  });

  it('사람이 없는 세계도 12명이 되도록 (빈 세계는 봇 12)', async () => {
    await tickDue(db, { now: opens + DAY_MS + 60_000 });
    expect((await world('w2')).bots).toBe(12);
  });

  it('시뮬: 이미 봇이 있으면 다시 채우지 않고, 같은 세계면 같은 봇', async () => {
    const map = seasonMap(SEASON);
    const fresh = JSON.stringify((await world('w1')).blob);
    const a = JSON.parse(fresh) as WorldBlob;
    const b = JSON.parse(fresh) as WorldBlob;
    expect(fillBots(a, map)).toBe(12);
    expect(fillBots(a, map)).toBe(0);
    fillBots(b, map);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
