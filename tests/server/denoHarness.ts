// Deno 끝까지 시험의 공용 준비 (npm run test:deno): PGlite를 Postgres 소켓으로 열고, Edge Function을 Deno로 띄우고,
// 시험 안에서 만든 ES256 키로 Supabase Auth와 같은 모양의 로그인 토큰을 서명한다(그 키를 JWKS로 함수에 넘긴다).
import { spawn, type ChildProcess } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { Db } from '../../src/server/db';
import { createTestDb } from '../db/pglite';

const FUNCTIONS = fileURLToPath(new URL('../../supabase/functions/', import.meta.url));
const SUPABASE_URL = 'http://localhost:54321';

export interface Harness {
  pg: PGlite;
  db: Db;
  url: string;
  /** 이 키로 서명한 토큰만 함수가 받는다 */
  token(sub: string, extra?: Record<string, unknown>): Promise<string>;
  /** 함수가 모르는 키로 서명한 토큰 */
  foreignToken(sub: string): Promise<string>;
  call(body: unknown, token: string | null, method?: string): Promise<{ status: number; json: unknown; headers: Headers }>;
  close(): Promise<void>;
}

const b64url = (data: Uint8Array | string) => Buffer.from(data).toString('base64url');
const newKeys = async () => (await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;

async function sign(claims: Record<string, unknown>, key: CryptoKey): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'test-key' }));
  const body = b64url(JSON.stringify(claims));
  const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

function userClaims(sub: string, extra: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { sub, role: 'authenticated', aud: 'authenticated', iss: `${SUPABASE_URL}/auth/v1`, iat: now, exp: now + 3600, ...extra };
}

/**
 * 함수 하나를 띄운다. seed는 함수가 뜨기 전에 표를 채운다.
 * entry가 `export default { fetch }`면 deno serve, `Deno.serve(...)`면 deno run으로 띄운다
 */
export async function startFunction(
  name: string,
  opt: { dbPort: number; fnPort: number; serve: boolean; env?: Record<string, string>; seed?: (db: Db) => Promise<void> },
): Promise<Harness> {
  const { pg, db } = await createTestDb();
  await opt.seed?.(db);
  const keys = await newKeys();
  const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
  const server = new PGLiteSocketServer({ db: pg, port: opt.dbPort, host: '127.0.0.1' });
  await server.start();
  const args = opt.serve
    ? ['serve', '--config', 'deno.json', '--port', String(opt.fnPort), '--allow-net', '--allow-env', '--allow-read', `${name}/index.ts`]
    : ['run', '--config', 'deno.json', '--allow-net', '--allow-env', '--allow-read', `${name}/index.ts`];
  const fn: ChildProcess = spawn('deno', args, {
    cwd: FUNCTIONS,
    env: {
      ...process.env,
      SUPABASE_DB_URL: `postgres://postgres:postgres@127.0.0.1:${opt.dbPort}/postgres`,
      SUPABASE_URL,
      // 실제 Edge Function에는 Supabase가 넣어 준다 (withSupabase가 ctx.supabase를 만들 때 쓴다)
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      SUPABASE_JWKS: JSON.stringify({ keys: [{ ...jwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] }),
      ...opt.env,
    },
    stdio: 'pipe',
  });
  const url = `http://127.0.0.1:${opt.fnPort}/`;
  const close = async () => {
    fn.kill();
    await server.stop();
    await pg.close();
  };
  for (let i = 0; ; i++) {
    try {
      await fetch(url, { method: 'OPTIONS' });
      break;
    } catch {
      if (i > 100) {
        await close();
        throw new Error(`${name} 함수가 뜨지 않았다`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return {
    pg,
    db,
    url,
    token: (sub, extra) => sign(userClaims(sub, extra), keys.privateKey),
    foreignToken: async (sub) => sign(userClaims(sub), (await newKeys()).privateKey),
    call: async (body, token, method = 'POST') => {
      const r = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
    },
    close,
  };
}
