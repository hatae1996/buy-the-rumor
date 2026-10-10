// 운영자 함수 (작업목록-0.2.0 8·12번): 시즌 열기, 세계 더 열기, 세계 상태 보기, 기록 표, 멈춘 세계 풀기, 예행연습 지우기, 장날 예약 기록.
// 비밀 값(ADMIN_SECRET)을 아는 사람만 부른다.
// 쓰는 법은 supabase/README.md "시즌 열기".
import type { Db } from './db';
import { metricsCsv, metricsTable } from './metrics';
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
    case 'world': {
      // 관찰 화면: 세계 상태 그대로 (숨은 숫자 포함, 운영자만)
      const w = req as { seasonId?: unknown; worldId?: unknown };
      if (typeof w.seasonId !== 'string' || typeof w.worldId !== 'string') return bad();
      const [row] = await db.query<{ state: string; halted: string | null; rev: number }>(
        'select state::text as state, halted, rev::int as rev from public.worlds where season_id = $1 and id = $2',
        [w.seasonId, w.worldId],
      );
      return row ? { status: 200, body: { ok: true, halted: row.halted, rev: row.rev, blob: JSON.parse(row.state) } } : { status: 400, body: { ok: false, error: 'noWorld' } };
    }
    case 'worlds': {
      if (typeof req.seasonId !== 'string') return bad();
      const rows = await db.query('select id, humans, bots, day, halted, settled, last_tick_at from public.worlds where season_id = $1 order by id', [req.seasonId]);
      const log = await db.query('select at, level, message, data from public.ops_log order by id desc limit 50');
      return { status: 200, body: { ok: true, worlds: rows, log } };
    }
    case 'metrics': {
      if (typeof req.seasonId !== 'string') return bad();
      const t = await metricsTable(db, req.seasonId);
      return { status: 200, body: { ok: true, ...t, csv: metricsCsv(t.rows) } };
    }
    case 'deleteSeason': {
      // 예행연습을 비공개 테스트 전에 지운다 (handoff 0.2.0 2번): 세계·견습·명령·점수 줄·그날 요약·시즌 결과까지.
      // 의견과 기록 사건은 남긴다(예행연습에서 나온 의견을 고칠 때 본다). 예행연습만 지울 수 있다
      if (typeof req.seasonId !== 'string') return bad();
      const [s] = await db.query<{ kind: string }>('select kind from public.seasons where id = $1', [req.seasonId]);
      if (!s) return { status: 400, body: { ok: false, error: 'noSeason' } };
      if (s.kind !== 'rehearsal') return { status: 400, body: { ok: false, error: 'notRehearsal' } };
      await db.query('delete from public.seasons where id = $1', [req.seasonId]);
      return { status: 200, body: { ok: true } };
    }
    case 'cron': {
      // 5분마다 장날을 부르는 예약(pg_cron)이 돌았는지와, 장날 함수가 몇 번으로 답했는지 (200 통과, 403 비밀 값이 다름)
      try {
        const runs = await db.query(
          `select d.start_time, d.status, d.return_message from cron.job_run_details d join cron.job j on j.jobid = d.jobid
            where j.jobname = 'btr-tick' order by d.start_time desc limit 10`,
        );
        const http = await db.query('select created, status_code, error_msg, left(content, 200) as content from net._http_response order by created desc limit 10');
        return { status: 200, body: { ok: true, runs, http } };
      } catch (e) {
        return { status: 200, body: { ok: false, error: 'noCron', detail: e instanceof Error ? e.message : String(e) } };
      }
    }
    case 'unhalt': {
      // 맞는 번들을 다시 올린 뒤 멈춘 세계를 푼다 (handoff 0.2.0 3번)
      const w = req as { seasonId?: unknown; worldId?: unknown };
      if (typeof w.seasonId !== 'string' || typeof w.worldId !== 'string') return bad();
      await db.query('update public.worlds set halted = null where season_id = $1 and id = $2', [w.seasonId, w.worldId]);
      return { status: 200, body: { ok: true } };
    }
    default:
      return bad();
  }
}

const bad = () => ({ status: 400, body: { ok: false, error: 'badRequest' } });
