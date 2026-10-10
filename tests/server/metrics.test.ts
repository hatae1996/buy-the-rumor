// 기록할 숫자와 기록 표 (작업목록-0.2.0 12·13번)
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCrew } from '../../src/sim/bot';
import { createEconomy, type LedgerEntry } from '../../src/sim/economy';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { dailyProfit, monopoly, openWorld, seasonMap, SIM_VERSION, startGroup, type WorldBlob } from '../../src/sim/service';
import { generateWorld } from '../../src/sim/worldgen';
import { foundCompany, redeemInvite } from '../../src/server/account';
import { adminRequest } from '../../src/server/admin';
import type { Db } from '../../src/server/db';
import { metricsCsv, metricsTable } from '../../src/server/metrics';
import { DAY_MS } from '../../src/server/schedule';
import { tickDue } from '../../src/server/tick';
import { createTestDb } from '../db/pglite';

const SEASON = '2026-10-26';
const OPENS = Date.parse('2026-10-26T09:00:00+09:00');
const A = '00000000-0000-0000-0000-00000000000a';

describe('시뮬 기록 함수', () => {
  it('판 이익: 물품마다 산 값의 평균으로', () => {
    const ledger: LedgerEntry[] = [
      { day: 1, kind: 'buy', town: 0, good: 'salt', qty: 10, price: 3 },
      { day: 1, kind: 'buy', town: 0, good: 'salt', qty: 10, price: 5 },
      { day: 2, kind: 'sell', town: 1, good: 'salt', qty: 5, price: 10 },
      { day: 3, kind: 'sell', town: 1, good: 'fish', qty: 2, price: 4 },
    ];
    const p = dailyProfit(ledger);
    expect(p.get(2)).toBe(5 * 10 - 5 * 4);
    expect(p.get(3)).toBe(8); // 원정으로 얻은 것은 산 값 0
    expect(p.has(1)).toBe(false);
  });

  it('시작 마을 묶음: 도시는 city, 나머지는 도시까지 날', () => {
    const map = seasonMap(SEASON);
    const city = map.towns.find((t) => t.tier === 'city')!;
    expect(startGroup(map, city.id)).toBe('city');
    for (const t of map.towns) expect(['city', '1', '2', '3', '4+']).toContain(startGroup(map, t.id));
  });

  it('독점: 같은 한 사람이 그 마을·물품 판매의 절반 넘게, 시즌 절반 넘는 날. 사람 기준은 사람일 때만', () => {
    const s = createEconomy(generateWorld(3), 3, { players: [{ id: 'h' }, { id: 'bot1', bot: true }] });
    s.season!.length = 10;
    s.day = s.season!.startDay + 10;
    const h = s.players.h!;
    const b = s.players.bot1!;
    for (let d = 0; d < 6; d++) {
      b.ledger.push({ day: s.season!.startDay + d, kind: 'sell', town: 0, good: 'salt', qty: 9, price: 1 });
      h.ledger.push({ day: s.season!.startDay + d, kind: 'sell', town: 0, good: 'salt', qty: 1, price: 1 });
    }
    for (let d = 0; d < 3; d++) h.ledger.push({ day: s.season!.startDay + d, kind: 'sell', town: 1, good: 'fish', qty: 5, price: 1 });
    expect(monopoly(s, false)).toMatchObject({ soleDays: 6, monopoly: true, at: { town: 0, good: 'salt', playerId: 'bot1' }, days: 10 });
    expect(monopoly(s, true)).toMatchObject({ soleDays: 3, monopoly: false, at: { town: 1, good: 'fish', playerId: 'h' } });
  });
});

describe('기록 표 (서버)', () => {
  let pg: PGlite;
  let db: Db;

  beforeEach(async () => {
    ({ pg, db } = await createTestDb());
    await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
    await db.query('insert into auth.users (id) values ($1)', [A]);
    await redeemInvite(db, A, 'CODE2345');
    const look = createCertificate(5);
    await foundCompany(db, A, { name: '소금 상단', face: look.face, emblem: look.emblem });
    await db.query(`insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, 1, 'closed_test', $2, $3, $4)`, [
      SEASON,
      new Date(OPENS).toISOString(),
      new Date(OPENS + 14 * 24 * 3600_000).toISOString(),
      SIM_VERSION,
    ]);
    const blob: WorldBlob = openWorld(seasonMap(SEASON), { seasonId: SEASON, worldId: 'w1', humans: [{ id: A, name: '소금 상단', merchantNo: 1, apprentice: false }], bots: 11, warmupDays: 2 });
    blob.crew.push(...createCrew(blob.state, [A]));
    await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, 'w1', 1, 11, $2::text::json, 1, $3)`, [
      SEASON,
      JSON.stringify(blob),
      SIM_VERSION,
    ]);
    await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, 'w1', $2, 1, 1)`, [SEASON, A]);
    // 기록 사건: 시작 화면 3분, 견습 40분, 접속 두 번(하루), 5분 신호 넷
    const ev = (kind: string, ms: number) =>
      db.query(`insert into public.play_events (account_id, kind, at) values ($1, $2, $3)`, [A, kind, new Date(OPENS - 3 * 3600_000 + ms).toISOString()]);
    await ev('founding_start', 0);
    await ev('founding_done', 180_000);
    await ev('apprentice_start', 200_000);
    await ev('graduate', 200_000 + 40 * 60_000);
    await ev('session_start', 0);
    await ev('session_start', 3_600_000);
    for (let i = 1; i <= 4; i++) await ev('heartbeat', i * 300_000);
    await db.query(`insert into public.commands (season_id, world_id, account_id, day, cmd, error) values ($1, 'w1', $2, 1, '{"type":"buyNewspaper"}', null), ($1, 'w1', $2, 2, '{"type":"buyNewspaper"}', null), ($1, 'w1', $2, 2, '{"type":"noteRumor","id":3}', null), ($1, 'w1', $2, 2, '{"type":"noteRumor","id":4}', 'noNote')`, [SEASON, A]);
    await tickDue(db, { now: OPENS + 6 * DAY_MS + 60_000 });
  }, 60_000);

  afterEach(async () => {
    await pg.close();
  });

  it('사람마다 한 줄, 상인 번호로 (이메일 없이)', async () => {
    const t = await metricsTable(db, SEASON);
    expect(t.rows).toHaveLength(1);
    const r = t.rows[0]!;
    expect(r).toMatchObject({ merchantNo: 1, worldId: 'w1', joinedDay: 1, foundingSec: 180, apprenticeSec: 2400, activeDays: 1, sessionsPerDay: 2, minutesPerDay: 20 });
    expect(r.first5Profit).toHaveLength(5);
    expect(r.first5Worth).toHaveLength(5);
    expect(r.newspaperDays).toBe(2);
    expect(r.rumorsNoted).toBe(1); // 실패한 명령은 세지 않는다
    expect(JSON.stringify(t)).not.toContain('@');
    expect(t.worlds[0]).toMatchObject({ worldId: 'w1', humans: 1, bots: 11, day: 7 });
    expect(t.worlds[0]!.monopolyHumans.days).toBe(6);
  });

  it('CSV와 운영자 함수', async () => {
    const t = await metricsTable(db, SEASON);
    const csv = metricsCsv(t.rows);
    expect(csv.split('\n')[0]).toContain('merchantNo,worldId,startGroup');
    expect(csv.split('\n')).toHaveLength(2);
    const r = await adminRequest(db, { action: 'metrics', seasonId: SEASON });
    expect(r.body).toMatchObject({ ok: true, csv });
    const w = await adminRequest(db, { action: 'world', seasonId: SEASON, worldId: 'w1' });
    expect((w.body as { blob: WorldBlob }).blob.state.day).toBe(7);
    await db.query(`update public.worlds set halted = '시험'`);
    await adminRequest(db, { action: 'unhalt', seasonId: SEASON, worldId: 'w1' });
    const [x] = await db.query<{ halted: string | null }>('select halted from public.worlds');
    expect(x!.halted).toBeNull();
    const list = await adminRequest(db, { action: 'worlds', seasonId: SEASON });
    expect((list.body as { worlds: unknown[] }).worlds).toHaveLength(1);
  });
});
