// Edge Function의 DB 연결: postgres.js를 서버 번들의 Db 모양(src/server/db.ts)으로 꽂는다.
// SUPABASE_DB_URL은 Supabase가 Edge Function에 넣어 주는 연결 주소. 트랜잭션 풀러를 거치므로 prepare를 끈다.
import postgres from 'npm:postgres@3.4.9';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

type Sql = postgres.Sql | postgres.TransactionSql;

let client: postgres.Sql | null = null;

/** 요청마다 새로 잇지 않고 Edge Function 인스턴스가 살아 있는 동안 하나를 쓴다 */
export function db(): Db {
  client ??= postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3 });
  return wrap(client, false);
}

function wrap(sql: Sql, inTx: boolean): Db {
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[],
    transaction: <R>(fn: (tx: Db) => Promise<R>) =>
      inTx ? fn(wrap(sql, true)) : ((sql as postgres.Sql).begin((tx) => fn(wrap(tx, true))) as Promise<R>),
  };
}
