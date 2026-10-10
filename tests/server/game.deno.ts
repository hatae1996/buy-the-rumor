// Edge Function game을 Deno로 띄워 로그인 → 화면 데이터 → 명령 → 저장·기록까지 끝까지 (작업목록-0.2.0 5번)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { openWorld, seasonMap, SIM_VERSION } from '../../src/sim/service';
import { foundCompany, redeemInvite } from '../../src/server/account';
import { startFunction, type Harness } from './denoHarness';

const SEASON = '2026-10-26';
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let h: Harness;

beforeAll(async () => {
  h = await startFunction('game', {
    dbPort: 54331,
    fnPort: 8002,
    serve: true,
    seed: async (db) => {
      await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
      for (const id of [A, B]) {
        await db.query('insert into auth.users (id) values ($1)', [id]);
        await redeemInvite(db, id, 'CODE2345');
      }
      const look = createCertificate(5);
      await foundCompany(db, A, { name: '소금 상단', face: look.face, emblem: look.emblem });
      await db.query(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, 1, 'rehearsal', now(), now() + interval '14 days', $2)`, [
        SEASON,
        SIM_VERSION,
      ]);
      const blob = openWorld(seasonMap(SEASON), {
        seasonId: SEASON,
        worldId: 'w1',
        humans: [{ id: A, name: '소금 상단', merchantNo: 1, apprentice: false }],
        bots: 11,
        warmupDays: 2,
      });
      await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, 'w1', 1, 11, $2::text::json, 1, $3)`, [
        SEASON,
        JSON.stringify(blob),
        SIM_VERSION,
      ]);
      await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, 'w1', $2, 1, 1)`, [SEASON, A]);
    },
  });
}, 120_000);

afterAll(async () => {
  await h?.close();
});

describe('Edge Function game (Deno + withSupabase + postgres.js)', () => {
  it('로그인 없이는 막는다', async () => {
    expect((await h.call({ action: 'view' }, null)).status).toBe(401);
  });

  it('세계에 든 사람은 화면 데이터를 받는다, 아닌 사람은 noWorld', async () => {
    const r = await h.call({ action: 'view' }, await h.token(A));
    expect(r.json).toMatchObject({ ok: true, screen: { seasonId: SEASON, worldId: 'w1', halted: null, view: { day: 1 } } });
    expect((await h.call({ action: 'view' }, await h.token(B))).json).toEqual({ ok: false, error: 'noWorld' });
  });

  it('명령을 적용해 저장하고 기록을 남긴다', async () => {
    const cmd = { type: 'setNotify', dailyCap: 3 };
    const r = await h.call({ action: 'command', cmd }, await h.token(A));
    expect(r.json).toMatchObject({ ok: true, result: { ok: true }, screen: { worldId: 'w1' } });
    const [w] = await h.db.query<{ rev: number; t: string }>(`select rev::int as rev, json_typeof(state) as t from public.worlds`);
    expect(w).toEqual({ rev: 1, t: 'object' });
    const log = await h.db.query<{ cmd: unknown; error: string | null }>(`select cmd, error from public.commands`);
    expect(log).toEqual([{ cmd, error: null }]);
  });

  it('자리를 비운 사이: 장날이 안 지났으면 없고, 본 날을 올릴 수 있다', async () => {
    const r = await h.call({ action: 'view' }, await h.token(A));
    expect(r.json).toMatchObject({ ok: true, away: null });
    expect((await h.call({ action: 'seen', day: 1 }, await h.token(A))).json).toEqual({ ok: true, seenDay: 1 });
    expect((await h.call({ action: 'seen', day: 'x' }, await h.token(A))).status).toBe(400);
  });

  it('명령 모양이 아니면 400', async () => {
    expect((await h.call({ action: 'command', cmd: 'x' }, await h.token(A))).status).toBe(400);
  });
});
