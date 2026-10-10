// 명령 받기와 화면 데이터 (작업목록-0.2.0 5번): { action: 'view' } 또는 { action: 'command', cmd }.
// 로그인한 사람만 (account와 같이 verify_jwt를 켜고 withSupabase가 계정 id를 준다)
import { withSupabase } from 'npm:@supabase/server@1.7.2';
import { gameRequest } from '../_shared/server.js';
import { db } from '../_shared/pg.ts';

const handler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  const uid = ctx.userClaims?.id;
  if (!uid) return Response.json({ ok: false, error: 'noLogin' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const r = await gameRequest(db(), uid, body);
  return Response.json(r.body, { status: r.status });
});

// CORS(미리 묻기 포함)는 withSupabase가 붙인다
export default { fetch: handler };
