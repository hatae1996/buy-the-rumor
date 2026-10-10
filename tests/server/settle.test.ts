// 시즌 전체 랭킹과 결산 (작업목록-0.2.0 10번)을 PGlite 위에서: 세계 둘, 사람 하나씩(봇 판단으로 장사), 짧은 시즌
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCrew } from '../../src/sim/bot';
import { createEconomy, getPlayer, type Command } from '../../src/sim/economy';
import { createCertificate } from '../../src/sim/ranking/certificate';
import type { Certificate } from '../../src/sim/ranking/types';
import { openWorld, seasonMap, SIM_VERSION, type WorldBlob } from '../../src/sim/service';
import { generateWorld } from '../../src/sim/worldgen';
import { foundCompany, redeemInvite } from '../../src/server/account';
import type { Db } from '../../src/server/db';
import { adminRequest } from '../../src/server/admin';
import { commandFor, viewFor } from '../../src/server/game';
import { DAY_MS } from '../../src/server/schedule';
import { seasonRows } from '../../src/server/settle';
import { tickDue } from '../../src/server/tick';
import { createTestDb } from '../db/pglite';

const SEASON = '2026-10-26';
const OPENS = Date.parse('2026-10-26T09:00:00+09:00');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const LENGTH = 6;
const at = (markets: number) => OPENS + markets * DAY_MS + 60_000;

let pg: PGlite;
let db: Db;

async function setup(kind: 'closed_test' | 'rehearsal' | 'live' = 'closed_test', trial = false): Promise<void> {
  await db.query(`insert into public.seasons (id, seed, kind, trial, opens_at, ends_at, sim_version) values ($1, 1, $2, $3, $4, $5, $6)`, [
    SEASON,
    kind,
    trial,
    new Date(OPENS).toISOString(),
    new Date(OPENS + 14 * 24 * 3600_000).toISOString(),
    SIM_VERSION,
  ]);
  for (const [w, uid] of [
    ['w1', A],
    ['w2', B],
  ] as const) {
    const [c] = await db.query<{ cert: string }>('select cert::text as cert from public.certificates where account_id = $1', [uid]);
    const cert = JSON.parse(c!.cert) as Certificate;
    const blob: WorldBlob = openWorld(seasonMap(SEASON), {
      seasonId: SEASON,
      worldId: w,
      humans: [{ id: uid, certificate: cert, apprentice: false }],
      bots: 11,
      warmupDays: 2,
    });
    blob.state.season!.length = LENGTH;
    // 사람 자리도 봇 판단으로 장사하게 한다 (점수가 나게). 사람 표시는 그대로
    blob.crew.push(...createCrew(blob.state, [uid]));
    await db.query(`insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, $2, 1, 11, $3::text::json, 1, $4)`, [
      SEASON,
      w,
      JSON.stringify(blob),
      SIM_VERSION,
    ]);
    await db.query(`insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, $2, $3, 1, 1)`, [SEASON, w, uid]);
  }
}

async function cert(uid: string): Promise<Certificate> {
  const [r] = await db.query<{ cert: string }>('select cert::text as cert from public.certificates where account_id = $1', [uid]);
  return JSON.parse(r!.cert) as Certificate;
}

async function blobOf(w: string): Promise<WorldBlob> {
  const [r] = await db.query<{ state: string }>('select state::text as state from public.worlds where id = $1', [w]);
  return JSON.parse(r!.state) as WorldBlob;
}

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
  const look = createCertificate(5);
  for (const [id, name] of [
    [A, '소금 상단'],
    [B, '바람 상단'],
  ] as const) {
    await db.query('insert into auth.users (id) values ($1)', [id]);
    await redeemInvite(db, id, 'CODE2345');
    await foundCompany(db, id, { name, face: look.face, emblem: look.emblem });
  }
}, 60_000);

afterEach(async () => {
  await pg.close();
});

describe('장날마다 시즌 전체 순위 (화면 데이터)', () => {
  it('다른 세계의 사람도 시즌 전체 순위에, 봇은 빼고', async () => {
    await setup();
    await tickDue(db, { now: at(3) });
    const rows = await seasonRows(db, SEASON, 'w1', 3);
    expect(rows.every((r) => r.worldId === 'w2')).toBe(true);
    const v = await viewFor(db, A, at(3));
    if (!v.ok) throw new Error(v.error);
    const ids = v.screen.view.ranking.categories.flatMap((c) => c.top.map((t) => t.id));
    expect(ids.some((id) => id.startsWith('bot'))).toBe(false);
    expect(new Set(ids)).toEqual(new Set([A, B].filter((x) => ids.includes(x))));
    expect(ids).toContain(B);
    // 내 세계 1~3위에는 봇도
    expect(v.screen.view.ranking.categories.flatMap((c) => c.worldTop).some((t) => t.bot)).toBe(true);
  });
});

describe('시즌 결산', () => {
  it('한 세계만 마지막 장날을 마치면 기다리고, 그 사이 명령은 받지 않는다', async () => {
    await setup();
    await db.query(`update public.worlds set halted = '시험' where id = 'w2'`);
    const r = await tickDue(db, { now: at(LENGTH + 2) });
    expect(r.settled).toEqual([]);
    const w1 = await blobOf('w1');
    expect(w1.state.settlement).toBeNull();
    expect(w1.state.day).toBe(LENGTH + 1);
    const [s] = await db.query<{ status: string }>('select status from public.seasons');
    expect(s!.status).toBe('open');
    const c = await commandFor(db, A, { type: 'placeSellOrder', good: 'salt', qty: 1, minPrice: 1 } as Command);
    expect(c.ok && c.result).toEqual({ ok: false, error: 'seasonOver' });
  });

  it('모든 세계가 마치면 한꺼번에: 같은 시즌 전체 순위(사람만), 증서·시즌 결과·명예의 전당·개척 상인', async () => {
    await setup('closed_test');
    const r = await tickDue(db, { now: at(LENGTH + 2) });
    expect(r.settled).toEqual([{ seasonId: SEASON, worlds: ['w1', 'w2'], certificates: 2, pioneers: 2, hallOfFame: expect.any(Number), trial: false }]);
    const [s] = await db.query<{ status: string }>('select status from public.seasons');
    expect(s!.status).toBe('ended');
    const w1 = await blobOf('w1');
    const w2 = await blobOf('w2');
    // 두 세계의 시즌 전체 순위는 같고 사람만
    expect(w1.state.settlement!.table).toEqual(w2.state.settlement!.table);
    const seasonIds = Object.values(w1.state.settlement!.table).flatMap((rs) => rs!.map((x) => x.id));
    expect(seasonIds.length).toBeGreaterThan(0);
    expect(seasonIds.every((id) => id === A || id === B)).toBe(true);
    expect(Object.values(w1.state.settlement!.worldTable).flatMap((rs) => rs!.map((x) => x.id)).some((id) => id.startsWith('bot'))).toBe(true);
    // 증서: 완주 인장, 연차, 개척 상인
    for (const uid of [A, B]) {
      const c = await cert(uid);
      expect(c.seasonsCompleted).toBe(1);
      expect(c.badges.map((b) => b.badge)).toEqual(expect.arrayContaining(['season-1', 'pioneer']));
      expect(c.name).toBe(uid === A ? '소금 상단' : '바람 상단');
    }
    // 시즌 결과
    const results = await db.query<{ account_id: string; badges: string[] }>('select account_id, badges from public.season_results order by account_id');
    expect(results.map((x) => x.account_id)).toEqual([A, B]);
    expect(results.every((x) => x.badges.includes('pioneer') && x.badges.includes('season-1'))).toBe(true);
    // 명예의 전당은 사람만
    const hall = await db.query<{ account_id: string }>('select account_id from public.hall_of_fame');
    expect(hall.length).toBe(r.settled[0]!.hallOfFame);
    expect(hall.every((h) => h.account_id === A || h.account_id === B)).toBe(true);
    // 결산 뒤에도 결산 화면은 보이고 더 돌리지 않는다
    const v = await viewFor(db, A, at(LENGTH + 2));
    expect(v.ok && v.screen.view.settlement).toBeTruthy();
    expect((await tickDue(db, { now: at(LENGTH + 10) })).worlds).toEqual([]);
  });

  it('예행연습은 증서·인장을 남기지 않고, 운영자가 지운다 (의견·기록 사건은 남김)', async () => {
    await setup('rehearsal');
    const before = await cert(A);
    const r = await tickDue(db, { now: at(LENGTH + 2) });
    expect(r.settled[0]).toMatchObject({ trial: true, certificates: 0, pioneers: 0, hallOfFame: 0 });
    expect(await cert(A)).toEqual(before);
    await db.query(`insert into public.feedback (account_id, body, screen, season_id) values ($1, '좋아요', 'town', $2)`, [A, SEASON]);
    expect((await adminRequest(db, { action: 'deleteSeason', seasonId: SEASON })).body).toEqual({ ok: true });
    for (const t of ['seasons', 'worlds', 'members', 'score_rows', 'day_reports', 'commands']) {
      expect(await db.query(`select 1 from public.${t}`), t).toEqual([]);
    }
    expect(await db.query('select body from public.feedback')).toEqual([{ body: '좋아요' }]);
  });

  it('예행연습이 아닌 시즌은 지우지 않는다', async () => {
    await setup('closed_test');
    expect((await adminRequest(db, { action: 'deleteSeason', seasonId: SEASON })).body).toEqual({ ok: false, error: 'notRehearsal' });
  });

  it('시험 시즌: 결산 화면은 보이되 증서·결과·명예의 전당은 그대로', async () => {
    await setup('closed_test', true);
    const before = await cert(A);
    const r = await tickDue(db, { now: at(LENGTH + 2) });
    expect(r.settled[0]).toMatchObject({ trial: true, certificates: 0, pioneers: 0, hallOfFame: 0 });
    expect(await cert(A)).toEqual(before);
    expect(await db.query('select * from public.season_results')).toEqual([]);
    expect(await db.query('select * from public.hall_of_fame')).toEqual([]);
    expect((await blobOf('w1')).state.settlement).not.toBeNull();
  });

  it('결산이 끝난 시즌 사이에 상단 이름을 바꿀 수 있고 증서 표에도 옮긴다', async () => {
    await setup();
    await tickDue(db, { now: at(LENGTH + 2) });
    const r = await commandFor(db, A, { type: 'setCompany', name: '새 소금 상단' } as Command);
    expect(r.ok && r.result).toEqual({ ok: true });
    expect((await cert(A)).name).toBe('새 소금 상단');
    // 남의 이름은 안 된다
    expect(await commandFor(db, A, { type: 'setCompany', name: '바람상단' } as Command)).toMatchObject({ ok: false, error: 'nameTaken' });
  });
});

describe('증서 전체를 들고 세계에 앉기', () => {
  it('지난 인장·칭호·연차가 세계의 증서에 그대로', () => {
    const c = createCertificate(3, 7);
    c.name = '오래된 상단';
    c.seasonsCompleted = 2;
    c.titles = ['1시즌 큰손'];
    c.badges = [{ badge: 'season-1', tier: null, season: 1, day: 120 }];
    const s = createEconomy(generateWorld(4), 4, { players: [{ id: A, certificate: c }] });
    expect(getPlayer(s, A).certificate).toEqual(c);
  });
});
