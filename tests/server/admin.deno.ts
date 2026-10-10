// Edge Function admin을 Deno로 띄워 시즌 열기와 세계 더 열기 (작업목록-0.2.0 8번)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFunction, type Harness } from './denoHarness';

const SECRET = 'test-admin-secret';
let h: Harness;

beforeAll(async () => {
  h = await startFunction('admin', { dbPort: 54332, fnPort: 8004, env: { ADMIN_SECRET: SECRET } });
}, 120_000);

afterAll(async () => {
  await h?.close();
});

describe('Edge Function admin (Deno + postgres.js)', () => {
  it('비밀 값이 없으면 막는다', async () => {
    expect((await h.call({ action: 'openSeason', id: '2026-10-26', kind: 'live' }, null)).status).toBe(403);
  });

  it('시즌을 열고 세계를 더 연다', async () => {
    const r = await h.call({ action: 'openSeason', id: '2026-10-26', kind: 'closed_test', worlds: 2 }, SECRET);
    expect(r.json).toEqual({ ok: true, seasonId: '2026-10-26', worlds: ['w1', 'w2'] });
    const more = await h.call({ action: 'addWorld', seasonId: '2026-10-26' }, SECRET);
    expect(more.json).toEqual({ ok: true, worldId: 'w3' });
    const rows = await h.db.query<{ id: string; t: string; day: number }>(`select id, json_typeof(state) as t, day from public.worlds order by id`);
    expect(rows).toEqual([
      { id: 'w1', t: 'object', day: 1 },
      { id: 'w2', t: 'object', day: 1 },
      { id: 'w3', t: 'object', day: 1 },
    ]);
  });

  it('잘못된 요청은 400', async () => {
    expect((await h.call({ action: 'openSeason', id: '2026-10-27', kind: 'live' }, SECRET)).json).toEqual({ ok: false, error: 'notMonday' });
    expect((await h.call({ action: 'addWorld', seasonId: 'nope' }, SECRET)).status).toBe(400);
    expect((await h.call({ action: 'x' }, SECRET)).status).toBe(400);
  });
});
