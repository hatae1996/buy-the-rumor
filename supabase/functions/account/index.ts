// 계정 (작업목록-0.2.0 4번): 내 계정, 초대 코드 넣기, 상단 이름 검사, 상단 세우기, 얼굴·문장 바꾸기.
// 로그인한 사람만: 플랫폼의 JWT 검사(verify_jwt, 기본값)를 켜 두고, withSupabase가 JWKS로 다시 확인해 계정 id를 준다.
import { withSupabase } from 'npm:@supabase/server@1.7.2';
import { accountRequest } from '../_shared/server.js';
import { db } from '../_shared/pg.ts';

const handler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  const uid = ctx.userClaims?.id;
  if (!uid) return Response.json({ ok: false, error: 'noLogin' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const r = await accountRequest(db(), uid, body);
  return Response.json(r.body, { status: r.status });
});

// CORS(미리 묻기 포함)는 withSupabase가 붙인다
export default { fetch: handler };
