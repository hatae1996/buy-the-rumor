// 명령 받기와 화면 데이터 (작업목록-0.2.0 5번). 폰은 명령(Command)만 보내고, 서버가 세계를 잠가 적용하고 저장한 뒤
// 그 사람이 아는 것(playerView)과 지금 마을의 얼굴만 돌려준다. 숨은 숫자는 폰에 가지 않는다.
// - 세계 행을 잠그고(장날 tick과 같은 잠금) 적용하므로, 장날이 도는 동안 온 명령은 장날이 끝난 뒤 다음 날 신청이 된다.
// - 받은 명령은 성공·실패 모두 commands 표에 남긴다(원인 찾기, 기록 표의 "시스템을 쓰는지").
// - 증서를 바꾸는 명령(이름, 얼굴, 문장, 인장 달기, 칭호)은 certificates 표에도 옮긴다.
import { getPlayer, type Command, type CommandResult } from '../sim/economy';
import { commandWorld, screenData, SimVersionMismatch, type ScreenData, type WorldBlob } from '../sim/service';
import { checkName, type AccountError } from './account';
import type { Db } from './db';
import { mapFor } from './maps';
import { bannedWordIn, nameKey } from './names';

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
  | 'badRequest';

export interface Screen extends ScreenData {
  seasonId: string;
  worldId: string;
  /** 세계가 멈췄으면 그 이유 (화면은 보이되 명령은 받지 않는다) */
  halted: string | null;
}

interface Membership {
  season_id: string;
  world_id: string;
}

/** 지금 들어가 있는 공유 세계 (끝나지 않은 시즌 중 가장 최근) */
async function membership(db: Db, uid: string): Promise<Membership | null> {
  const [m] = await db.query<Membership>(
    `select m.season_id, m.world_id from public.members m join public.seasons s on s.id = m.season_id
      where m.account_id = $1 and s.status <> 'ended'
      order by s.opens_at desc limit 1`,
    [uid],
  );
  return m ?? null;
}

function screenOf(m: Membership, blob: WorldBlob, uid: string, halted: string | null): Screen {
  return { seasonId: m.season_id, worldId: m.world_id, halted, ...screenData(blob, mapFor(m.season_id), uid) };
}

/** 화면 데이터. 잠그지 않고 읽는다 */
export async function viewFor(db: Db, uid: string): Promise<{ ok: true; screen: Screen } | { ok: false; error: GameError }> {
  const m = await membership(db, uid);
  if (!m) return { ok: false, error: 'noWorld' };
  const [w] = await db.query<{ state: string; halted: string | null }>('select state::text as state, halted from public.worlds where season_id = $1 and id = $2', [
    m.season_id,
    m.world_id,
  ]);
  if (!w) return { ok: false, error: 'noWorld' };
  return { ok: true, screen: screenOf(m, JSON.parse(w.state) as WorldBlob, uid, w.halted) };
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
    if (!m) return { ok: false, error: 'noWorld' };
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
      await logCommand(tx, m, uid, blob.state.day, text, refused);
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
    await logCommand(tx, m, uid, day, text, result.ok ? null : result.error);
    return { ok: true, result, screen: screenOf(m, blob, uid, null) };
  });
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

async function logCommand(db: Db, m: Membership, uid: string, day: number, cmd: string, error: string | null): Promise<void> {
  await db.query('insert into public.commands (season_id, world_id, account_id, day, cmd, error) values ($1, $2, $3, $4, $5::text::json, $6)', [
    m.season_id,
    m.world_id,
    uid,
    day,
    cmd,
    error,
  ]);
}

/** game Edge Function의 몸통 */
export async function gameRequest(db: Db, uid: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const req = body as { action?: unknown; cmd?: unknown } | null;
  switch (req?.action) {
    case 'view':
      return { status: 200, body: await viewFor(db, uid) };
    case 'command': {
      const r = await commandFor(db, uid, req.cmd);
      return { status: !r.ok && r.error === 'badRequest' ? 400 : 200, body: r };
    }
    default:
      return { status: 400, body: { ok: false, error: 'badRequest' } };
  }
}
