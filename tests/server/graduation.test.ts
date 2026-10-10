// 견습 세계와 졸업해 공유 세계에 들어가기 (작업목록-0.2.0 7번), 시뮬 입구(src/sim/service)만으로
import { describe, expect, it } from 'vitest';
import { cartCount } from '../../src/sim/cart';
import { getPlayer, playerList, playerView } from '../../src/sim/economy';
import {
  commandWorld,
  enterWorld,
  graduationKit,
  isGraduation,
  openApprentice,
  openWorld,
  seasonMap,
  stateHash,
  tickWorld,
  type WorldBlob,
} from '../../src/sim/service';
import { walkApprentice } from '../helpers/apprentice';

const SEASON = '2026-10-26';
const ME = '00000000-0000-0000-0000-00000000000a';
const spec = { id: ME, name: '소금 상단', merchantNo: 7 };

function apprentice(): { blob: WorldBlob } {
  return { blob: openApprentice(seasonMap(SEASON), { seasonId: SEASON, spec, warmupDays: 3 }) };
}

async function graduateIn(blob: WorldBlob): Promise<{ destination: number; days: number }> {
  const map = seasonMap(SEASON);
  let days = 0;
  const destination = await walkApprentice({
    cmd: (c) => commandWorld(blob, map, ME, c),
    view: () => playerView(blob.state, map, ME),
    passDay: () => {
      tickWorld(blob, map, [ME]);
      days++;
    },
  });
  return { destination, days };
}

function sharedWorld(daysPassed: number): WorldBlob {
  const map = seasonMap(SEASON);
  const w = openWorld(map, { seasonId: SEASON, worldId: 'w1', bots: 11, warmupDays: 3 });
  for (let i = 0; i < daysPassed; i++) tickWorld(w, map);
  return w;
}

describe('견습 세계', () => {
  it('혼자 쓰는 세계: 사람 한 명, 봇 없음, 같은 시즌 지도', () => {
    const { blob } = apprentice();
    expect(playerList(blob.state).map((p) => p.id)).toEqual([ME]);
    expect(blob.crew).toEqual([]);
    expect(blob.state.world).toEqual({ seasonId: SEASON, worldId: 'apprentice' });
    expect(getPlayer(blob.state, ME).apprentice?.scene).toBe('start');
    expect(getPlayer(blob.state, ME).certificate.merchantNo).toBe(7);
  });

  it('일곱 장면을 장날 두 번으로 지난다 (길어도 한두 시간)', async () => {
    const { blob } = apprentice();
    const r = await graduateIn(blob);
    expect(r.days).toBe(2);
    expect(isGraduation(blob, ME, { type: 'travel', to: r.destination })).toBe(true);
    expect(isGraduation(blob, ME, { type: 'readNews' })).toBe(false);
  });
});

describe('졸업해 공유 세계에 들어가기', () => {
  it('돈·짐·손수레·식량만 들고 견습 마을에 앉아 바로 길을 떠난다', async () => {
    const { blob } = apprentice();
    const { destination } = await graduateIn(blob);
    const g = graduationKit(blob, ME);
    const before = getPlayer(blob.state, ME);
    const shared = sharedWorld(6);
    const map = seasonMap(SEASON);
    const day = shared.state.day;
    const r = enterWorld(shared, map, spec, g, { type: 'travel', to: destination });
    expect(r.ok).toBe(true);
    const p = getPlayer(shared.state, ME);
    // 견습 마을에서 갈 마을로 떠났다
    expect(p.homeTown).toBe(g.town);
    expect(p.travel?.to).toBe(destination);
    expect(p.apprentice).toBeNull();
    // 들고 온 것: 손수레, 목재, 여행 식량, 돈 (길삯은 공유 세계에서 낸다)
    expect(p.cart.type).toBe('handcart');
    expect(cartCount(p.cart, 'wood')).toBe(cartCount(before.cart, 'wood'));
    expect(cartCount(p.cart, 'rations')).toBeGreaterThan(0);
    expect(p.gold).toBeLessThanOrEqual(before.gold);
    // 두고 온 것: 시세 기억, 소문 수첩, 견습 장부
    expect(p.rumors).toEqual([]);
    expect(p.ledger.every((e) => e.day === day)).toBe(true);
    // 공유 세계에서 가장 최근에 찍은 신문 한 부 (안 읽음)
    expect(p.newspapers).toEqual([day - 1]);
    expect(p.papersRead).toEqual([]);
    // 증서와 상인 번호, 이번 시즌 기록은 들어온 날부터
    expect(p.certificate).toMatchObject({ name: '소금 상단', merchantNo: 7 });
    expect(p.record?.joinedDay).toBe(day);
    // 견습의 첫 신문 소식(조선소)이 공유 세계의 그 마을에도 (질문 137)
    expect(shared.state.events.some((e) => e.event === 'shipyard' && e.town === destination)).toBe(true);
    // 들어온 뒤에도 하루가 돈다
    const t = tickWorld(shared, map, [ME]);
    expect(t?.digests[ME]?.day).toBe(day);
  });

  it('1일째(장날 전)에 들어오면 시즌 전날 신문(0일)을 받는다', async () => {
    const { blob } = apprentice();
    const { destination } = await graduateIn(blob);
    const shared = sharedWorld(0);
    enterWorld(shared, seasonMap(SEASON), spec, graduationKit(blob, ME), { type: 'travel', to: destination });
    expect(getPlayer(shared.state, ME).newspapers).toEqual([0]);
  });

  it('같은 마을의 조선소 소식은 둘로 늘지 않는다', async () => {
    const shared = sharedWorld(2);
    const map = seasonMap(SEASON);
    for (const id of ['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']) {
      const a = openApprentice(map, { seasonId: SEASON, spec: { id, name: `상단 ${id.slice(-2)}` }, warmupDays: 3 });
      const destination = await walkApprentice({
        cmd: (c) => commandWorld(a, map, id, c),
        view: () => playerView(a.state, map, id),
        passDay: () => void tickWorld(a, map, [id]),
      });
      enterWorld(shared, map, { id, name: `상단 ${id.slice(-2)}` }, graduationKit(a, id), { type: 'travel', to: destination });
    }
    const yards = shared.state.events.filter((e) => e.event === 'shipyard');
    expect(new Set(yards.map((e) => e.town)).size).toBe(yards.length);
  });

  it('같은 졸업을 두 번 하면 같은 세계가 된다 (서버에서 다시 돌려도 같다)', async () => {
    const a = apprentice().blob;
    const { destination } = await graduateIn(a);
    const s1 = sharedWorld(4);
    const s2 = JSON.parse(JSON.stringify(s1)) as WorldBlob;
    const g = graduationKit(a, ME);
    enterWorld(s1, seasonMap(SEASON), spec, g, { type: 'travel', to: destination });
    enterWorld(s2, seasonMap(SEASON), spec, JSON.parse(JSON.stringify(g)), { type: 'travel', to: destination });
    expect(stateHash(s2)).toBe(stateHash(s1));
  });
});
