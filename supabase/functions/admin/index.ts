// 운영자 함수 (작업목록-0.2.0 8·12번): 시즌 열기, 세계 더 열기, 세계 상태, 기록 표, 멈춘 세계 풀기. 로그인한 사람이 부르는
// 함수가 아니라 JWT 검사를 끄고(--no-verify-jwt) 비밀 값(ADMIN_SECRET)으로 막는다. 관찰 화면(dev.html)이 브라우저에서 부르므로
// CORS에 답한다(비밀 값이 없으면 아무것도 주지 않는다). 쓰는 법은 supabase/README.md.
import { adminRequest } from '../_shared/server.js';
import { db } from '../_shared/pg.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const secret = Deno.env.get('ADMIN_SECRET');
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('forbidden', { status: 403, headers: CORS });
    const r = await adminRequest(db(), await req.json().catch(() => null));
    return Response.json(r.body, { status: r.status, headers: CORS });
  },
};
