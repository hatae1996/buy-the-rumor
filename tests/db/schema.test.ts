// supabase/migrations의 표를 PGlite(WASM Postgres)에 올려 검사한다 (작업목록-0.2.0 1번).
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './pglite';

const ALICE = '00000000-0000-0000-0000-00000000000a';
const BOB = '00000000-0000-0000-0000-00000000000b';

let db: PGlite;

/** 폰(로그인한 사람)으로 sql을 돌린다 */
async function asUser<T>(uid: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    return tx.query<T>(sql, params);
  });
}

beforeAll(async () => {
  db = (await createTestDb()).pg;
  await db.exec(`
    insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');
    insert into public.invite_codes (code, uses_left) values ('TEST-0001', 10);
    insert into public.accounts (id, invite_code) values ('${ALICE}', 'TEST-0001'), ('${BOB}', 'TEST-0001');
    insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version)
      values ('2026-10-26', 1, 'closed_test', '2026-10-26 09:00+09', '2026-11-09 09:00+09', 1);
    insert into public.worlds (season_id, id, state, day, sim_version) values ('2026-10-26', 'w1', '{"b":1,"a":2}', 1, 1);
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('서버 표', () => {
  it('상인 번호는 계정을 만든 순서', async () => {
    const r = await db.query<{ merchant_no: number }>('select merchant_no from public.accounts order by created_at, merchant_no');
    expect(r.rows.map((x) => x.merchant_no)).toEqual([1, 2]);
  });

  it('세계 상태는 json이라 키 순서가 그대로다', async () => {
    const r = await db.query<{ s: string }>(`select state::text as s from public.worlds where id = 'w1'`);
    expect(r.rows[0]!.s).toBe('{"b":1,"a":2}');
  });

  it('세계 하나에 사람과 봇을 합쳐 15명까지', async () => {
    await expect(db.exec(`update public.worlds set humans = 10, bots = 6 where id = 'w1'`)).rejects.toThrow();
    await db.exec(`update public.worlds set humans = 3, bots = 9 where id = 'w1'`);
  });

  it('같은 상단 이름(정규화한 꼴)은 한 사람만', async () => {
    await db.exec(`insert into public.certificates (account_id, name, name_key, cert) values ('${ALICE}', '소금 상단', '소금상단', '{}')`);
    await expect(
      db.exec(`insert into public.certificates (account_id, name, name_key, cert) values ('${BOB}', '소금  상단!', '소금상단', '{}')`),
    ).rejects.toThrow(/duplicate key/);
  });

  it('한 시즌에 세계 하나', async () => {
    await db.exec(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ('2026-10-26', 'w1', '${ALICE}', 1, 1)`);
    await expect(
      db.exec(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ('2026-10-26', 'w1', '${ALICE}', 2, 2)`),
    ).rejects.toThrow(/duplicate key/);
  });

  it('시즌 id는 여는 날 꼴', async () => {
    await expect(
      db.exec(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ('season1', 1, 'live', now(), now() + interval '14 days', 1)`),
    ).rejects.toThrow(/check/);
  });
});

describe('폰이 볼 수 있는 것 (RLS)', () => {
  it('세계 상태, 견습 세계, 증서, 초대 코드는 읽지 못한다', async () => {
    for (const t of ['worlds', 'apprentice_worlds', 'certificates', 'invite_codes', 'members', 'commands', 'feedback', 'play_events']) {
      const r = await asUser(ALICE, `select * from public.${t}`);
      expect(r.rows, t).toEqual([]);
    }
  });

  it('시즌 일정과 내 계정만 읽는다', async () => {
    expect((await asUser(ALICE, 'select id from public.seasons')).rows).toHaveLength(1);
    const me = await asUser<{ id: string }>(ALICE, 'select id from public.accounts');
    expect(me.rows.map((x) => x.id)).toEqual([ALICE]);
  });

  it('의견은 내 이름으로만 넣는다', async () => {
    await asUser(ALICE, `insert into public.feedback (body, screen, season_id, world_id, game_day) values ('장날이 헷갈려요', 'market', '2026-10-26', 'w1', 3)`);
    const saved = await db.query<{ account_id: string }>('select account_id from public.feedback');
    expect(saved.rows.map((x) => x.account_id)).toEqual([ALICE]);
    await expect(asUser(ALICE, `insert into public.feedback (account_id, body, screen) values ('${BOB}', '남의 이름', 'market')`)).rejects.toThrow(
      /row-level security/,
    );
  });

  it('빈 의견과 너무 긴 의견은 받지 않는다', async () => {
    await expect(asUser(ALICE, `insert into public.feedback (body, screen) values ('   ', 'market')`)).rejects.toThrow(/check/);
    await expect(asUser(ALICE, `insert into public.feedback (body, screen) values (repeat('가', 2001), 'market')`)).rejects.toThrow(/check/);
  });

  it('기록 사건은 정해진 종류만', async () => {
    await asUser(ALICE, `insert into public.play_events (kind, data) values ('heartbeat', '{"screen":"town"}')`);
    await expect(asUser(ALICE, `insert into public.play_events (kind) values ('cheat')`)).rejects.toThrow(/check/);
  });

  it('세계 상태와 증서는 고치지 못한다', async () => {
    await asUser(ALICE, `update public.worlds set day = 99`);
    await asUser(ALICE, `update public.certificates set name = '해킹'`);
    const w = await db.query<{ day: number }>(`select day from public.worlds where id = 'w1'`);
    const c = await db.query<{ name: string }>(`select name from public.certificates`);
    expect(w.rows[0]!.day).toBe(1);
    expect(c.rows[0]!.name).toBe('소금 상단');
  });
});
