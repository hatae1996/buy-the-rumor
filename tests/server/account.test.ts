// 계정, 초대 코드, 상단 세우기 (작업목록-0.2.0 4번)를 PGlite 위에서
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { accountRequest, checkName, foundCompany, getMe, redeemInvite, setLook } from '../../src/server/account';
import type { Db } from '../../src/server/db';
import { createTestDb } from '../db/pglite';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';

let pg: PGlite;
let db: Db;

// 시뮬이 고를 수 있다고 하는 얼굴과 문장
const sample = createCertificate(42);
const look = { face: sample.face, emblem: sample.emblem };

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  for (const id of [A, B, C]) await db.query('insert into auth.users (id) values ($1)', [id]);
  await db.query(`insert into public.invite_codes (code, uses_left) values ('ABCD2345', 2), ('ZZZZ9999', 0)`);
}, 60_000);

afterEach(async () => {
  await pg.close();
});

describe('초대 코드', () => {
  it('코드 없이 들어온 사람은 초대 코드 화면에서 멈춘다', async () => {
    expect(await getMe(db, A)).toEqual({ ok: false, error: 'noAccount' });
  });

  it('코드를 넣으면 계정과 상인 번호(만든 순서)', async () => {
    expect(await redeemInvite(db, A, 'abcd-2345')).toEqual({ ok: true, value: { merchantNo: 1 } });
    expect(await redeemInvite(db, B, ' ABCD 2345 ')).toEqual({ ok: true, value: { merchantNo: 2 } });
    expect(await getMe(db, A)).toEqual({ ok: true, value: { merchantNo: 1, certificate: null } });
  });

  it('다시 눌러도 코드를 또 쓰지 않는다', async () => {
    await redeemInvite(db, A, 'ABCD2345');
    expect(await redeemInvite(db, A, 'ABCD2345')).toEqual({ ok: true, value: { merchantNo: 1 } });
    const [code] = await db.query<{ uses_left: number }>(`select uses_left from public.invite_codes where code = 'ABCD2345'`);
    expect(code!.uses_left).toBe(1);
  });

  it('없는 코드, 다 쓴 코드', async () => {
    expect(await redeemInvite(db, A, 'NOPE0000')).toEqual({ ok: false, error: 'badCode' });
    expect(await redeemInvite(db, A, 'ZZZZ9999')).toEqual({ ok: false, error: 'codeUsedUp' });
    await redeemInvite(db, A, 'ABCD2345');
    await redeemInvite(db, B, 'ABCD2345');
    expect(await redeemInvite(db, C, 'ABCD2345')).toEqual({ ok: false, error: 'codeUsedUp' });
    expect(await getMe(db, C)).toEqual({ ok: false, error: 'noAccount' });
  });

  it('운영자 함수로 코드를 만든다 (헷갈리는 글자 없이 8자)', async () => {
    const made = await db.query<{ make_invite_codes: string }>(`select * from public.make_invite_codes(5, 1, '시험')`);
    expect(made).toHaveLength(5);
    for (const { make_invite_codes: c } of made) expect(c).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(await redeemInvite(db, A, made[0]!.make_invite_codes)).toMatchObject({ ok: true });
  });
});

describe('상단 세우기 (게임 시작 화면)', () => {
  beforeEach(async () => {
    await redeemInvite(db, A, 'ABCD2345');
    await redeemInvite(db, B, 'ABCD2345');
  });

  it('이름·얼굴·문장으로 증서를 만들고 상인 번호를 단다', async () => {
    const r = await foundCompany(db, A, { name: '  소금   상단 ', ...look });
    expect(r.ok).toBe(true);
    const me = await getMe(db, A);
    expect(me.ok && me.value.certificate).toMatchObject({ name: '소금 상단', merchantNo: 1, face: sample.face, emblem: sample.emblem });
  });

  it('한 번만 세운다', async () => {
    await foundCompany(db, A, { name: '소금 상단', ...look });
    expect(await foundCompany(db, A, { name: '바람 상단', ...look })).toEqual({ ok: false, error: 'alreadyFounded' });
  });

  it('같은 이름은 시즌 전체에서 한 사람 (띄어쓰기·기호가 달라도)', async () => {
    await foundCompany(db, A, { name: '소금 상단', ...look });
    expect(await checkName(db, '소금상단!')).toBe('nameTaken');
    expect(await foundCompany(db, B, { name: '소금상단', ...look })).toEqual({ ok: false, error: 'nameTaken' });
    // 내 이름은 내가 다시 써도 된다 (이름 바꾸기 화면에서)
    expect(await checkName(db, '소금 상단', A)).toBeNull();
  });

  it('금칙어와 운영자가 더한 말', async () => {
    expect(await foundCompany(db, A, { name: '씨 발 상단', ...look })).toEqual({ ok: false, error: 'bannedName' });
    expect(await checkName(db, '두꺼비 상단')).toBeNull();
    await db.query(`insert into public.banned_words (word) values ('두꺼비')`);
    expect(await checkName(db, '두 꺼 비 상단')).toBe('bannedName');
  });

  it('글자 수, 고를 수 없는 얼굴·문장', async () => {
    expect(await foundCompany(db, A, { name: '소', ...look })).toEqual({ ok: false, error: 'badName' });
    expect(await foundCompany(db, A, { name: '소금 상단', face: { nope: 1 }, emblem: look.emblem })).toEqual({ ok: false, error: 'badFace' });
    expect(await foundCompany(db, A, { name: '소금 상단', face: look.face, emblem: { shield: 'x' } })).toEqual({ ok: false, error: 'badEmblem' });
    // 실패하면 아무것도 남지 않는다
    const me = await getMe(db, A);
    expect(me.ok && me.value.certificate).toBeNull();
  });

  it('계정 없이는 세우지 못한다', async () => {
    expect(await foundCompany(db, C, { name: '소금 상단', ...look })).toEqual({ ok: false, error: 'noAccount' });
  });

  it('얼굴과 문장은 언제든 바꾼다', async () => {
    await foundCompany(db, A, { name: '소금 상단', ...look });
    const other = createCertificate(7);
    const r = await setLook(db, A, { emblem: other.emblem });
    expect(r.ok && r.value.emblem).toEqual(other.emblem);
    expect(await setLook(db, A, { face: 'x' })).toEqual({ ok: false, error: 'badFace' });
    expect(await setLook(db, B, { emblem: other.emblem })).toEqual({ ok: false, error: 'notFounded' });
  });
});

describe('account 함수 몸통', () => {
  it('요청을 나눠 부르고, 이상한 요청은 400', async () => {
    expect(await accountRequest(db, A, { action: 'me' })).toEqual({ status: 200, body: { ok: false, error: 'noAccount' } });
    expect(await accountRequest(db, A, { action: 'redeem', code: 'ABCD2345' })).toEqual({ status: 200, body: { ok: true, value: { merchantNo: 1 } } });
    expect(await accountRequest(db, A, { action: 'checkName', name: '소금 상단' })).toEqual({ status: 200, body: { ok: true, value: null } });
    expect((await accountRequest(db, A, { action: 'found', name: '소금 상단', ...look })).body).toMatchObject({ ok: true });
    expect((await accountRequest(db, A, { action: 'nope' })).status).toBe(400);
    expect((await accountRequest(db, A, null)).status).toBe(400);
    expect((await accountRequest(db, A, { action: 'redeem', code: 5 })).status).toBe(400);
  });
});
