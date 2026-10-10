import { describe, expect, it } from 'vitest';
import { getPlayer, playerList } from '../economy';
import { hashText, stateHash } from './hash';
import { SIM_VERSION } from './version';
import { commandWorld, openWorld, screenData, seasonMap, SimVersionMismatch, tickWorld, type WorldBlob } from './world';

const SEASON = '2026-10-26';
const HUMAN = '00000000-0000-0000-0000-00000000000a';

function open(worldId = 'w1', bots = 11): WorldBlob {
  return openWorld(seasonMap(SEASON), {
    seasonId: SEASON,
    worldId,
    humans: [{ id: HUMAN, name: '소금 상단', merchantNo: 7, apprentice: false }],
    bots,
    warmupDays: 3,
  });
}

/** 서버처럼 하루마다 글자로 저장했다가 다시 읽는다 */
const roundTrip = (b: WorldBlob): WorldBlob => JSON.parse(JSON.stringify(b)) as WorldBlob;

describe('서버 세계 열기', () => {
  it('마을 6곳, 같은 시즌이면 같은 지도', () => {
    const a = seasonMap(SEASON);
    expect(a.towns).toHaveLength(6);
    expect(stateHash(seasonMap(SEASON))).toBe(stateHash(a));
    expect(stateHash(seasonMap('2026-11-09'))).not.toBe(stateHash(a));
  });

  it('사람은 계정의 상인 번호, 봇은 번호 없음 (답 132)', () => {
    const b = open();
    expect(getPlayer(b.state, HUMAN).certificate.merchantNo).toBe(7);
    const bots = playerList(b.state).filter((p) => p.id !== HUMAN);
    expect(bots).toHaveLength(11);
    expect(bots.every((p) => p.certificate.merchantNo === null)).toBe(true);
    expect(b.crew.map((c) => c.pid)).toEqual(bots.map((p) => p.id));
  });

  it('봇 이름은 사람 이름과 겹치지 않는다', () => {
    const b = openWorld(seasonMap(SEASON), {
      seasonId: SEASON,
      worldId: 'w1',
      humans: [{ id: HUMAN, name: '바람결 상단' }],
      bots: 11,
      warmupDays: 0,
    });
    const names = playerList(b.state).map((p) => p.certificate.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('같은 시즌의 세계 둘은 세계 id만 다르다', () => {
    // 세계 id는 세계(state.world)와 플레이어마다의 시즌 기록(record.worldId)에 적힌다
    const a = JSON.stringify(open('w1'));
    const b = JSON.stringify(open('w2'));
    expect(b).not.toBe(a);
    expect(hashText(b.replaceAll('"worldId":"w2"', '"worldId":"w1"'))).toBe(hashText(a));
  });

  it('시뮬 버전을 적는다', () => {
    expect(open().simVersion).toBe(SIM_VERSION);
  });
});

describe('서버 하루', () => {
  it('날마다 저장했다 읽어도 메모리에서 이어 돌린 것과 같다', () => {
    const map = seasonMap(SEASON);
    let server = open();
    const local = open();
    expect(stateHash(server)).toBe(stateHash(local));
    for (let d = 0; d < 8; d++) {
      // 사람도 하루에 명령 하나 (여관에서 쉬기는 늘 받는 명령이 아니어도 된다: 결과만 같으면 된다)
      const cmd = { type: 'restAtInn' } as const;
      const a = commandWorld(server, map, HUMAN, cmd);
      const b = commandWorld(local, map, HUMAN, cmd);
      expect(a.ok).toBe(b.ok);
      server = roundTrip(server);
      tickWorld(server, map);
      tickWorld(local, map);
      server = roundTrip(server);
      expect(stateHash(server), `${d + 1}일째`).toBe(stateHash(local));
    }
    expect(server.state.day).toBe(local.state.day);
  });

  it('장날 뒤 점수 줄은 이 세계와 시즌 id를 단다', () => {
    const map = seasonMap(SEASON);
    const b = open();
    let rows: ReturnType<typeof tickWorld> = null;
    for (let d = 0; d < 3; d++) rows = tickWorld(b, map);
    expect(rows).not.toBeNull();
    expect(rows!.rows.every((r) => r.seasonId === SEASON && r.worldId === 'w1')).toBe(true);
  });

  it('시뮬 버전이 다르면 돌리지 않는다', () => {
    const map = seasonMap(SEASON);
    const b = open();
    b.simVersion = SIM_VERSION + 1;
    const before = stateHash(b.state);
    expect(() => tickWorld(b, map)).toThrow(SimVersionMismatch);
    expect(() => commandWorld(b, map, HUMAN, { type: 'restAtInn' })).toThrow(SimVersionMismatch);
    expect(stateHash(b.state)).toBe(before);
  });

  it('봇 자리에는 명령을 보낼 수 없다', () => {
    const b = open();
    expect(() => commandWorld(b, seasonMap(SEASON), b.crew[0]!.pid, { type: 'restAtInn' })).toThrow();
  });

  it('화면 데이터는 그 사람이 아는 것', () => {
    const b = open();
    const s = screenData(b, seasonMap(SEASON), HUMAN);
    expect(s.view.day).toBe(b.state.day);
  });
});

describe('상태 해시', () => {
  it('같은 글자면 같고, 키 순서가 다르면 다르다', () => {
    expect(stateHash({ a: 1, b: 2 })).toBe(stateHash({ a: 1, b: 2 }));
    expect(stateHash({ a: 1, b: 2 })).not.toBe(stateHash({ b: 2, a: 1 }));
    expect(hashText('')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashText('가')).not.toBe(hashText('나'));
  });
});
