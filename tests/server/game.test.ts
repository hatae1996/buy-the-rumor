// 명령 받기와 화면 데이터 (작업목록-0.2.0 5번)를 PGlite 위에서
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { commandWorld, openWorld, seasonMap, SIM_VERSION, stateHash, type WorldBlob } from '../../src/sim/service';
import { foundCompany, redeemInvite } from '../../src/server/account';
import type { Db } from '../../src/server/db';
import { commandFor, gameRequest, viewFor } from '../../src/server/game';
import { createTestDb } from '../db/pglite';

const SEASON = '2026-10-26';
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let pg: PGlite;
let db: Db;
let opened: WorldBlob;

async function stored(): Promise<{ blob: WorldBlob; rev: number }> {
  const [r] = await db.query<{ state: string; rev: number }>(`select state::text as state, rev::int as rev from public.worlds where id = 'w1'`);
  return { blob: JSON.parse(r!.state) as WorldBlob, rev: r!.rev };
}

async function commands(): Promise<{ cmd: { type: string }; error: string | null; day: number }[]> {
  return db.query(`select cmd, error, day from public.commands order by id`);
}

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
  for (const id of [A, B]) {
    await db.query('insert into auth.users (id) values ($1)', [id]);
    await redeemInvite(db, id, 'CODE2345');
  }
  const look = createCertificate(5);
  await foundCompany(db, A, { name: '소금 상단', face: look.face, emblem: look.emblem });
  await foundCompany(db, B, { name: '바람 상단', face: look.face, emblem: look.emblem });
  await db.query(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, 1, 'closed_test', now(), now() + interval '14 days', $2)`, [
    SEASON,
    SIM_VERSION,
  ]);
  opened = openWorld(seasonMap(SEASON), {
    seasonId: SEASON,
    worldId: 'w1',
    humans: [{ id: A, name: '소금 상단', merchantNo: 1, apprentice: false, face: look.face, emblem: look.emblem }],
    bots: 11,
    warmupDays: 2,
  });
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

describe('화면 데이터', () => {
  it('세계에 든 사람은 자기가 아는 것을 받는다', async () => {
    const r = await viewFor(db, A);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.screen).toMatchObject({ seasonId: SEASON, worldId: 'w1', halted: null });
    expect(r.screen.view.day).toBe(1);
    // 숨은 숫자(세계 상태)는 보내지 않는다
    expect(JSON.stringify(r.screen)).not.toContain('"workers"');
  });

  it('세계가 없는 사람은 noWorld (견습 중이거나 배정 기다림)', async () => {
    expect(await viewFor(db, B)).toEqual({ ok: false, error: 'noWorld' });
    expect(await commandFor(db, B, { type: 'readNews' })).toEqual({ ok: false, error: 'noWorld' });
  });
});

describe('명령', () => {
  it('성공한 명령은 저장하고 기록을 남기고 새 화면을 준다 (로컬에서 같은 명령을 낸 것과 같은 상태)', async () => {
    const cmd = { type: 'setNotify', dailyCap: 3 } as const;
    const r = await commandFor(db, A, cmd);
    expect(r.ok && r.result.ok).toBe(true);
    const s = await stored();
    expect(s.rev).toBe(1);
    const local = structuredClone(opened);
    commandWorld(local, seasonMap(SEASON), A, cmd);
    expect(stateHash(s.blob)).toBe(stateHash(local));
    expect(await commands()).toEqual([{ cmd, error: null, day: 1 }]);
  });

  it('실패한 명령은 상태를 건드리지 않고 이유만 남긴다', async () => {
    const r = await commandFor(db, A, { type: 'placeSellOrder', good: 'salt', qty: 999, minPrice: 1 });
    expect(r.ok && r.result).toMatchObject({ ok: false });
    const s = await stored();
    expect(s.rev).toBe(0);
    expect(stateHash(s.blob)).toBe(stateHash(opened));
    const [log] = await commands();
    expect(log!.error).toBeTruthy();
  });

  it('모르는 명령은 시뮬이 badCommand, 명령 모양이 아니면 400', async () => {
    const r = await commandFor(db, A, { type: 'giveMeGold', qty: 1e9 });
    expect(r.ok && r.result).toEqual({ ok: false, error: 'badCommand' });
    expect((await gameRequest(db, A, { action: 'command', cmd: 'x' })).status).toBe(400);
    expect((await gameRequest(db, A, { action: 'command', cmd: { type: 'readNews', junk: 'x'.repeat(30_000) } })).status).toBe(400);
    expect((await gameRequest(db, A, { action: 'nope' })).status).toBe(400);
    expect((await stored()).rev).toBe(0);
  });

  it('멈춘 세계는 화면만 보이고 명령은 받지 않는다', async () => {
    await db.query(`update public.worlds set halted = '시뮬 버전이 다르다'`);
    const v = await viewFor(db, A);
    expect(v.ok && v.screen.halted).toBe('시뮬 버전이 다르다');
    const r = await commandFor(db, A, { type: 'setNotify', dailyCap: 3 });
    expect(r).toMatchObject({ ok: false, error: 'worldHalted' });
    expect((await stored()).rev).toBe(0);
  });

  it('얼굴·문장을 바꾸면 증서 표에도 옮긴다', async () => {
    const other = createCertificate(99);
    const r = await commandFor(db, A, { type: 'setEmblem', emblem: other.emblem });
    expect(r.ok && r.result.ok).toBe(true);
    const [c] = await db.query<{ cert: { emblem: unknown } }>(`select cert from public.certificates where account_id = $1`, [A]);
    expect(c!.cert.emblem).toEqual(other.emblem);
  });

  it('말 이름의 금칙어, 시즌 중 상단 이름 바꾸기는 막는다', async () => {
    expect(await commandFor(db, A, { type: 'nameHorse', horseId: 1, name: '씨 발' })).toMatchObject({ ok: false, error: 'bannedName' });
    // 남의 이름은 시즌 사이에도 안 된다
    expect(await commandFor(db, A, { type: 'setCompany', name: '바람상단' })).toMatchObject({ ok: false, error: 'nameTaken' });
    // 시즌 중에는 시뮬이 막는다
    const r = await commandFor(db, A, { type: 'setCompany', name: '새 이름 상단' });
    expect(r.ok && r.result).toEqual({ ok: false, error: 'nameLocked' });
    expect((await commands()).map((x) => x.error)).toEqual(['bannedName', 'nameTaken', 'nameLocked']);
  });
});
