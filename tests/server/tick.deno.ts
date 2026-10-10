// Edge Function tick을 Deno로 띄워, postgres.js로 PGlite(소켓)에 붙어 실제로 장날을 도는지 (작업목록-0.2.0 3번).
// npm run test:deno가 서버 번들을 만든 뒤 돈다.
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openWorld, seasonMap, SIM_VERSION } from '../../src/sim/service';
import type { Db } from '../../src/server/db';
import { DAY_MS } from '../../src/server/schedule';
import { addAccount, createTestDb } from '../db/pglite';

const FUNCTIONS = fileURLToPath(new URL('../../supabase/functions/', import.meta.url));
const DB_PORT = 54329;
const FN_PORT = 8000;
const SECRET = 'test-tick-secret';
const SEASON = '2026-10-26';
const HUMAN = '00000000-0000-0000-0000-00000000000a';

let pg: PGlite;
let db: Db;
let server: PGLiteSocketServer;
let fn: ChildProcess;

beforeAll(async () => {
  ({ pg, db } = await createTestDb());
  await addAccount(db, HUMAN);
  // 장날 4번이 이미 지난 시즌
  const opens = Date.now() - 4 * DAY_MS - 60_000;
  await db.query(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, 1, 'rehearsal', $2, $3, $4)`, [
    SEASON,
    new Date(opens).toISOString(),
    new Date(opens + 14 * 24 * 3600_000).toISOString(),
    SIM_VERSION,
  ]);
  const blob = openWorld(seasonMap(SEASON), {
    seasonId: SEASON,
    worldId: 'w1',
    humans: [{ id: HUMAN, name: '시험 상단', merchantNo: 1, apprentice: false }],
    bots: 11,
    warmupDays: 2,
  });
  await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, 'w1', 1, 11, $2::json, 1, $3)`, [
    SEASON,
    JSON.stringify(blob),
    SIM_VERSION,
  ]);
  await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, 'w1', $2, 1, 1)`, [SEASON, HUMAN]);

  server = new PGLiteSocketServer({ db: pg, port: DB_PORT, host: '127.0.0.1' });
  await server.start();
  fn = spawn('deno', ['run', '--config', 'deno.json', '--allow-net', '--allow-env', '--allow-read', 'tick/index.ts'], {
    cwd: FUNCTIONS,
    env: { ...process.env, SUPABASE_DB_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`, TICK_SECRET: SECRET },
    stdio: 'pipe',
  });
  // 함수가 뜰 때까지
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`http://127.0.0.1:${FN_PORT}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error('tick 함수가 뜨지 않았다');
}, 120_000);

afterAll(async () => {
  fn?.kill();
  await server?.stop();
  await pg?.close();
});

describe('Edge Function tick (Deno + postgres.js)', () => {
  it('비밀 값이 없으면 막는다', async () => {
    const r = await fetch(`http://127.0.0.1:${FN_PORT}/`, { method: 'POST' });
    expect(r.status).toBe(403);
  });

  it('밀린 장날 4번을 돌리고 표에 남긴다', async () => {
    const r = await fetch(`http://127.0.0.1:${FN_PORT}/`, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { worlds: { worldId: string; from: number; to: number }[] };
    expect(body.worlds).toEqual([{ seasonId: SEASON, worldId: 'w1', from: 1, to: 5 }]);
    const [w] = await db.query<{ day: number; rev: number }>(`select day, rev::int as rev from public.worlds`);
    expect(w).toEqual({ day: 5, rev: 1 });
    // postgres.js가 JSON 글자를 한 번 더 감싸 글자 하나로 저장하지 않았는지
    const [kind] = await db.query<{ t: string; day: number }>(`select json_typeof(state) as t, (state->'state'->>'day')::int as day from public.worlds`);
    expect(kind).toEqual({ t: 'object', day: 5 });
    const reports = await db.query<{ n: number }>(`select count(*)::int as n from public.day_reports`);
    expect(reports[0]!.n).toBe(4);
  });
});
