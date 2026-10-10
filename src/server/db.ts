// 서버가 표를 읽고 쓰는 길. Edge Function은 postgres.js(supabase/functions/_shared/pg.ts)를,
// 시험은 PGlite(tests/db/pglite.ts)를 이 모양으로 꽂는다. 매개변수는 $1, $2 ...
// JSON은 글자(JSON.stringify)로 넘기고 SQL에서 `$1::text::json`으로 바꾼다. `$1::json`이면 postgres.js가 글자를 한 번 더
// JSON으로 감싸 글자 하나로 저장한다(PGlite에서는 드러나지 않는다, tests/server/tick.deno.ts).
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** 안에서 실패하면 모두 되돌린다. 트랜잭션 안에서 다시 부르면 같은 트랜잭션을 쓴다 */
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

/** 실제 시각(ms)을 SQL 매개변수로 */
export const ts = (ms: number): string => new Date(ms).toISOString();
