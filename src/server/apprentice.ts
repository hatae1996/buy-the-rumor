// 견습 세계 (작업목록-0.2.0 7번, 답 111): 계정마다 시즌마다 혼자 쓰는 작은 세계(apprentice_worlds).
// 공유 세계와 달리 장날 tick이 돌리지 않고, "하루 보내기"로만 날이 간다. 졸업 장면에서 길을 떠나면
// 그날의 공유 세계에 들인다(8번이 어느 세계에 넣을지 정한다. 지금은 사람이 가장 적고 자리가 남은 세계).
import { getPlayer, type Command, type CommandResult } from '../sim/economy';
import type { Certificate } from '../sim/ranking/types';
import {
  awaySummary,
  commandWorld,
  enterWorld,
  graduationKit,
  isGraduation,
  openApprentice,
  SimVersionMismatch,
  tickWorld,
  type AwaySummary,
  type PlayerSpec,
  type WorldBlob,
} from '../sim/service';
import type { Db } from './db';
import { mapFor } from './maps';

/** 세계 하나에 사람과 봇을 합쳐 (worlds 표의 check와 같다) */
export const WORLD_CAP = 15;

export type ApprenticeError =
  /** 열린 시즌이 없다 */
  | 'noSeason'
  /** 상단을 세우지 않았다 (게임 시작 화면부터) */
  | 'notFounded'
  /** 이미 공유 세계에 들어가 있다 */
  | 'alreadyInWorld'
  /** 견습 중이 아니다 */
  | 'notApprentice'
  /** 들어갈 세계가 모두 찼다 ("다음 시즌을 기다려 주세요", 8번) */
  | 'worldsFull'
  | 'worldHalted';

/** 지금 하고 있는 견습 (열린 시즌, 아직 졸업 전) */
export async function currentApprentice(db: Db, uid: string): Promise<string | null> {
  const [r] = await db.query<{ season_id: string }>(
    `select a.season_id from public.apprentice_worlds a join public.seasons s on s.id = a.season_id
      where a.account_id = $1 and a.graduated_at is null and s.status = 'open'
      order by s.opens_at desc limit 1`,
    [uid],
  );
  return r?.season_id ?? null;
}

/** 증서로 세계에 앉을 자리 */
export async function specOf(db: Db, uid: string): Promise<PlayerSpec | null> {
  const [r] = await db.query<{ cert: string }>('select cert::text as cert from public.certificates where account_id = $1', [uid]);
  if (!r) return null;
  const c = JSON.parse(r.cert) as Certificate;
  return { id: uid, name: c.name, face: c.face, emblem: c.emblem, merchantNo: c.merchantNo };
}

/** 견습을 연다 (게임 시작 화면을 마친 뒤). 이미 하고 있으면 그것을 그대로 */
export async function startApprentice(db: Db, uid: string, inWorld: boolean): Promise<{ ok: true; seasonId: string } | { ok: false; error: ApprenticeError }> {
  if (inWorld) return { ok: false, error: 'alreadyInWorld' };
  const had = await currentApprentice(db, uid);
  if (had) return { ok: true, seasonId: had };
  const spec = await specOf(db, uid);
  if (!spec) return { ok: false, error: 'notFounded' };
  const [season] = await db.query<{ id: string }>(`select id from public.seasons where status = 'open' order by opens_at desc limit 1`);
  if (!season) return { ok: false, error: 'noSeason' };
  const blob = openApprentice(mapFor(season.id), { seasonId: season.id, spec });
  await db.query(
    `insert into public.apprentice_worlds (account_id, season_id, state, sim_version) values ($1, $2, $3::text::json, $4)
     on conflict (account_id, season_id) do nothing`,
    [uid, season.id, JSON.stringify(blob), blob.simVersion],
  );
  return { ok: true, seasonId: season.id };
}

export async function readApprentice(db: Db, uid: string, seasonId: string, lock: boolean): Promise<WorldBlob | null> {
  const [r] = await db.query<{ state: string }>(
    `select state::text as state from public.apprentice_worlds where account_id = $1 and season_id = $2${lock ? ' for update' : ''}`,
    [uid, seasonId],
  );
  return r ? (JSON.parse(r.state) as WorldBlob) : null;
}

async function saveApprentice(db: Db, uid: string, seasonId: string, blob: WorldBlob): Promise<void> {
  await db.query('update public.apprentice_worlds set state = $3::text::json, rev = rev + 1 where account_id = $1 and season_id = $2', [
    uid,
    seasonId,
    JSON.stringify(blob),
  ]);
}

/** 견습의 "하루 보내기": 이 견습 세계만 다음 날로 (봇 없음). 지난 하루의 요약을 돌려준다 */
export async function passApprenticeDay(tx: Db, uid: string, seasonId: string): Promise<{ ok: true; summary: AwaySummary; blob: WorldBlob } | { ok: false; error: ApprenticeError }> {
  const blob = await readApprentice(tx, uid, seasonId, true);
  if (!blob) return { ok: false, error: 'notApprentice' };
  const map = mapFor(seasonId);
  const fromDay = blob.state.day;
  let r;
  try {
    r = tickWorld(blob, map, [uid]);
  } catch (e) {
    if (e instanceof SimVersionMismatch) return { ok: false, error: 'worldHalted' };
    throw e;
  }
  if (!r) return { ok: false, error: 'notApprentice' };
  await saveApprentice(tx, uid, seasonId, blob);
  return { ok: true, summary: awaySummary(blob.state, map, uid, [r.digests[uid]!], fromDay), blob };
}

export type ApprenticeCommandResult =
  | { kind: 'apprentice'; result: CommandResult; blob: WorldBlob; day: number }
  | { kind: 'graduated'; worldId: string; result: CommandResult; blob: WorldBlob; day: number }
  | { kind: 'error'; error: ApprenticeError; blob?: WorldBlob };

/** 견습 세계의 명령. 졸업 장면에서 길을 떠나는 명령이면 공유 세계에 들인다 */
export async function apprenticeCommand(tx: Db, uid: string, seasonId: string, cmd: Command): Promise<ApprenticeCommandResult> {
  const blob = await readApprentice(tx, uid, seasonId, true);
  if (!blob) return { kind: 'error', error: 'notApprentice' };
  const map = mapFor(seasonId);
  if (isGraduation(blob, uid, cmd)) return graduate(tx, uid, seasonId, blob, cmd);
  let result: CommandResult;
  try {
    result = commandWorld(blob, map, uid, cmd);
  } catch (e) {
    if (e instanceof SimVersionMismatch) return { kind: 'error', error: 'worldHalted', blob };
    throw e;
  }
  if (result.ok) await saveApprentice(tx, uid, seasonId, blob);
  return { kind: 'apprentice', result, blob, day: blob.state.day };
}

/** 졸업: 들어갈 세계를 골라 잠그고, 견습에서 들고 나온 것으로 앉히고, 그 길을 떠난다 */
async function graduate(
  tx: Db,
  uid: string,
  seasonId: string,
  apprentice: WorldBlob,
  travel: Extract<Command, { type: 'travel' }>,
): Promise<ApprenticeCommandResult> {
  const [w] = await tx.query<{ id: string; state: string }>(
    `select id, state::text as state from public.worlds
      where season_id = $1 and not settled and halted is null and humans + bots < $2
      order by humans, id limit 1 for update`,
    [seasonId, WORLD_CAP],
  );
  if (!w) return { kind: 'error', error: 'worldsFull', blob: apprentice };
  const shared = JSON.parse(w.state) as WorldBlob;
  const c = getPlayer(apprentice.state, uid).certificate;
  const spec: PlayerSpec = { id: uid, name: c.name, face: c.face, emblem: c.emblem, merchantNo: c.merchantNo };
  let result: CommandResult;
  try {
    result = enterWorld(shared, mapFor(seasonId), spec, graduationKit(apprentice, uid), travel);
  } catch (e) {
    if (e instanceof SimVersionMismatch) return { kind: 'error', error: 'worldHalted', blob: apprentice };
    throw e;
  }
  // 길을 못 떠나도(짐이 너무 무겁다 등) 공유 세계에는 들어왔다. 그 마을에서 다시 떠나면 된다
  const day = shared.state.day;
  await tx.query('update public.worlds set state = $3::text::json, humans = humans + 1, rev = rev + 1 where season_id = $1 and id = $2', [
    seasonId,
    w.id,
    JSON.stringify(shared),
  ]);
  await tx.query('insert into public.members (season_id, world_id, account_id, joined_day, seen_day) values ($1, $2, $3, $4, $4)', [
    seasonId,
    w.id,
    uid,
    day,
  ]);
  await tx.query('update public.apprentice_worlds set graduated_at = now() where account_id = $1 and season_id = $2', [uid, seasonId]);
  return { kind: 'graduated', worldId: w.id, result, blob: shared, day };
}
