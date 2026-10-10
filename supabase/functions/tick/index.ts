// 하루 돌리기 (작업목록-0.2.0 3번). pg_cron이 몇 분마다 부른다 (supabase/migrations의 tick_cron).
// 로그인한 사람이 부르는 함수가 아니라 JWT 검사를 끄고(--no-verify-jwt) 비밀 값(TICK_SECRET)으로 막는다.
import { tickDue } from '../_shared/server.js';
import { db } from '../_shared/pg.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('TICK_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('forbidden', { status: 403 });
  const summary = await tickDue(db(), { now: Date.now() });
  return Response.json(summary);
});
