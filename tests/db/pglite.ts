// 시험용 데이터베이스: PGlite(WASM Postgres)에 Supabase의 auth 스키마와 역할을 흉내 내고 supabase/migrations를 올린다.
// 첫 줄에 "pglite: skip"이 있는 마이그레이션(pg_cron처럼 PGlite에 없는 확장을 쓰는 것)은 건너뛴다.
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { Db } from '../../src/server/db';

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

// Supabase는 public 표에 이 역할들의 권한을 기본으로 준다(막는 것은 RLS)
const SUPABASE_GRANTS = `
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<{ pg: PGlite; db: Db }> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(f, MIGRATIONS), 'utf8');
    if (sql.split('\n', 1)[0]!.includes('pglite: skip')) continue;
    await pg.exec(sql);
  }
  await pg.exec(SUPABASE_GRANTS);
  return { pg, db: pgliteDb(pg) };
}

/** 서버 코드의 Db 모양으로 */
export function pgliteDb(pg: PGlite | Transaction, inTx = false): Db {
  return {
    query: async <T>(sql: string, params: readonly unknown[] = []) => (await pg.query<T>(sql, params as unknown[])).rows,
    transaction: async <R>(fn: (tx: Db) => Promise<R>) =>
      inTx || !('transaction' in pg) ? fn(pgliteDb(pg, true)) : pg.transaction((tx) => fn(pgliteDb(tx, true))),
  };
}

/** 계정 하나 (auth.users + accounts) */
export async function addAccount(db: Db, id: string, code = 'TEST'): Promise<void> {
  await db.query(`insert into public.invite_codes (code, uses_left) values ($1, 100) on conflict do nothing`, [code]);
  await db.query(`insert into auth.users (id) values ($1)`, [id]);
  await db.query(`insert into public.accounts (id, invite_code) values ($1, $2)`, [id, code]);
}
