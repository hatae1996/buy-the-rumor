// 명령 받기와 화면 데이터 (작업목록-0.2.0 5번). 폰은 명령(Command)만 보내고, 서버가 세계를 잠가 적용하고 저장한 뒤
// 그 사람이 아는 것(playerView)과 지금 마을의 얼굴만 돌려준다. 숨은 숫자는 폰에 가지 않는다.
// - 세계 행을 잠그고(장날 tick과 같은 잠금) 적용하므로, 장날이 도는 동안 온 명령은 장날이 끝난 뒤 다음 날 신청이 된다.
// - 받은 명령은 성공·실패 모두 commands 표에 남긴다(원인 찾기, 기록 표의 "시스템을 쓰는지").
// - 증서를 바꾸는 명령(이름, 얼굴, 문장, 인장 달기, 칭호)은 certificates 표에도 옮긴다.
// - 화면 데이터에는 "자리를 비운 사이"(마지막으로 본 날부터 장날 하루치 기록을 모은 것)를 붙인다 (6번).
//   폰이 보여 준 뒤 seen으로 본 날을 올린다. 알림은 화면 안 알림만이고, 조용한 시간에 생긴 것은 띠로 띄우지 않는다.
// - 공유 세계에 들기 전에는 견습 세계(7번)가 화면과 명령을 받는다(place: 'apprentice'). 졸업 명령이면 공유 세계에 들인다.
// - 시즌 전체 순위는 화면 데이터를 만들 때 다른 세계의 최신 점수 줄을 합쳐 매긴다(10번). 끝난 시즌의 세계는
//   다음 시즌이 열릴 때까지 결산 화면으로 보인다(이름 바꾸기 같은 시즌 사이 명령도 받는다).
import { getPlayer, type Command, type CommandResult } from '../sim/economy';
import { updateRankings } from '../sim/ranking';
import { planDelivery, type DeliveryPlan } from '../sim/notify';
import { awaySummary, commandWorld, screenData, SimVersionMismatch, type AwaySummary, type PlayerDigest, type ScreenData, type WorldBlob } from '../sim/service';
import { checkName, type AccountError } from './account';
import { apprenticeCommand, currentApprentice, passApprenticeDay, readApprentice, startApprentice, type ApprenticeError } from './apprentice';
import type { Db } from './db';
import { mapFor } from './maps';
import { bannedWordIn, nameKey } from './names';
import { kstHour } from './schedule';
import { seasonRows } from './settle';

/** 폰이 보낸 명령 하나의 글자 수 상한 (수레 짐 다시 놓기가 가장 길다) */
const MAX_COMMAND_CHARS = 20_000;

const CERTIFICATE_COMMANDS: ReadonlySet<string> = new Set(['setCompany', 'setFace', 'setEmblem', 'pinBadges', 'setTitle']);

export type GameError =
  /** 들어간 공유 세계가 없다 (견습 중이거나 배정을 기다림, 7·8번) */
  | 'noWorld'
  /** 세계가 멈췄다 (시뮬 버전이 다르다 등, 운영자가 푼다) */
  | 'worldHalted'
  /** 금칙어 (말 이름, 상단 이름) */
  | 'bannedName'
  /** 같은 상단 이름이 있다 */
  | 'nameTaken'
  | 'badRequest'
  | ApprenticeError;

export interface Screen extends ScreenData {
  /** 공유 세계인가 견습 세계인가 */
  place: 'world' | 'apprentice';
  seasonId: string;
  worldId: string;
  /** 세계가 멈췄으면 그 이유 (화면은 보이되 명령은 받지 않는다) */
  halted: string | null;
}

interface Membership {
  season_id: string;
  world_id: string;
  /** 시즌 상태 (ended면 결산이 끝난 세계: 결산 화면과 시즌 사이 명령만) */
  status?: string;
}

/**
 * 지금 들어가 있는 공유 세계: 가장 최근에 들어간 시즌. 그 시즌이 끝났고 더 새 시즌이 열려 있으면 없음
 * (새 시즌의 견습이나 배정으로)
 */
async function membership(db: Db, uid: string): Promise<Membership | null> {
  const [m] = await db.query<Membership>(
    `select m.season_id, m.world_id, s.status from public.members m join public.seasons s on s.id = m.season_id
      where m.account_id = $1
        and not (s.status = 'ended' and exists (select 1 from public.seasons n where n.status = 'open' and n.opens_at > s.opens_at))
      order by s.opens_at desc limit 1`,
    [uid],
  );
  return m ?? null;
}

/** 시즌 전체 순위를 같은 시즌의 다른 세계 점수 줄과 합쳐 다시 매긴다 (저장하지 않는 화면용, 결산 뒤에는 결산 표를 쓴다) */
async function withSeasonRanking(db: Db, m: Membership, blob: WorldBlob): Promise<WorldBlob> {
  const r = blob.state.rankings;
  if (r && !blob.state.settlement) updateRankings(blob.state, await seasonRows(db, m.season_id, m.world_id, r.day), r.day);
  return blob;
}

function screenOf(m: Membership, blob: WorldBlob, uid: string, halted: string | null): Screen {
  return { place: 'world', seasonId: m.season_id, worldId: m.world_id, halted, ...screenData(blob, mapFor(m.season_id), uid) };
}

function apprenticeScreen(seasonId: string, blob: WorldBlob, uid: string): Screen {
  return { place: 'apprentice', seasonId, worldId: blob.state.world.worldId, halted: null, ...screenData(blob, mapFor(seasonId), uid) };
}

export interface Away {
  summary: AwaySummary;
  /**
   * 화면 안 알림을 어떻게 보일지 (기획서 "알림", handoff 0.2.0 8번): send는 지금 띠로, later는 조용한 시간이라
   * 띠 없이 요약에만, toSummary는 하루 상한을 넘어 요약에만. 켜 둔 종류만, 한국 시간으로
   */
  delivery: DeliveryPlan;
}

/** 화면 데이터와 자리를 비운 사이. 잠그지 않고 읽는다. now는 조용한 시간을 가를 실제 시각 */
export async function viewFor(
  db: Db,
  uid: string,
  now = Date.now(),
): Promise<{ ok: true; screen: Screen; away: Away | null } | { ok: false; error: GameError }> {
  const m = await membership(db, uid);
  if (!m) {
    // 견습 중이면 견습 세계 (견습은 하루 보내기로만 날이 가 자리를 비운 사이가 없다)
    const season = await currentApprentice(db, uid);
    const blob = season ? await readApprentice(db, uid, season, false) : null;
    return season && blob ? { ok: true, screen: apprenticeScreen(season, blob, uid), away: null } : { ok: false, error: 'noWorld' };
  }
  const [w] = await db.query<{ state: string; halted: string | null; seen_day: number }>(
    `select w.state::text as state, w.halted, m.seen_day from public.worlds w
       join public.members m on m.season_id = w.season_id and m.world_id = w.id and m.account_id = $3
      where w.season_id = $1 and w.id = $2`,
    [m.season_id, m.world_id, uid],
  );
  if (!w) return { ok: false, error: 'noWorld' };
  const blob = await withSeasonRanking(db, m, JSON.parse(w.state) as WorldBlob);
  return { ok: true, screen: screenOf(m, blob, uid, w.halted), away: await awayOf(db, m, blob, uid, w.seen_day, now) };
}

/** 마지막으로 본 날부터 돌린 장날이 있으면 모아 요약한다 */
async function awayOf(db: Db, m: Membership, blob: WorldBlob, uid: string, seenDay: number, now: number): Promise<Away | null> {
  if (blob.state.day <= seenDay) return null;
  const rows = await db.query<{ report: string }>(
    'select report::text as report from public.day_reports where season_id = $1 and account_id = $2 and day >= $3 order by day',
    [m.season_id, uid, seenDay],
  );
  if (!rows.length) return null;
  const digests = rows.map((r) => JSON.parse(r.report) as PlayerDigest);
  const summary = awaySummary(blob.state, mapFor(m.season_id), uid, digests, seenDay);
  return { summary, delivery: planDelivery(summary.notices, getPlayer(blob.state, uid).notify, kstHour(now), 0) };
}

/** "자리를 비운 사이"를 보여 주었다: 본 날을 올린다 (내려가지 않고, 세계의 오늘을 넘지 않는다) */
export async function markSeen(db: Db, uid: string, day: unknown): Promise<{ ok: true; seenDay: number } | { ok: false; error: GameError }> {
  if (!Number.isInteger(day)) return { ok: false, error: 'badRequest' };
  const m = await membership(db, uid);
  if (!m) return { ok: false, error: 'noWorld' };
  const [r] = await db.query<{ seen_day: number }>(
    `update public.members m set seen_day = greatest(m.seen_day, least($4::int, w.day))
       from public.worlds w
      where m.season_id = $1 and m.world_id = $2 and m.account_id = $3 and w.season_id = m.season_id and w.id = m.world_id
      returning m.seen_day`,
    [m.season_id, m.world_id, uid, day],
  );
  return r ? { ok: true, seenDay: r.seen_day } : { ok: false, error: 'noWorld' };
}

export type CommandReply =
  | { ok: true; result: CommandResult; screen: Screen }
  | { ok: false; error: GameError | AccountError; screen?: Screen };

/** 명령 하나: 잠그고, 적용하고, 성공하면 저장하고, 기록을 남기고, 새 화면 데이터를 돌려준다 */
export async function commandFor(db: Db, uid: string, cmd: unknown): Promise<CommandReply> {
  const text = JSON.stringify(cmd ?? null);
  if (!cmd || typeof cmd !== 'object' || typeof (cmd as { type?: unknown }).type !== 'string' || text.length > MAX_COMMAND_CHARS) {
    return { ok: false, error: 'badRequest' };
  }
  const c = cmd as Command;
  return db.transaction(async (tx) => {
    const m = await membership(tx, uid);
    if (!m) return apprenticeCommandFor(tx, uid, c, text);
    const [w] = await tx.query<{ state: string; halted: string | null }>(
      'select state::text as state, halted from public.worlds where season_id = $1 and id = $2 for update',
      [m.season_id, m.world_id],
    );
    if (!w) return { ok: false, error: 'noWorld' };
    const blob = JSON.parse(w.state) as WorldBlob;
    if (w.halted) return { ok: false, error: 'worldHalted', screen: screenOf(m, blob, uid, w.halted) };

    // 남에게 보이는 글자는 서버가 먼저 거른다
    const refused = await refuseText(tx, uid, c);
    if (refused) {
      await logCommand(tx, m.season_id, m.world_id, uid, blob.state.day, text, refused);
      return { ok: false, error: refused, screen: screenOf(m, blob, uid, null) };
    }

    let result: CommandResult;
    try {
      result = commandWorld(blob, mapFor(m.season_id), uid, c);
    } catch (e) {
      if (!(e instanceof SimVersionMismatch)) throw e;
      return { ok: false, error: 'worldHalted', screen: screenOf(m, blob, uid, e.message) };
    }
    const day = blob.state.day;
    if (result.ok) {
      await tx.query('update public.worlds set state = $3::text::json, rev = rev + 1 where season_id = $1 and id = $2', [
        m.season_id,
        m.world_id,
        JSON.stringify(blob),
      ]);
      if (CERTIFICATE_COMMANDS.has(c.type)) {
        const cert = getPlayer(blob.state, uid).certificate;
        await tx.query('update public.certificates set name = $2, name_key = $3, cert = $4::text::json, updated_at = now() where account_id = $1', [
          uid,
          cert.name,
          nameKey(cert.name),
          JSON.stringify(cert),
        ]);
      }
    }
    await logCommand(tx, m.season_id, m.world_id, uid, day, text, result.ok ? null : result.error);
    return { ok: true, result, screen: screenOf(m, await withSeasonRanking(tx, m, blob), uid, null) };
  });
}

/** 공유 세계에 들기 전: 견습 세계의 명령 (졸업이면 공유 세계에 들인다) */
async function apprenticeCommandFor(tx: Db, uid: string, c: Command, text: string): Promise<CommandReply> {
  const season = await currentApprentice(tx, uid);
  if (!season) return { ok: false, error: 'noWorld' };
  const refused = await refuseText(tx, uid, c);
  if (refused) return { ok: false, error: refused };
  const r = await apprenticeCommand(tx, uid, season, c);
  if (r.kind === 'error') return { ok: false, error: r.error, ...(r.blob ? { screen: apprenticeScreen(season, r.blob, uid) } : {}) };
  if (r.kind === 'graduated') {
    await logCommand(tx, season, r.worldId, uid, r.day, text, r.result.ok ? null : r.result.error);
    const m = { season_id: season, world_id: r.worldId };
    return { ok: true, result: r.result, screen: screenOf(m, await withSeasonRanking(tx, m, r.blob), uid, null) };
  }
  await logCommand(tx, season, null, uid, r.day, text, r.result.ok ? null : r.result.error);
  return { ok: true, result: r.result, screen: apprenticeScreen(season, r.blob, uid) };
}

/** 말 이름과 상단 이름(시즌 사이): 금칙어와 같은 이름. 시뮬은 글자 수만 본다 */
async function refuseText(db: Db, uid: string, c: Command): Promise<GameError | null> {
  if (c.type === 'nameHorse') {
    const extra = (await db.query<{ word: string }>('select word from public.banned_words')).map((r) => r.word);
    return bannedWordIn(String(c.name ?? ''), extra) ? 'bannedName' : null;
  }
  if (c.type === 'setCompany') {
    const e = await checkName(db, String(c.name ?? ''), uid);
    // 글자 수는 시뮬이 답한다 (badName)
    return e === 'bannedName' || e === 'nameTaken' ? e : null;
  }
  return null;
}

/** 받은 명령 기록. 견습 세계의 명령은 세계 id 없이 */
async function logCommand(db: Db, seasonId: string, worldId: string | null, uid: string, day: number, cmd: string, error: string | null): Promise<void> {
  await db.query('insert into public.commands (season_id, world_id, account_id, day, cmd, error) values ($1, $2, $3, $4, $5::text::json, $6)', [
    seasonId,
    worldId,
    uid,
    day,
    cmd,
    error,
  ]);
}

/** 견습의 "하루 보내기" (공유 세계에서는 장날을 기다린다) */
export async function passDayFor(db: Db, uid: string): Promise<{ ok: true; summary: AwaySummary; screen: Screen } | { ok: false; error: GameError }> {
  return db.transaction(async (tx) => {
    const season = (await membership(tx, uid)) ? null : await currentApprentice(tx, uid);
    if (!season) return { ok: false, error: 'notApprentice' };
    const r = await passApprenticeDay(tx, uid, season);
    return r.ok ? { ok: true, summary: r.summary, screen: apprenticeScreen(season, r.blob, uid) } : r;
  });
}

/** game Edge Function의 몸통 */
export async function gameRequest(db: Db, uid: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const req = body as { action?: unknown; cmd?: unknown } | null;
  switch (req?.action) {
    case 'view':
      return { status: 200, body: await viewFor(db, uid) };
    case 'seen': {
      const r = await markSeen(db, uid, (req as { day?: unknown }).day);
      return { status: !r.ok && r.error === 'badRequest' ? 400 : 200, body: r };
    }
    case 'command': {
      const r = await commandFor(db, uid, req.cmd);
      return { status: !r.ok && r.error === 'badRequest' ? 400 : 200, body: r };
    }
    case 'startApprentice': {
      const m = await membership(db, uid);
      const r = await startApprentice(db, uid, m !== null && m.status !== 'ended');
      return { status: 200, body: r.ok ? await viewFor(db, uid) : r };
    }
    case 'passDay':
      return { status: 200, body: await passDayFor(db, uid) };
    default:
      return { status: 400, body: { ok: false, error: 'badRequest' } };
  }
}
