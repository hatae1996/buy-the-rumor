// Edge Function tick을 Deno로 띄워, postgres.js로 PGlite(소켓)에 붙어 실제로 장날을 도는지 (작업목록-0.2.0 3번)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openWorld, seasonMap, SIM_VERSION } from '../../src/sim/service';
import { DAY_MS } from '../../src/server/schedule';
import { addAccount } from '../db/pglite';
import { startFunction, type Harness } from './denoHarness';

const SECRET = 'test-tick-secret';
const SEASON = '2026-10-26';
const HUMAN = '00000000-0000-0000-0000-00000000000a';

let h: Harness;

beforeAll(async () => {
  h = await startFunction('tick', {
    dbPort: 54329,
    // tick은 Deno.serve 기본 포트
    fnPort: 8000,
    serve: false,
    env: { TICK_SECRET: SECRET },
    seed: async (db) => {
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
      await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, 'w1', 1, 11, $2::text::json, 1, $3)`, [
        SEASON,
        JSON.stringify(blob),
        SIM_VERSION,
      ]);
      await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, 'w1', $2, 1, 1)`, [SEASON, HUMAN]);
    },
  });
}, 120_000);

afterAll(async () => {
  await h?.close();
});

describe('Edge Function tick (Deno + postgres.js)', () => {
  it('비밀 값이 없으면 막는다', async () => {
    expect((await h.call({}, null)).status).toBe(403);
    expect((await h.call({}, 'wrong')).status).toBe(403);
  });

  it('밀린 장날 4번을 돌리고 표에 남긴다', async () => {
    const r = await h.call({}, SECRET);
    expect(r.status).toBe(200);
    expect((r.json as { worlds: unknown[] }).worlds).toEqual([{ seasonId: SEASON, worldId: 'w1', from: 1, to: 5 }]);
    const [w] = await h.db.query<{ day: number; rev: number }>(`select day, rev::int as rev from public.worlds`);
    expect(w).toEqual({ day: 5, rev: 1 });
    // postgres.js가 JSON 글자를 한 번 더 감싸 글자 하나로 저장하지 않았는지
    const [kind] = await h.db.query<{ t: string; day: number }>(`select json_typeof(state) as t, (state->'state'->>'day')::int as day from public.worlds`);
    expect(kind).toEqual({ t: 'object', day: 5 });
    const reports = await h.db.query<{ n: number }>(`select count(*)::int as n from public.day_reports`);
    expect(reports[0]!.n).toBe(4);
  });
});
