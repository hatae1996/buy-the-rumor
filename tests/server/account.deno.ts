// Edge Function account를 Deno로 띄워 로그인 확인(withSupabase, JWKS)부터 표까지 끝까지 (작업목록-0.2.0 4번)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { startFunction, type Harness } from './denoHarness';

const USER = '00000000-0000-0000-0000-00000000000a';

let h: Harness;
let token: string;

beforeAll(async () => {
  h = await startFunction('account', {
    dbPort: 54330,
    fnPort: 8001,
    serve: true,
    seed: async (db) => {
      await db.query('insert into auth.users (id) values ($1)', [USER]);
      await db.query(`insert into public.invite_codes (code, uses_left) values ('ABCD2345', 5)`);
    },
  });
  token = await h.token(USER);
}, 120_000);

afterAll(async () => {
  await h?.close();
});

describe('Edge Function account (Deno + withSupabase + postgres.js)', () => {
  it('로그인 없이, 다른 키로 서명한 토큰, 만료된 토큰은 막는다', async () => {
    expect((await h.call({ action: 'me' }, null)).status).toBe(401);
    expect((await h.call({ action: 'me' }, await h.foreignToken(USER))).status).toBe(401);
    expect((await h.call({ action: 'me' }, await h.token(USER, { exp: Math.floor(Date.now() / 1000) - 60 }))).status).toBe(401);
  });

  it('미리 묻기(CORS)에 답한다', async () => {
    const r = await fetch(h.url, { method: 'OPTIONS', headers: { origin: 'https://example.github.io', 'access-control-request-method': 'POST' } });
    expect(r.ok).toBe(true);
    expect(r.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('초대 코드 → 상단 세우기 → 내 계정', async () => {
    expect((await h.call({ action: 'me' }, token)).json).toEqual({ ok: false, error: 'noAccount' });
    expect((await h.call({ action: 'redeem', code: 'abcd-2345' }, token)).json).toEqual({ ok: true, value: { merchantNo: 1 } });
    const sample = createCertificate(3);
    const found = await h.call({ action: 'found', name: '소금 상단', face: sample.face, emblem: sample.emblem }, token);
    expect(found.json).toMatchObject({ ok: true, value: { name: '소금 상단', merchantNo: 1 } });
    const me = await h.call({ action: 'me' }, token);
    expect(me.json).toMatchObject({ ok: true, value: { merchantNo: 1, certificate: { name: '소금 상단' } } });
    // 증서가 글자 하나가 아니라 객체로 저장되었다
    const [t] = await h.db.query<{ t: string }>('select json_typeof(cert) as t from public.certificates');
    expect(t!.t).toBe('object');
  });

  it('이상한 요청은 400', async () => {
    expect((await h.call({ action: 'nope' }, token)).status).toBe(400);
  });
});
