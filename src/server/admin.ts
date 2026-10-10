// 운영자 함수 (작업목록-0.2.0 8번): 시즌 열기와 세계 더 열기. 비밀 값(ADMIN_SECRET)을 아는 사람만 부른다.
// 쓰는 법은 supabase/README.md "시즌 열기".
import type { Db } from './db';
import { addWorld, openSeason, type SeasonKind } from './season';

const KINDS: readonly SeasonKind[] = ['rehearsal', 'closed_test', 'live'];

export async function adminRequest(db: Db, body: unknown): Promise<{ status: number; body: unknown }> {
  const req = body as { action?: unknown; id?: unknown; kind?: unknown; worlds?: unknown; seasonId?: unknown } | null;
  switch (req?.action) {
    case 'openSeason': {
      if (typeof req.id !== 'string' || !KINDS.includes(req.kind as SeasonKind)) return bad();
      const r = await openSeason(db, { id: req.id, kind: req.kind as SeasonKind, worlds: Number(req.worlds ?? 2) });
      return { status: r.ok ? 200 : 400, body: r };
    }
    case 'addWorld': {
      if (typeof req.seasonId !== 'string') return bad();
      const [s] = await db.query('select 1 from public.seasons where id = $1', [req.seasonId]);
      if (!s) return { status: 400, body: { ok: false, error: 'noSeason' } };
      return { status: 200, body: { ok: true, worldId: await addWorld(db, req.seasonId) } };
    }
    default:
      return bad();
  }
}

const bad = () => ({ status: 400, body: { ok: false, error: 'badRequest' } });
