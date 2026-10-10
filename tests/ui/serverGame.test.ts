// 폰의 서버 게임 (작업목록-0.2.0 11번): 가짜 연결이 서버 코드를 PGlite 위에서 바로 부른다(네트워크 없이)
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Command } from '../../src/sim/economy';
import { createCertificate } from '../../src/sim/ranking/certificate';
import { accountRequest, foundCompany, redeemInvite } from '../../src/server/account';
import type { Db } from '../../src/server/db';
import { gameRequest } from '../../src/server/game';
import { DAY_MS } from '../../src/server/schedule';
import { openSeason, seasonOpensAt } from '../../src/server/season';
import { tickDue } from '../../src/server/tick';
import { ApiError, type Api } from '../../src/ui/net/api';
import { ServerGame } from '../../src/ui/net/serverGame';
import { createTestDb } from '../db/pglite';
import { walkApprentice } from '../helpers/apprentice';

const SEASON = '2026-10-26';
const A = '00000000-0000-0000-0000-00000000000a';

let pg: PGlite;
let db: Db;

function api(uid: string, offline = { on: false }): Api {
  return {
    async call<T>(fn: 'game' | 'account', body: unknown): Promise<T> {
      if (offline.on) throw new ApiError(null, 'offline');
      const r = fn === 'game' ? await gameRequest(db, uid, body) : await accountRequest(db, uid, body);
      return r.body as T;
    },
  };
}

beforeEach(async () => {
  ({ pg, db } = await createTestDb());
  await db.query(`insert into public.invite_codes (code, uses_left) values ('CODE2345', 10)`);
  await db.query('insert into auth.users (id) values ($1)', [A]);
  await redeemInvite(db, A, 'CODE2345');
  const look = createCertificate(5);
  await foundCompany(db, A, { name: '소금 상단', face: look.face, emblem: look.emblem });
  await openSeason(db, { id: SEASON, kind: 'rehearsal', worlds: 1 });
}, 60_000);

afterEach(async () => {
  await pg.close();
});

async function open(hooks = {}, off = { on: false }) {
  const r = await ServerGame.open(api(A, off), A, hooks);
  if (!r.ok) throw new Error(r.error);
  return r.game;
}

describe('서버 게임', () => {
  it('처음 열면 견습을 시작한다: 견습 세계 화면, 시즌 지도', async () => {
    const g = await open();
    expect(g.place).toBe('apprentice');
    expect(g.inApprentice).toBe(true);
    expect(g.view().apprentice?.scene).toBe('start');
    expect(g.map.towns).toHaveLength(6);
    expect(g.view().certificate.name).toBe('소금 상단');
  });

  it('견습 일곱 장면을 지나 졸업하면 공유 세계로 들어간다', async () => {
    const entered: string[] = [];
    const g = await open({ onEnterWorld: (s: { worldId: string }) => entered.push(s.worldId) });
    let changes = 0;
    g.subscribe(() => changes++);
    const destination = await walkApprentice({
      cmd: (c) => g.dispatch(c),
      view: () => g.view(),
      passDay: async () => {
        const s = await g.passApprenticeDay();
        expect(s?.days).toBe(1);
      },
    });
    const r = await g.dispatch({ type: 'travel', to: destination } as Command);
    expect(r.ok).toBe(true);
    expect(entered).toEqual(['w1']);
    expect(g.place).toBe('world');
    expect(g.inApprentice).toBe(false);
    expect(g.view().travel).toBeTruthy();
    expect(changes).toBeGreaterThan(5);
    // 공유 세계에서는 하루 보내기가 없다
    expect(await g.passApprenticeDay()).toBeNull();
  });

  it('장날이 지나면 자리를 비운 사이를 한 번 받고 본 날을 올린다', async () => {
    const g = await open();
    const destination = await walkApprentice({ cmd: (c) => g.dispatch(c), view: () => g.view(), passDay: () => g.passApprenticeDay().then(() => undefined) });
    await g.dispatch({ type: 'travel', to: destination } as Command);
    await tickDue(db, { now: seasonOpensAt(SEASON) + 2 * DAY_MS + 60_000 });
    const s = await g.catchUp();
    expect(s).toMatchObject({ days: 2, fromDay: 1, toDay: 3 });
    expect(g.view().day).toBe(3);
    expect(await g.catchUp()).toBeNull();
  });

  it('장날까지 남은 시간은 시즌을 연 때부터 센다', async () => {
    const g = await open();
    const opens = seasonOpensAt(SEASON);
    expect(g.msUntilMarket(opens)).toBe(DAY_MS);
    expect(g.msUntilMarket(opens + DAY_MS - 1000)).toBe(1000);
  });

  it('실패한 명령은 그 까닭, 서버에 닿지 못하면 offline과 끊김 표시', async () => {
    const off = { on: false };
    const flags: boolean[] = [];
    const g = await open({ onOffline: (v: boolean) => flags.push(v) }, off);
    expect(await g.dispatch({ type: 'placeSellOrder', good: 'salt', qty: 99, minPrice: 1 } as Command)).toMatchObject({ ok: false });
    off.on = true;
    expect(await g.dispatch({ type: 'readNews' } as Command)).toEqual({ ok: false, error: 'offline' });
    off.on = false;
    await g.catchUp();
    expect(flags).toEqual([true, false]);
  });

  it('명령은 하나씩 차례로 (동시에 눌러도)', async () => {
    const g = await open();
    const [a, b] = await Promise.all([g.dispatch({ type: 'startExpedition' } as Command), g.dispatch({ type: 'chooseExpeditionCard', choice: 1 } as Command)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it('열린 시즌이 없으면 까닭을 돌려준다', async () => {
    await db.query(`update public.seasons set status = 'ended'`);
    expect(await ServerGame.open(api(A), A)).toEqual({ ok: false, error: 'noSeason' });
  });
});
