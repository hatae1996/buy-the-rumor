// 운영자 함수 (작업목록-0.2.0 8번): 시즌 열기, 세계 더 열기. 로그인한 사람이 부르는 함수가 아니라
// JWT 검사를 끄고(--no-verify-jwt) 비밀 값(ADMIN_SECRET)으로 막는다. 쓰는 법은 supabase/README.md.
import { adminRequest } from '../_shared/server.js';
import { db } from '../_shared/pg.ts';

export default {
  async fetch(req: Request): Promise<Response> {
    const secret = Deno.env.get('ADMIN_SECRET');
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('forbidden', { status: 403 });
    const r = await adminRequest(db(), await req.json().catch(() => null));
    return Response.json(r.body, { status: r.status });
  },
};
