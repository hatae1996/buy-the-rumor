// 계정 (작업목록-0.2.0 4번): 초대 코드로 계정을 만들고(상인 번호), 게임 시작 화면에서 받은 상단 이름·얼굴·문장으로 증서를 만든다.
// 로그인 자체(구글, 이메일 링크)는 Supabase Auth가 하고, 이 함수들은 확인된 계정 id(uid)를 받는다.
import { createCertificate, setCompany, setEmblem, setFace } from '../sim/ranking/certificate';
import type { Certificate } from '../sim/ranking/types';
import type { Db } from './db';
import { bannedWordIn, nameKey } from './names';

export type AccountError =
  /** 초대 코드를 아직 안 넣었다 */
  | 'noAccount'
  /** 없는 코드 */
  | 'badCode'
  /** 다 쓴 코드 */
  | 'codeUsedUp'
  /** 이름 글자 수나 글자가 맞지 않는다 */
  | 'badName'
  /** 금칙어 */
  | 'bannedName'
  /** 시즌 전체에 같은 이름(띄어쓰기·기호를 걷어 낸 꼴)이 있다 */
  | 'nameTaken'
  | 'badFace'
  | 'badEmblem'
  /** 이미 상단을 세웠다 (이름은 시즌 사이에만 바꾼다) */
  | 'alreadyFounded'
  /** 아직 상단을 세우지 않았다 */
  | 'notFounded'
  | 'badRequest';

export type Result<T> = { ok: true; value: T } | { ok: false; error: AccountError };

const fail = (error: AccountError): { ok: false; error: AccountError } => ({ ok: false, error });

export interface Me {
  merchantNo: number;
  /** 상단을 세우기 전이면 null (게임 시작 화면으로) */
  certificate: Certificate | null;
}

/** 내 계정. 초대 코드를 안 넣었으면 noAccount ("초대 코드를 넣어 주세요" 화면) */
export async function getMe(db: Db, uid: string): Promise<Result<Me>> {
  const [row] = await db.query<{ merchant_no: number; cert: string | null }>(
    `update public.accounts a set last_seen_at = now()
      where a.id = $1
      returning a.merchant_no, (select c.cert::text from public.certificates c where c.account_id = a.id) as cert`,
    [uid],
  );
  if (!row) return fail('noAccount');
  return { ok: true, value: { merchantNo: row.merchant_no, certificate: row.cert ? (JSON.parse(row.cert) as Certificate) : null } };
}

/** 초대 코드 모양: 앞뒤 빈칸·하이픈을 걷고 대문자로 */
export const cleanInviteCode = (code: string): string => code.replace(/[\s-]/g, '').toUpperCase();

/** 초대 코드를 넣어 계정을 만든다. 이미 계정이 있으면 코드를 쓰지 않고 그 계정을 돌려준다 (다시 눌러도 안전) */
export async function redeemInvite(db: Db, uid: string, code: string): Promise<Result<{ merchantNo: number }>> {
  return db.transaction(async (tx) => {
    const [had] = await tx.query<{ merchant_no: number }>('select merchant_no from public.accounts where id = $1', [uid]);
    if (had) return { ok: true, value: { merchantNo: had.merchant_no } };
    const c = cleanInviteCode(code);
    const [used] = await tx.query<{ code: string }>(
      'update public.invite_codes set uses_left = uses_left - 1 where code = $1 and uses_left > 0 returning code',
      [c],
    );
    if (!used) {
      const [exists] = await tx.query('select 1 from public.invite_codes where code = $1', [c]);
      return fail(exists ? 'codeUsedUp' : 'badCode');
    }
    const [made] = await tx.query<{ merchant_no: number }>('insert into public.accounts (id, invite_code) values ($1, $2) returning merchant_no', [
      uid,
      c,
    ]);
    return { ok: true, value: { merchantNo: made!.merchant_no } };
  });
}

/** 운영자가 더한 금칙어 */
async function extraBanned(db: Db): Promise<string[]> {
  return (await db.query<{ word: string }>('select word from public.banned_words')).map((r) => r.word);
}

/**
 * 상단 이름을 써도 되는가 (게임 시작 화면 1단계에서 그 자리에서 보여 준다).
 * 금칙어, 글자 수, 시즌 전체 같은 이름. except: 내 이름이면 같은 이름으로 치지 않는다
 */
export async function checkName(db: Db, name: string, except: string | null = null): Promise<AccountError | null> {
  const clean = createCertificate();
  if (setCompany(clean, name) !== null) return 'badName';
  if (bannedWordIn(clean.name, await extraBanned(db))) return 'bannedName';
  const [taken] = await db.query<{ account_id: string }>('select account_id from public.certificates where name_key = $1', [nameKey(clean.name)]);
  if (taken && taken.account_id !== except) return 'nameTaken';
  return null;
}

export interface Founding {
  name: string;
  face: unknown;
  emblem: unknown;
}

/** 게임 시작 화면을 마친다: 상단 이름 → 얼굴 → 문장 (0.1.7 답 129). 한 계정에 한 번 */
export async function foundCompany(db: Db, uid: string, f: Founding): Promise<Result<Certificate>> {
  return db.transaction(async (tx) => {
    const [acc] = await tx.query<{ merchant_no: number; founded: boolean }>(
      'select merchant_no, exists (select 1 from public.certificates where account_id = $1) as founded from public.accounts where id = $1',
      [uid],
    );
    if (!acc) return fail('noAccount');
    if (acc.founded) return fail('alreadyFounded');
    const nameError = await checkName(tx, f.name);
    if (nameError) return fail(nameError);
    const cert = createCertificate(acc.merchant_no, acc.merchant_no);
    setCompany(cert, f.name);
    if (setFace(cert, f.face)) return fail('badFace');
    if (setEmblem(cert, f.emblem)) return fail('badEmblem');
    // 같은 때 같은 이름을 넣은 두 사람: 유일 색인이 하나만 받는다
    const [saved] = await tx.query<{ account_id: string }>(
      `insert into public.certificates (account_id, name, name_key, cert) values ($1, $2, $3, $4::text::json)
       on conflict (name_key) do nothing returning account_id`,
      [uid, cert.name, nameKey(cert.name), JSON.stringify(cert)],
    );
    if (!saved) return fail('nameTaken');
    return { ok: true, value: cert };
  });
}

/** 얼굴이나 문장을 바꾼다 (언제든). 들어가 있는 세계의 증서는 명령(setFace, setEmblem)으로 함께 바뀐다 (5번) */
export async function setLook(db: Db, uid: string, look: { face?: unknown; emblem?: unknown }): Promise<Result<Certificate>> {
  return db.transaction(async (tx) => {
    const [row] = await tx.query<{ cert: string }>('select cert::text as cert from public.certificates where account_id = $1 for update', [uid]);
    if (!row) return fail('notFounded');
    const cert = JSON.parse(row.cert) as Certificate;
    if (look.face !== undefined && setFace(cert, look.face)) return fail('badFace');
    if (look.emblem !== undefined && setEmblem(cert, look.emblem)) return fail('badEmblem');
    await tx.query('update public.certificates set cert = $2::text::json, updated_at = now() where account_id = $1', [uid, JSON.stringify(cert)]);
    return { ok: true, value: cert };
  });
}

/** 명예의 전당 한 줄: 부문과 그 부문 1위 상단 이름 */
export interface HallOfFameEntry {
  category: string;
  name: string;
}

/**
 * 지난 시즌 명예의 전당 (0.2.1, 답 138): 대기 화면에 보인다. 명예의 전당을 남긴 가장 최근 끝난 시즌.
 * 시험 시즌·예행연습은 남기지 않으니(10번) 첫 시즌이면 null (화면은 그 줄을 숨긴다)
 */
export async function lastHallOfFame(db: Db): Promise<{ seasonId: string; entries: HallOfFameEntry[] } | null> {
  const rows = await db.query<{ season_id: string; category: string; name: string }>(
    `select h.season_id, h.category, h.name from public.hall_of_fame h
      where h.season_id = (select s.id from public.seasons s
                            where s.status = 'ended' and exists (select 1 from public.hall_of_fame x where x.season_id = s.id)
                            order by s.opens_at desc limit 1)
      order by h.category`,
  );
  if (!rows.length) return null;
  return { seasonId: rows[0]!.season_id, entries: rows.map((r) => ({ category: r.category, name: r.name })) };
}

/** account 함수가 받는 요청 */
export type AccountRequest =
  | { action: 'me' }
  | { action: 'redeem'; code: string }
  | { action: 'checkName'; name: string }
  | { action: 'found'; name: string; face: unknown; emblem: unknown }
  | { action: 'setLook'; face?: unknown; emblem?: unknown }
  | { action: 'hallOfFame' };

/** account Edge Function의 몸통: 요청 하나 → 응답 (상태 코드와 JSON) */
export async function accountRequest(db: Db, uid: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const req = body as Partial<AccountRequest> | null;
  const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 100;
  let r: Result<unknown>;
  switch (req?.action) {
    case 'me':
      r = await getMe(db, uid);
      break;
    case 'redeem':
      r = str(req.code) ? await redeemInvite(db, uid, req.code) : fail('badRequest');
      break;
    case 'checkName': {
      const e = str(req.name) ? await checkName(db, req.name, uid) : 'badRequest';
      r = e ? fail(e) : { ok: true, value: null };
      break;
    }
    case 'found':
      r = str(req.name) ? await foundCompany(db, uid, { name: req.name, face: req.face, emblem: req.emblem }) : fail('badRequest');
      break;
    case 'setLook':
      r = await setLook(db, uid, { face: req.face, emblem: req.emblem });
      break;
    case 'hallOfFame':
      r = { ok: true, value: await lastHallOfFame(db) };
      break;
    default:
      r = fail('badRequest');
  }
  return r.ok ? { status: 200, body: { ok: true, value: r.value } } : { status: r.error === 'badRequest' ? 400 : 200, body: r };
}
