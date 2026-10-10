// Edge Function account를 Deno로 띄워 로그인 확인(withSupabase, JWKS)부터 표까지 끝까지 (작업목록-0.2.0 4번).
// 시험 안에서 ES256 키를 만들어 JWKS로 넘기고, 그 키로 Supabase Auth와 같은 모양의 토큰을 서명한다.
import { spawn, type ChildProcess } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCertificate } from '../../src/sim/ranking/certificate';
import type { Db } from '../../src/server/db';
import { createTestDb } from '../db/pglite';

const FUNCTIONS = fileURLToPath(new URL('../../supabase/functions/', import.meta.url));
const DB_PORT = 54330;
const FN_PORT = 8001;
const SUPABASE_URL = 'http://localhost:54321';
const USER = '00000000-0000-0000-0000-00000000000a';
const URL_ = `http://127.0.0.1:${FN_PORT}/`;

let pg: PGlite;
let db: Db;
let server: PGLiteSocketServer;
let fn: ChildProcess;
let keys: CryptoKeyPair;
let token: string;

const b64url = (data: Uint8Array | string) => Buffer.from(data).toString('base64url');

async function sign(claims: Record<string, unknown>, key = keys.privateKey): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'test-key' }));
  const body = b64url(JSON.stringify(claims));
  const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

function userClaims(sub: string, extra: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { sub, role: 'authenticated', aud: 'authenticated', iss: `${SUPABASE_URL}/auth/v1`, iat: now, exp: now + 3600, ...extra };
}

async function call(body: unknown, auth: string | null = token): Promise<{ status: number; json: unknown; headers: Headers }> {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
}

beforeAll(async () => {
  ({ pg, db } = await createTestDb());
  await db.query('insert into auth.users (id) values ($1)', [USER]);
  await db.query(`insert into public.invite_codes (code, uses_left) values ('ABCD2345', 5)`);
  keys = (await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
  token = await sign(userClaims(USER));

  server = new PGLiteSocketServer({ db: pg, port: DB_PORT, host: '127.0.0.1' });
  await server.start();
  fn = spawn('deno', ['serve', '--config', 'deno.json', '--port', String(FN_PORT), '--allow-net', '--allow-env', '--allow-read', 'account/index.ts'], {
    cwd: FUNCTIONS,
    env: {
      ...process.env,
      SUPABASE_DB_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
      SUPABASE_URL,
      // 실제 Edge Function에는 Supabase가 넣어 준다 (withSupabase가 ctx.supabase를 만들 때 쓴다)
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      SUPABASE_JWKS: JSON.stringify({ keys: [{ ...jwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] }),
    },
    stdio: 'pipe',
  });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(URL_, { method: 'OPTIONS' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error('account 함수가 뜨지 않았다');
}, 120_000);

afterAll(async () => {
  fn?.kill();
  await server?.stop();
  await pg?.close();
});

describe('Edge Function account (Deno + withSupabase + postgres.js)', () => {
  it('로그인 없이, 다른 키로 서명한 토큰, 만료된 토큰은 막는다', async () => {
    expect((await call({ action: 'me' }, null)).status).toBe(401);
    const other = (await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    expect((await call({ action: 'me' }, await sign(userClaims(USER), other.privateKey))).status).toBe(401);
    expect((await call({ action: 'me' }, await sign(userClaims(USER, { exp: Math.floor(Date.now() / 1000) - 60 })))).status).toBe(401);
  });

  it('미리 묻기(CORS)에 답한다', async () => {
    const r = await fetch(URL_, { method: 'OPTIONS', headers: { origin: 'https://example.github.io', 'access-control-request-method': 'POST' } });
    expect(r.ok).toBe(true);
    expect(r.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('초대 코드 → 상단 세우기 → 내 계정', async () => {
    expect((await call({ action: 'me' })).json).toEqual({ ok: false, error: 'noAccount' });
    expect((await call({ action: 'redeem', code: 'abcd-2345' })).json).toEqual({ ok: true, value: { merchantNo: 1 } });
    const sample = createCertificate(3);
    const found = await call({ action: 'found', name: '소금 상단', face: sample.face, emblem: sample.emblem });
    expect(found.json).toMatchObject({ ok: true, value: { name: '소금 상단', merchantNo: 1 } });
    const me = await call({ action: 'me' });
    expect(me.json).toMatchObject({ ok: true, value: { merchantNo: 1, certificate: { name: '소금 상단' } } });
    // 증서가 글자 하나가 아니라 객체로 저장되었다
    const [t] = await db.query<{ t: string }>('select json_typeof(cert) as t from public.certificates');
    expect(t!.t).toBe('object');
  });

  it('이상한 요청은 400', async () => {
    expect((await call({ action: 'nope' })).status).toBe(400);
  });
});
