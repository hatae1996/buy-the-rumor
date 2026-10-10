// 봇으로 서버 시즌 한 번 (작업목록-0.2.0 13번): 서버 코드로 시즌을 처음부터 결산까지 빠르게(시험 모드) 돌린다.
// npm run measure:server. 결과는 docs/확인목록-0.2.0.md에 옮긴다.
// - 운영자가 시즌을 열고(세계 둘), 사람 다섯이 서버 함수로 견습을 마치고 들어간다. 사람 자리도 봇 판단으로 장사한다(사람 표시는 그대로).
// - 장날마다 tick, 첫 장날 직전 봇 채우기, 마지막에 한꺼번에 결산.
// - 확인: 장날이 빠지지 않는다, 같은 시즌 세계 둘의 지도·사건 일정이 같다, 시즌 전체 랭킹(봇 빼고)과 결산, 상태 크기와 함수 시간,
//   견습에서 졸업해 들어오기, 조선소 수(질문 137), 봄 구휼이 채워지는지(답 127 측정), 독점(사람 기준, 답 133), 기록 표.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCrew } from '../../src/sim/bot';
import { playerList, type Command } from '../../src/sim/economy';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { seasonMap, stateHash, type WorldBlob } from '../../src/sim/service';
import { foundCompany, redeemInvite } from '../../src/server/account';
import { commandFor, gameRequest, passDayFor, viewFor } from '../../src/server/game';
import { metricsTable } from '../../src/server/metrics';
import { DAY_MS } from '../../src/server/schedule';
import { openSeason, seasonOpensAt } from '../../src/server/season';
import { tickDue } from '../../src/server/tick';
import { createTestDb } from '../db/pglite';
import { walkApprentice } from '../helpers/apprentice';

const SEASON = process.env.SEASON ?? '2026-10-26';
const HUMANS = Number(process.env.HUMANS ?? 5);
const OUT = process.env.OUT ?? '';

describe('봇으로 서버 시즌 한 번', () => {
  it('처음부터 결산까지', async () => {
    const { pg, db } = await createTestDb();
    const opens = seasonOpensAt(SEASON);
    await openSeason(db, { id: SEASON, kind: 'closed_test', worlds: 2 });
    await db.query(`insert into public.invite_codes (code, uses_left) values ('MEASURE2', 99)`);

    // 사람: 계정 → 상단 → 견습 → 졸업 (서버 함수로), 첫 장날 전
    const humans: string[] = [];
    const apprenticeDays: number[] = [];
    for (let i = 0; i < HUMANS; i++) {
      const uid = `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
      humans.push(uid);
      await db.query('insert into auth.users (id) values ($1)', [uid]);
      await redeemInvite(db, uid, 'MEASURE2');
      const look = createCertificate(i + 1);
      await foundCompany(db, uid, { name: `시험 상단 ${i + 1}`, face: look.face, emblem: look.emblem });
      await gameRequest(db, uid, { action: 'startApprentice' });
      let days = 0;
      const destination = await walkApprentice({
        cmd: async (c) => {
          const r = await commandFor(db, uid, c);
          if (!r.ok) throw new Error(r.error);
          return r.result;
        },
        view: async () => {
          const v = await viewFor(db, uid);
          if (!v.ok) throw new Error(v.error);
          return v.screen.view;
        },
        passDay: async () => {
          days++;
          await passDayFor(db, uid);
        },
      });
      apprenticeDays.push(days);
      const r = await commandFor(db, uid, { type: 'travel', to: destination } as Command);
      expect(r.ok).toBe(true);
    }

    // 사람 자리에도 봇 판단을 붙인다 (사람 표시는 그대로: 시즌 전체 순위·기록 표에 사람으로)
    const shipyards: Record<string, number> = {};
    for (const w of ['w1', 'w2']) {
      const [row] = await db.query<{ state: string }>('select state::text as state from public.worlds where season_id = $1 and id = $2', [SEASON, w]);
      const blob = JSON.parse(row!.state) as WorldBlob;
      const mine = playerList(blob.state).filter((p) => !p.bot).map((p) => p.id);
      blob.crew.push(...createCrew(blob.state, mine));
      shipyards[w] = blob.state.events.filter((e) => e.event === 'shipyard').length;
      await db.query('update public.worlds set state = $3::text::json where season_id = $1 and id = $2', [SEASON, w, JSON.stringify(blob)]);
    }

    // 장날마다 tick (시험 모드: 시각을 당겨서)
    const tickMs: number[] = [];
    const relief: Record<string, { town: number; day: number; startLeft: number; minLeft: number }[]> = { w1: [], w2: [] };
    let settled = null as Awaited<ReturnType<typeof tickDue>>['settled'][number] | null;
    for (let t = 1; t <= 130 && !settled; t++) {
      const a = performance.now();
      const r = await tickDue(db, { now: opens + t * DAY_MS + 60_000 });
      tickMs.push(performance.now() - a);
      expect(r.worlds.every((w) => !w.error && !w.halted)).toBe(true);
      settled = r.settled[0] ?? null;
      for (const w of ['w1', 'w2']) {
        const [row] = await db.query<{ state: string }>('select state::text as state from public.worlds where season_id = $1 and id = $2', [SEASON, w]);
        const s = (JSON.parse(row!.state) as WorldBlob).state;
        for (const e of s.events.filter((x) => x.event === 'relief')) {
          const left = (e.orders ?? []).reduce((n, o) => n + o.left, 0);
          const rec = relief[w]!.find((x) => x.town === e.town && x.day === e.start);
          if (rec) rec.minLeft = Math.min(rec.minLeft, left);
          else relief[w]!.push({ town: e.town, day: e.start, startLeft: left, minLeft: left });
        }
      }
    }
    expect(settled).not.toBeNull();

    // 끝난 세계: 장날이 빠지지 않았는지, 같은 지도·사건 일정
    const worlds = await db.query<{ id: string; state: string; day: number; humans: number; bots: number; settled: boolean }>(
      'select id, state::text as state, day, humans, bots, settled from public.worlds where season_id = $1 order by id',
      [SEASON],
    );
    const blobs = worlds.map((w) => JSON.parse(w.state) as WorldBlob);
    const season = blobs[0]!.state.season!;
    expect(worlds.every((w) => w.settled && w.day === season.startDay + season.length)).toBe(true);
    expect(stateHash(blobs[0]!.state.season!.schedule)).toBe(stateHash(blobs[1]!.state.season!.schedule));
    expect(stateHash(seasonMap(SEASON))).toBe(stateHash(seasonMap(SEASON)));
    const tables = blobs.map((b) => b.state.settlement!.table);
    expect(tables[0]).toEqual(tables[1]);
    const seasonIds = Object.values(tables[0]!).flatMap((rs) => rs!.map((r) => r.id));
    expect(seasonIds.every((id) => humans.includes(id))).toBe(true);

    // 봄 구휼: 누가 그 마을에 곡물을 팔았나
    const reliefSales = blobs.map((b, i) =>
      relief[worlds[i]!.id]!.map((r) => {
        const sellers = playerList(b.state).filter((p) => p.ledger.some((e) => e.kind === 'sell' && e.good === 'grain' && e.town === r.town && e.day >= r.day && e.day <= r.day + 8));
        return { ...r, filled: r.startLeft - r.minLeft, sellers: sellers.length, humanSellers: sellers.filter((p) => !p.bot).length };
      }),
    );

    const metrics = await metricsTable(db, SEASON);
    const hall = await db.query('select category, account_id, score from public.hall_of_fame order by category');
    const pioneers = await db.query<{ n: number }>(`select count(*)::int as n from public.certificates where cert::text like '%"pioneer"%'`);
    const sizes = worlds.map((w) => Math.round(w.state.length / 1024));
    const sorted = [...tickMs].sort((a, b) => a - b);
    const result = {
      season: SEASON,
      seasonDays: season.length,
      humans: HUMANS,
      apprenticeMarketDays: apprenticeDays,
      worlds: worlds.map((w, i) => ({ id: w.id, humans: w.humans, bots: w.bots, day: w.day, stateKB: sizes[i] })),
      shipyardsAtStart: shipyards,
      tickMs: { median: Math.round(sorted[Math.floor(sorted.length / 2)]!), max: Math.round(sorted.at(-1)!), total: Math.round(tickMs.reduce((a, b) => a + b, 0)) },
      settled,
      hallOfFame: hall.length,
      pioneers: pioneers[0]!.n,
      relief: reliefSales,
      monopoly: metrics.worlds.map((w) => ({ world: w.worldId, all: w.monopolyAll, humans: w.monopolyHumans })),
      rows: metrics.rows.map((r) => ({
        no: r.merchantNo,
        world: r.worldId,
        start: r.startGroup,
        first5Profit: r.first5Profit,
        first5ProfitPerDay: r.first5ProfitPerDay,
        first5WorthPerDay: r.first5WorthPerDay,
        profitTotal: r.profitTotal,
        newspaperDays: r.newspaperDays,
        boughtHorse: r.boughtHorse,
        hired: r.hired,
      })),
    };
    console.log(JSON.stringify(result, null, 1));
    if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 1));
    await pg.close();
  }, 900_000);
});
