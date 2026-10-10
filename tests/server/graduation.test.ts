// 견습 세계와 졸업해 공유 세계에 들어가기 (작업목록-0.2.0 7번), 시뮬 입구(src/sim/service)만으로
import { describe, expect, it } from 'vitest';
import { cartCount, loadGoods } from '../../src/sim/cart';
import { settleApprenticeGuest } from '../../src/sim/apprentice';
import { Accounts } from '../../src/sim/economy/accounts';
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

  it('상인 번호마다 견습 마을이 갈린다 (모두 같은 마을에서 시작하지 않게)', () => {
    const map = seasonMap(SEASON);
    const towns = new Set(
      Array.from({ length: 12 }, (_, i) => {
        const b = openApprentice(map, { seasonId: SEASON, spec: { id: ME, name: '소금 상단', merchantNo: i + 1 }, warmupDays: 0 });
        return getPlayer(b.state, ME).apprentice!.town;
      }),
    );
    expect(towns.size).toBeGreaterThan(1);
    // 같은 번호면 같은 마을
    const again = openApprentice(map, { seasonId: SEASON, spec: { id: ME, name: '소금 상단', merchantNo: 3 }, warmupDays: 0 });
    const first = openApprentice(map, { seasonId: SEASON, spec: { id: ME, name: '소금 상단', merchantNo: 3 }, warmupDays: 0 });
    expect(getPlayer(again.state, ME).apprentice).toEqual(getPlayer(first.state, ME).apprentice);
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
    const yardsBefore = shared.state.events.filter((e) => e.event === 'shipyard').length;
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
    // 견습의 첫 신문 소식(조선소)은 공유 세계에 일으키지 않고, 가는 마을에 그 사람만의 견습 손님 (답 137)
    expect(shared.state.events.filter((e) => e.event === 'shipyard').length).toBe(yardsBefore);
    expect(p.apprenticeGuest).toMatchObject({ town: destination, good: 'wood', qty: cartCount(before.cart, 'wood') });
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

  it('여럿이 졸업해 들어와도 공유 세계에 조선소 사건이 생기지 않는다 (답 137)', async () => {
    const shared = sharedWorld(2);
    const map = seasonMap(SEASON);
    const before = JSON.stringify(shared.state.events);
    for (const id of ['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']) {
      const a = openApprentice(map, { seasonId: SEASON, spec: { id, name: `상단 ${id.slice(-2)}` }, warmupDays: 3 });
      const destination = await walkApprentice({
        cmd: (c) => commandWorld(a, map, id, c),
        view: () => playerView(a.state, map, id),
        passDay: () => void tickWorld(a, map, [id]),
      });
      enterWorld(shared, map, { id, name: `상단 ${id.slice(-2)}` }, graduationKit(a, id), { type: 'travel', to: destination });
    }
    expect(JSON.stringify(shared.state.events)).toBe(before);
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

describe('견습 손님 (0.2.1, 답 137)', () => {
  /** 졸업해 들어가 가는 마을에 닿을 때까지 장날을 돌린다 */
  async function arrive(): Promise<{ shared: WorldBlob; destination: number; paid: number }> {
    const { blob } = apprentice();
    const { destination } = await graduateIn(blob);
    const ledger = getPlayer(blob.state, ME).ledger.filter((e) => e.kind === 'buy' && e.good === 'wood');
    const paid = Math.max(...ledger.map((e) => (e.kind === 'buy' ? e.price : 0)));
    const shared = sharedWorld(3);
    const map = seasonMap(SEASON);
    enterWorld(shared, map, spec, graduationKit(blob, ME), { type: 'travel', to: destination });
    for (let i = 0; i < 10 && getPlayer(shared.state, ME).travel; i++) tickWorld(shared, map, [ME]);
    expect(getPlayer(shared.state, ME).town).toBe(destination);
    return { shared, destination, paid };
  }

  it('도착한 뒤 첫 장날에 견습에서 산 목재를 안내한 값에 먼저 산다 (첫 거래는 이익, 공유 시장은 그대로)', async () => {
    const { shared, destination, paid } = await arrive();
    const map = seasonMap(SEASON);
    const p = getPlayer(shared.state, ME);
    const guest = p.apprenticeGuest!;
    expect(guest.price).toBeGreaterThan(paid);
    const wood = cartCount(p.cart, 'wood');
    // 신청을 내지 않은 같은 세계와 그 마을 목재 장이 같다 (공유 시장의 값과 체결량에 들어가지 않는다)
    const twin = JSON.parse(JSON.stringify(shared)) as WorldBlob;
    expect(commandWorld(shared, map, ME, { type: 'placeSellOrder', good: 'wood', qty: wood, minPrice: 1 }).ok).toBe(true);
    const t = tickWorld(shared, map, [ME])!;
    const t2 = tickWorld(twin, map, [ME])!;
    expect(t.report.markets[destination]!.wood).toEqual(t2.report.markets[destination]!.wood);
    const sold = p.ledger.filter((e) => e.kind === 'sell' && e.day === t.report.day);
    expect(sold).toEqual([{ day: t.report.day, kind: 'sell', town: destination, good: 'wood', qty: guest.qty, price: guest.price, by: 'guest' }]);
    expect(t.digests[ME]!.notices.some((n) => n.text.includes('견습 손님이 약속대로 목재'))).toBe(true);
    // 한 번뿐
    expect(p.apprenticeGuest).toBeNull();
    // 신문에 실리지 않는다
    expect(shared.state.news.filter((n) => n.day === t.report.day).some((n) => n.text.includes('견습'))).toBe(false);
  });

  it('손님 값보다 높게 내면 사지 않고 보통 장으로, 첫 장날이 지나면 사라진다', async () => {
    const { shared } = await arrive();
    const map = seasonMap(SEASON);
    const p = getPlayer(shared.state, ME);
    const guest = p.apprenticeGuest!;
    commandWorld(shared, map, ME, { type: 'placeSellOrder', good: 'wood', qty: guest.qty, minPrice: guest.price + 1 });
    const t = tickWorld(shared, map, [ME])!;
    expect(p.ledger.some((e) => e.kind === 'sell' && e.by === 'guest')).toBe(false);
    expect(t.digests[ME]!.notices.some((n) => n.text.includes('견습 손님'))).toBe(false);
    expect(p.apprenticeGuest).toBeNull();
  });

  it('다른 마을에 서면 사라진다', async () => {
    const { blob } = apprentice();
    const { destination } = await graduateIn(blob);
    const shared = sharedWorld(3);
    const map = seasonMap(SEASON);
    const g = graduationKit(blob, ME);
    const other = map.towns.find((t) => t.id !== destination && t.id !== g.town)!.id;
    enterWorld(shared, map, spec, g, { type: 'travel', to: other });
    expect(getPlayer(shared.state, ME).apprenticeGuest?.town).toBe(destination);
    for (let i = 0; i < 12 && getPlayer(shared.state, ME).travel; i++) tickWorld(shared, map, [ME]);
    tickWorld(shared, map, [ME]);
    expect(getPlayer(shared.state, ME).apprenticeGuest).toBeNull();
  });

  it('손님 수량보다 많이 내면 남은 양은 보통 장 신청으로 남는다', async () => {
    const { shared, destination } = await arrive();
    const p = getPlayer(shared.state, ME);
    const guest = p.apprenticeGuest!;
    loadGoods(p.cart, 'wood', 3, 0, 0);
    const accounts = new Accounts(shared.state);
    const order = accounts.place({ kind: 'player', pid: ME }, destination, 'wood', 'sell', guest.qty + 3, 1)!;
    shared.state.orders.push(order);
    const fills = settleApprenticeGuest(shared.state, p, accounts);
    expect(fills).toEqual([{ qty: guest.qty, price: guest.price }]);
    expect(shared.state.orders.find((o) => o.id === order.id)?.qty).toBe(3);
  });
});
