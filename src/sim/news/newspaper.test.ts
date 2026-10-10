// 신문 (0.1.0 작업 4 → 0.1.2 "신문은 마을에서 산다"): 신문팔이에게서 그날 신문, 길 위에서는 못 산다,
// 도시에서 먼 마을은 하루 늦은 신문, 산 신문만 읽는다, 견습 무료, 돈은 세계 밖으로. 0.1.3: 매일 나오고 지난 3일 치는 반값.
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { advanceDay, applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { moneySupply } from '../economy/stats';
import { generateWorld, townTravelDays } from '../worldgen';
import { AUTUMN } from '../season';
import { cityPriceLines, paperHeadline } from './daily';
import { paperDelay } from './newspaper';

const SEED = 777;
const map = generateWorld(SEED, { towns: 8 });
const days = townTravelDays(map, AUTUMN);
const cities = map.towns.filter((t) => t.tier === 'city').map((t) => t.id);
const nearCity = (t: number) => Math.min(...cities.map((c) => days[t]![c]!));
const near = map.towns.find((t) => nearCity(t.id) <= ECONOMY.newspaper.lateAfterDays)!.id;
const far = map.towns.find((t) => nearCity(t.id) > ECONOMY.newspaper.lateAfterDays)?.id ?? null;

/** 오늘은 10일째: 어제(9일) 장날 신문에 기사 셋, 그제(8일) 신문에 기사 하나 */
function withNews(opt: { apprentice?: boolean; town?: number } = {}): EconomyState {
  const s = createEconomy(map, SEED, { apprentice: opt.apprentice ?? false });
  s.day = 10;
  s.players.me!.town = opt.town ?? near;
  s.news = [
    { day: 8, text: '그제 머리기사' },
    { day: 9, text: '어제 머리기사' },
    { day: 9, text: '어제 둘째 기사' },
    { day: 9, text: '어제 셋째 기사' },
  ];
  return s;
}

describe('신문은 마을에서 산다', () => {
  it('사지 않으면 아무 기사도 보이지 않는다 (머리기사도)', () => {
    const v = playerView(withNews(), map, 'me');
    expect(v.news).toEqual([]);
    expect(v.newspaper.papers).toEqual([]);
    expect(v.newspaper.onSale).toEqual({ day: 9, bought: false });
  });

  it('신문팔이에게서 그날 신문을 사면 그 신문 전문을 읽는다. 돈은 세계 밖으로', () => {
    const s = withNews();
    const money = moneySupply(s);
    const gold = s.players.me!.gold;
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper' }).ok).toBe(true);
    expect(s.players.me!.gold).toBe(gold - ECONOMY.newspaper.fee);
    expect(moneySupply(s)).toBe(money - ECONOMY.newspaper.fee);
    const v = playerView(s, map, 'me');
    expect(v.news.map((n) => n.text)).toEqual(['어제 머리기사', '어제 둘째 기사', '어제 셋째 기사']);
    expect(v.newspaper.papers).toEqual([{ day: 9, headline: '어제 머리기사', read: false }]);
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper' })).toEqual({ ok: false, error: 'alreadyBought' });
  });

  it('산 신문을 읽으면 안 읽음 표시가 사라진다. 사지 않은 신문은 읽을 수 없다', () => {
    const s = withNews();
    applyCommand(s, map, 'me', { type: 'buyNewspaper' });
    expect(applyCommand(s, map, 'me', { type: 'readPaper', day: 8 })).toEqual({ ok: false, error: 'noPaper' });
    expect(applyCommand(s, map, 'me', { type: 'readPaper', day: 9 }).ok).toBe(true);
    expect(playerView(s, map, 'me').newspaper.papers[0]!.read).toBe(true);
  });

  it('길 위에서는 살 수 없다', () => {
    const s = withNews();
    s.players.me!.travel = { from: near, to: (near + 1) % map.towns.length, days: 2, daysLeft: 2 };
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper' })).toEqual({ ok: false, error: 'traveling' });
    expect(playerView(s, map, 'me').newspaper.onSale).toBeNull();
  });

  it('도시에서 하루 넘게 먼 마을은 하루 늦은 신문이 온다', () => {
    expect(paperDelay(map, near)).toBe(0);
    for (const c of cities) expect(paperDelay(map, c)).toBe(0);
    // 마을 8곳 맵에는 도시에서 하루 넘게 먼 마을이 있다
    expect(far).not.toBeNull();
    if (far === null) return;
    expect(paperDelay(map, far)).toBe(ECONOMY.newspaper.lateDays);
    const s = withNews({ town: far });
    expect(playerView(s, map, 'me').newspaper).toMatchObject({ onSale: { day: 8, bought: false }, late: true });
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper' }).ok).toBe(true);
    expect(playerView(s, map, 'me').news.map((n) => n.text)).toEqual(['그제 머리기사']);
  });

  it('견습 동안은 무료로 받는다 (그래도 신문팔이에게서 받아야 읽는다)', () => {
    const s = withNews({ apprentice: true });
    const gold = s.players.me!.gold;
    expect(playerView(s, map, 'me').news).toEqual([]);
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper' }).ok).toBe(true);
    expect(s.players.me!.gold).toBe(gold);
    expect(playerView(s, map, 'me').news).toHaveLength(3);
  });

  it('첫 장날 전(1일째)에는 팔 신문이 없다', () => {
    const s = withNews();
    s.news = [];
    s.day = 1;
    expect(playerView(s, map, 'me').newspaper.onSale).toBeNull();
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper' })).toEqual({ ok: false, error: 'noPaper' });
  });
});

describe('신문은 매일 나온다 (0.1.3, 답 96)', () => {
  it('큰 소식이 없는 날도 날씨와 도시 시세가 실린다. 머리기사는 큰 소식, 없으면 날씨', () => {
    const s = createEconomy(map, SEED, { warmupDays: 5 });
    for (let d = 0; d < 6; d++) advanceDay(s, map);
    for (let day = 1; day <= 6; day++) {
      const items = s.news.filter((n) => n.day === day);
      expect(items.filter((n) => n.section === 'weather'), `${day}일 날씨`).toHaveLength(1);
      expect(items.filter((n) => n.section === 'prices'), `${day}일 시세`).toHaveLength(cities.length);
      const big = items.find((n) => !n.section);
      expect(paperHeadline(s.news, day)).toBe(big ? big.text : items.find((n) => n.section === 'weather')!.text);
    }
    // 시세 줄은 도시 장에서 그날 맞춰진 값
    const city = map.towns.find((t) => t.tier === 'city')!;
    expect(cityPriceLines(s, map)[0]!.startsWith(city.name)).toBe(true);
  });

  it('날씨는 시드와 날로 정해진다 (같은 세계면 같은 날씨)', () => {
    const a = createEconomy(map, SEED, { warmupDays: 3 });
    const b = createEconomy(map, SEED, { warmupDays: 3 });
    for (let d = 0; d < 4; d++) {
      advanceDay(a, map);
      advanceDay(b, map);
    }
    expect(a.news.filter((n) => n.section === 'weather')).toEqual(b.news.filter((n) => n.section === 'weather'));
  });

  it('신문팔이는 지난 3일 치도 반값에 판다. 그보다 오래된 것은 팔지 않는다', () => {
    const s = withNews();
    s.news = [5, 6, 7, 8, 9].map((day) => ({ day, text: `${day}일 날씨`, section: 'weather' as const }));
    const v = playerView(s, map, 'me').newspaper;
    expect(v.onSale).toEqual({ day: 9, bought: false });
    expect(v.back.map((b) => b.day)).toEqual([8, 7, 6]);
    expect(v.back.every((b) => b.fee === ECONOMY.newspaper.backFee && !b.bought)).toBe(true);
    const gold = s.players.me!.gold;
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 7 }).ok).toBe(true);
    expect(s.players.me!.gold).toBe(gold - ECONOMY.newspaper.backFee);
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 5 })).toEqual({ ok: false, error: 'noPaper' });
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 7 })).toEqual({ ok: false, error: 'alreadyBought' });
    expect(playerView(s, map, 'me').newspaper.back.find((b) => b.day === 7)!.bought).toBe(true);
    expect(playerView(s, map, 'me').news.map((n) => n.text)).toEqual(['7일 날씨']);
  });
});
