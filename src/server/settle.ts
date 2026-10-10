// 시즌 전체 랭킹과 결산 (작업목록-0.2.0 10번, handoff 0.2.0 3·6번).
// - 세계는 마지막 장날을 마치면 결산하지 않고 멈춘다(tick의 settle: false). 시즌의 모든 세계가 멈추면 여기서
//   모든 세계의 마지막 장날 점수 줄을 모아 세계마다 결산한다: 인장·칭호·상위 10%는 시즌 전체 순위(사람만)로.
// - 결산 뒤 증서(certificates)에 인장·칭호·연차를 옮기고, 시즌 결과(season_results)와 명예의 전당(부문 1위, 사람만)을 남긴다.
// - 비공개 테스트 시즌이면 들어온 사람 모두에게 "개척 상인" 인장.
// - 시험 시즌(trial)과 예행연습(rehearsal)은 결산 화면만 보이고 아무것도 남기지 않는다(예행연습은 비공개 테스트 전에 지운다,
//   handoff 0.2.0 2번: 증서·인장도 남기지 않는다).
// - 장날마다의 시즌 전체 순위는 저장하지 않고 화면 데이터를 만들 때 다른 세계의 최신 점수 줄로 매긴다(seasonRows).
import { playerList } from '../sim/economy';
import { CATEGORIES, PIONEER_BADGE, type ScoreRow } from '../sim/ranking';
import type { Certificate } from '../sim/ranking/types';
import { settleWorld, type WorldBlob } from '../sim/service';
import type { Db } from './db';
import { nameKey } from './names';

interface ScoreRowRecord {
  world_id: string;
  player_id: string;
  name: string;
  bot: boolean;
  category: string;
  score: number;
}

/**
 * 같은 시즌 다른 세계들의 점수 줄: 세계마다 upTo일까지 중 가장 최근 장날의 줄.
 * except: 이 세계는 뺀다 (그 세계의 줄은 상태에서 바로 센다)
 */
export async function seasonRows(db: Db, seasonId: string, except: string | null, upTo: number): Promise<ScoreRow[]> {
  const rows = await db.query<ScoreRowRecord>(
    `select r.world_id, r.player_id, r.name, r.bot, r.category, r.score
       from public.score_rows r
       join (select world_id, max(day) as d from public.score_rows
              where season_id = $1 and day <= $3 and ($2::text is null or world_id <> $2) group by world_id) m
         on m.world_id = r.world_id and m.d = r.day
      where r.season_id = $1`,
    [seasonId, except, upTo],
  );
  return rows.map((r) => ({
    seasonId,
    worldId: r.world_id,
    playerId: r.player_id,
    name: r.name,
    bot: r.bot,
    category: r.category as ScoreRow['category'],
    score: r.score,
  }));
}

export interface SeasonSettleSummary {
  seasonId: string;
  worlds: string[];
  /** 증서를 고친 사람 수 (시험 시즌·예행연습이면 0) */
  certificates: number;
  pioneers: number;
  hallOfFame: number;
  /** 남기지 않는 결산 (시험 시즌 또는 예행연습) */
  trial: boolean;
}

/** 시즌의 모든 세계가 마지막 장날을 마쳤으면 한꺼번에 결산한다. 아직이면 null */
export async function settleSeasonAll(db: Db, seasonId: string): Promise<SeasonSettleSummary | null> {
  return db.transaction(async (tx) => {
    const [season] = await tx.query<{ kind: string; trial: boolean; status: string }>('select kind, trial, status from public.seasons where id = $1 for update', [
      seasonId,
    ]);
    if (!season || season.status === 'ended') return null;
    const worlds = await tx.query<{ id: string; state: string; settled: boolean }>(
      'select id, state::text as state, settled from public.worlds where season_id = $1 order by id for update',
      [seasonId],
    );
    if (!worlds.length || worlds.some((w) => !w.settled)) return null;
    const blobs = worlds.map((w) => ({ id: w.id, blob: JSON.parse(w.state) as WorldBlob }));
    const lastDay = Math.max(...blobs.map((b) => b.blob.state.day - 1));
    const all = await seasonRows(tx, seasonId, null, lastDay);
    const keep = !season.trial && season.kind !== 'rehearsal';
    let certificates = 0;
    const firsts = new Map<string, { id: string; name: string; score: number }>();
    const humans: string[] = [];

    for (const { id, blob } of blobs) {
      const st = settleWorld(blob, all.filter((r) => r.worldId !== id));
      if (!st) continue;
      await tx.query('update public.worlds set state = $3::text::json, rev = rev + 1 where season_id = $1 and id = $2', [seasonId, id, JSON.stringify(blob)]);
      for (const c of CATEGORIES) {
        const top = st.table[c]?.[0];
        if (top && top.rank === 1 && !firsts.has(c)) firsts.set(c, { id: top.id, name: top.name ?? top.id, score: top.score });
      }
      for (const p of playerList(blob.state).filter((x) => !x.bot)) {
        humans.push(p.id);
        if (!keep) continue;
        const cert = p.certificate;
        await tx.query('update public.certificates set name = $2, name_key = $3, cert = $4::text::json, updated_at = now() where account_id = $1', [
          p.id,
          cert.name,
          nameKey(cert.name),
          JSON.stringify(cert),
        ]);
        certificates++;
        const ranks = Object.fromEntries(
          CATEGORIES.flatMap((c) => {
            const s = st.table[c]?.find((x) => x.id === p.id);
            return s ? [[c, { rank: s.rank, topShare: s.topShare, score: s.score }]] : [];
          }),
        );
        const got = st.awarded[p.id] ?? { badges: [], titles: [] };
        await tx.query(
          `insert into public.season_results (season_id, account_id, world_id, ranks, badges, titles)
           values ($1, $2, $3, $4::text::json, $5::text::json, $6::text::json)
           on conflict (season_id, account_id) do nothing`,
          [seasonId, p.id, id, JSON.stringify(ranks), JSON.stringify(got.badges), JSON.stringify(got.titles)],
        );
      }
    }

    // 개척 상인: 비공개 테스트 시즌에 하루라도 들어온 사람 (결산까지 남은 세계의 사람 모두)
    let pioneers = 0;
    if (keep && season.kind === 'closed_test') {
      const seasonNumber = blobs[0]!.blob.state.season?.number ?? 1;
      for (const uid of humans) {
        const [row] = await tx.query<{ cert: string }>('select cert::text as cert from public.certificates where account_id = $1 for update', [uid]);
        if (!row) continue;
        const cert = JSON.parse(row.cert) as Certificate;
        if (cert.badges.some((b) => b.badge === PIONEER_BADGE.id)) continue;
        cert.badges.push({ badge: PIONEER_BADGE.id, tier: null, season: seasonNumber, day: lastDay });
        await tx.query('update public.certificates set cert = $2::text::json, updated_at = now() where account_id = $1', [uid, JSON.stringify(cert)]);
        await tx.query(
          `update public.season_results set badges = (badges::jsonb || '["pioneer"]'::jsonb)::json where season_id = $1 and account_id = $2`,
          [seasonId, uid],
        );
        pioneers++;
      }
    }

    // 명예의 전당: 부문마다 시즌 전체 1위 (사람만, 같은 점수면 먼저 오른 한 사람)
    let hallOfFame = 0;
    if (keep) {
      for (const [category, f] of firsts) {
        await tx.query(
          `insert into public.hall_of_fame (season_id, category, account_id, name, score) values ($1, $2, $3, $4, $5)
           on conflict (season_id, category) do nothing`,
          [seasonId, category, f.id, f.name, f.score],
        );
        hallOfFame++;
      }
    }

    await tx.query(`update public.seasons set status = 'ended' where id = $1`, [seasonId]);
    await tx.query('insert into public.ops_log (level, message, data) values ($1, $2, $3::text::json)', [
      'info',
      keep ? '시즌을 결산했다' : '시즌을 결산했다 (시험 시즌·예행연습: 남기지 않음)',
      JSON.stringify({ seasonId, worlds: blobs.length, certificates, pioneers, hallOfFame }),
    ]);
    return { seasonId, worlds: blobs.map((b) => b.id), certificates, pioneers, hallOfFame, trial: !keep };
  });
}
