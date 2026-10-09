// 알림 (기획서 "시간과 접속 리듬 - 알림 (확정, 0.0.5)"): 종류와 처음 설정, 보낼 사건, 묶기·상한·조용한 시간, 사실만.
import { describe, expect, it } from 'vitest';
import { createCart, loadGoods } from '../cart';
import { advanceDay, applyCommand, createEconomy } from '../economy';
import { generateWorld } from '../worldgen';
import { bundle, defaultNotifySettings, isFactual, isQuiet, NOTIFY_KINDS, planDelivery, type NotifyEvent } from './index';

const map = generateWorld(20261008);

describe('종류와 처음 설정', () => {
  it('8가지, 원정 기회와 신문만 처음에 꺼져 있다. 하루 6개, 밤 11시~아침 8시 조용히', () => {
    expect(NOTIFY_KINDS).toHaveLength(8);
    const s = defaultNotifySettings();
    expect(Object.entries(s.enabled).filter(([, on]) => !on).map(([k]) => k).sort()).toEqual(['chances', 'newspaper']);
    expect([s.dailyCap, s.quietStart, s.quietEnd]).toEqual([6, 23, 8]);
  });

  it('설정은 명령으로 바꾸고, 견습 졸업 때 허락을 물은 날을 적는다', () => {
    const st = createEconomy(map, 1);
    expect(applyCommand(st, map, 'me', { type: 'setNotify', enabled: { newspaper: true }, dailyCap: 3, asked: true }).ok).toBe(true);
    expect(st.players.me!.notify.enabled.newspaper).toBe(true);
    expect(st.players.me!.notify.dailyCap).toBe(3);
    expect(st.players.me!.notify.askedDay).toBe(st.day);
    expect(applyCommand(st, map, 'me', { type: 'setNotify', quietStart: 24 })).toEqual({ ok: false, error: 'badQty' });
  });
});

describe('하루마다 만드는 사건', () => {
  it('장날 결과는 마을마다 사실만: "○○ 장날: 소금 3개 팔림, +n"', () => {
    const st = createEconomy(map, 20261008, { warmupDays: 20 });
    st.players.me!.cart = createCart('handcart');
    loadGoods(st.players.me!.cart, 'salt', 3);
    applyCommand(st, map, 'me', { type: 'placeSellOrder', good: 'salt', qty: 3, minPrice: 1 });
    const r = advanceDay(st, map);
    const market = r.players.me!.notices.filter((n) => n.kind === 'market');
    if (st.players.me!.ledger.some((e) => e.kind === 'sell')) {
      expect(market).toHaveLength(1);
      expect(market[0]!.text).toMatch(/장날: 소금 \d+개 팔림, \+\d+/);
    }
    for (const n of r.players.me!.notices) expect(isFactual(n.text)).toBe(true);
  });

  it('도착하면 알린다', () => {
    const st = createEconomy(map, 20261008);
    const to = map.towns.find((t) => t.id !== st.players.me!.town)!.id;
    applyCommand(st, map, 'me', { type: 'travel', to });
    let arrived = false;
    for (let d = 0; d < 10 && !arrived; d++) arrived = advanceDay(st, map).players.me!.notices.some((n) => n.kind === 'arrival');
    expect(arrived).toBe(true);
  });

  it('내일 상할 음식이 있으면 알린다', () => {
    const st = createEconomy(map, 20261008);
    st.players.me!.cart = createCart('handcart');
    loadGoods(st.players.me!.cart, 'fish', 2, 2);
    const r = advanceDay(st, map);
    // 하룻밤 지나 생선이 상하기 직전이거나 이미 상했다
    expect(r.players.me!.notices.some((n) => n.kind === 'spoiling') || st.players.me!.ledger.some((e) => e.kind === 'spoil')).toBe(true);
  });
});

describe('보내기 규칙', () => {
  const ev = (kind: NotifyEvent['kind'], text: string): NotifyEvent => ({ kind, day: 1, text, target: { tab: 'town' } });

  it('같은 종류는 묶는다: "장날 결과 3건"', () => {
    const b = bundle([ev('market', 'a'), ev('market', 'b'), ev('market', 'c'), ev('arrival', 'd')]);
    expect(b.find((n) => n.kind === 'market')).toMatchObject({ title: '장날 결과 3건', count: 3 });
    expect(b.find((n) => n.kind === 'arrival')).toMatchObject({ title: '도착', body: 'd', count: 1 });
  });

  it('꺼 둔 종류는 보내지 않고, 하루 상한을 넘으면 "자리를 비운 사이"로 넘긴다', () => {
    const s = defaultNotifySettings();
    const events = [ev('market', 'a'), ev('arrival', 'b'), ev('spoiling', 'c'), ev('newspaper', 'd')];
    const plan = planDelivery(events, s, 12, 5);
    expect(plan.send).toHaveLength(1);
    expect(plan.toSummary.map((e) => e.kind).sort()).toEqual(['arrival', 'spoiling']);
    expect([...plan.send, ...plan.toSummary].some((x) => x.kind === 'newspaper')).toBe(false);
  });

  it('조용한 시간(자정을 넘어도)에는 아침에 한 번에', () => {
    const s = defaultNotifySettings();
    expect([isQuiet(s, 23), isQuiet(s, 2), isQuiet(s, 8), isQuiet(s, 12)]).toEqual([true, true, false, false]);
    const plan = planDelivery([ev('market', 'a')], s, 1, 0);
    expect(plan.send).toEqual([]);
    expect(plan.later).toHaveLength(1);
  });

  it('재촉하는 말은 쓰지 않는다', () => {
    expect(isFactual('벨헤이븐 장날: 소금 20개 팔림, +312')).toBe(true);
    expect(isFactual('지금 안 오면 손해!')).toBe(false);
  });
});
