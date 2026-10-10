// 로컬 서버 데이터베이스 (개발용): PGlite에 마이그레이션을 올리고 Postgres 소켓으로 연다. 서버 함수를 Deno로 띄워 붙여 본다.
// 쓰는 법 (Node 24, 타입 스트립):
//   node scripts/dev-db.ts            → 127.0.0.1:54400 (SUPABASE_DB_URL=postgres://postgres:postgres@127.0.0.1:54400/postgres)
// 끄면 데이터는 사라진다.
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createTestDb } from '../tests/db/pglite.ts';

const PORT = Number(process.env.PORT ?? 54400);
const { pg } = await createTestDb();
// 함수 여럿(admin, tick …)이 함께 붙도록 연결을 여러 개 받는다 (PGlite는 하나를 나눠 쓴다: 동시 트랜잭션 시험에는 맞지 않는다)
const server = new PGLiteSocketServer({ db: pg, port: PORT, host: '127.0.0.1', maxConnections: 8 });
await server.start();
console.log(`로컬 서버 DB: postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);
