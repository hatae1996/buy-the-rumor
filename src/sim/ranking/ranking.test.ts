// 랭킹과 보상 데이터 (기획서 "랭킹과 보상"): 순자산, 부문 점수(특히 Buy the Rumor), 순위, 길드 의뢰, 인장, 상인 증서.
import { beforeEach, describe, expect, it } from 'vitest';
import { createCart, loadGear, loadGoods } from '../cart';
import { ECONOMY } from '../constants';
import { advanceDay, applyCommand, createEconomy, type EconomyState } from '../economy';
import { createSeason } from '../events';
import { horseMorning, stableAt, stableTowns } from '../horses';
import { generateWorld } from '../worldgen';
import {
  ACHIEVEMENTS,
  badgeDef,
  bestSingleSale,
  buyTheRumorProfit,
  CATEGORIES,
  certificateView,
  checkBadges,
  eventGoods,
  HOLDINGS_SHARE,
  holdingPrice,
  lastMarketPrice,
  netWorth,
  paperGrade,
  pickTheme,
  pinBadges,
  questProgress,
  questTier,
  seasonScores,
  standings,
  THEMES,
  tradeRecord,
  worthParts,
  type TradeRecord,
} from './index';

const SEED = 20261008;
const map = generateWorld(SEED);
let s: EconomyState;

beforeEach(() => {
  s = createEconomy(map, SEED);
});

const buy = (day: number, good: TradeRecord['good'], qty: number, price: number, town = 0) => tradeRecord(day, 'buy', town, good, qty, price);
const sell = (day: number, good: TradeRecord['good'], qty: number, price: number, town = 0) => tradeRecord(day, 'sell', town, good, qty, price);

describe('순자산 (현금 + 예금 − 빚 + (짐과 말) × 절반)', () => {
  it('짐은 모든 마을 마지막 장날 값의 평균, 말은 구입가로, 절반만 친다 (0.0.6)', () => {
    const p = s.players.me!;
    p.gold = 100;
    p.cart = createCart('wagon');
    loadGoods(p.cart, 'ore', 4);
    p.horses = [{ id: 1, kind: 'draft', fatigue: 0, hungry: 0, price: 220, home: 0 }];
    const ore = s.towns.reduce((sum, t) => sum + lastMarketPrice(s, t.id, 'ore'), 0) / s.towns.length;
    expect(holdingPrice(s, 'ore')).toBe(ore);
    expect(netWorth(s, s.players.me!)).toBe(Math.round(100 + (4 * ore + 220) * HOLDINGS_SHARE));
    // 어느 마을에 서 있든 같다
    const before = netWorth(s, s.players.me!);
    p.town = s.towns.find((t) => t.id !== p.town)!.id;
    expect(netWorth(s, s.players.me!)).toBe(before);
  });

  it('장날을 기다리는 신청에 맡긴 돈과 짐도 센다', () => {
    const before = netWorth(s, s.players.me!);
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'salt', qty: 2, maxPrice: 10 })).toEqual({ ok: true, orderId: expect.any(Number) });
    expect(netWorth(s, s.players.me!)).toBe(before);
  });
});

describe('부문 점수', () => {
  it('한 방: 산 값 대비 한 번에 판 것의 최고 이익. 산 적 없는 것(원정)은 세지 않는다', () => {
    expect(bestSingleSale([buy(1, 'ore', 10, 5), sell(3, 'ore', 6, 9), sell(4, 'ore', 4, 12)])).toBe(28);
    expect(bestSingleSale([sell(3, 'wood', 10, 9)])).toBe(0);
    // 먼저 산 것부터 맞춘다
    expect(bestSingleSale([buy(1, 'salt', 2, 4), buy(2, 'salt', 2, 10), sell(3, 'salt', 3, 12)])).toBe(2 * 8 + 1 * 2);
  });

  it('사건이 움직이는 물품', () => {
    expect(eventGoods('landslide')).toEqual(['ore']);
    expect(eventGoods('shipyard')).toEqual(expect.arrayContaining(['wood', 'tools']));
    expect(eventGoods('grandCaravan', 'salt')).toEqual(['salt']);
  });

  it('Buy the Rumor: 징조를 들은 다음 날부터 신문 전날까지 사서, 신문 뒤에 판 이익만', () => {
    const record = s.players.me!.record!;
    const town = 1;
    s.season!.log.push({ event: 'landslide', town, day: 10, end: 11, omenDay: 8 });
    record.heardOmens.push({ event: 'landslide', town, day: 8 });
    record.trades.push(
      buy(8, 'ore', 5, 10), // 들은 날 장날은 듣기 전이다 → 안 셈
      buy(9, 'ore', 4, 10), // 셈
      buy(10, 'ore', 3, 10), // 신문 난 날 → 안 셈
      sell(9, 'ore', 1, 30), // 신문 전에 판 것 → 안 셈
      sell(12, 'ore', 4, 18), // 신문 뒤에 판 것
      buy(9, 'wood', 5, 2), // 사건과 상관없는 물품 → 안 셈
      sell(12, 'wood', 5, 9),
    );
    expect(buyTheRumorProfit(s, record)).toBe(4 * (18 - 10));
  });

  it('헛징조(신문에 안 난 사건)나 듣지 않은 사건은 세지 않는다', () => {
    const record = s.players.me!.record!;
    s.season!.log.push({ event: 'mineCollapse', town: 2, day: 10, end: 12, omenDay: null });
    record.heardOmens.push({ event: 'wolves', town: 2, day: 8 });
    record.trades.push(buy(9, 'ore', 4, 10), sell(12, 'ore', 4, 18));
    expect(buyTheRumorProfit(s, record)).toBe(0);
  });

  it('물품왕은 판 양, 수완가는 충분히 한 뒤에만', () => {
    s.players.me!.record!.trades.push(sell(1, 'salt', 7, 10), sell(2, 'salt', 3, 10));
    const sc = seasonScores(s, s.players.me!)!;
    expect(sc.goodsKing.salt).toBe(10);
    expect(sc.multiplier).toBeNull();
    s.day += ECONOMY.ranking.multiplierMinDays;
    expect(seasonScores(s, s.players.me!)!.multiplier).toBeCloseTo(netWorth(s, s.players.me!) / s.players.me!.record!.startWorth);
  });

  it('부문은 큰손, 수완가, 한 방, Buy the Rumor, 물품왕 9개', () => {
    expect(CATEGORIES).toHaveLength(4 + 9);
  });
});

describe('순위', () => {
  it('같은 점수는 같은 순위, 기록 없는 사람은 빠지고, 상위 몇 %를 낸다', () => {
    const r = standings([
      { id: 'a', score: 10 },
      { id: 'b', score: 30 },
      { id: 'c', score: 30 },
      { id: 'd', score: null },
      { id: 'e', score: 5 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ['b', 1],
      ['c', 1],
      ['a', 3],
      ['e', 4],
    ]);
    expect(r[0]!.topShare).toBe(0.25);
  });
});

describe('길드 의뢰와 시즌 테마', () => {
  it('테마마다 의뢰 3~5개, 동·은·금 문턱은 올라간다', () => {
    const ids = THEMES.flatMap((t) => t.quests.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of THEMES) {
      expect(t.quests.length).toBeGreaterThanOrEqual(3);
      expect(t.quests.length).toBeLessThanOrEqual(5);
      expect(t.quests.some((q) => q.scope === 'personal')).toBe(true);
      for (const q of t.quests) expect(q.tiers[0] < q.tiers[1] && q.tiers[1] < q.tiers[2]).toBe(true);
    }
  });

  it('시즌을 만들면 시작 계절과 맵에 맞는 테마가 정해진다 (같은 시드면 같다)', () => {
    expect(s.season!.theme).not.toBeNull();
    expect(createSeason(s, map, 1, 1).theme).toBe(s.season!.theme);
    expect(pickTheme(1, 1, 0, new Set())).toBe(pickTheme(1, 1, 0, new Set()));
    // 바다가 없는 맵에서는 풍어의 시즌이 나오지 않는다
    for (let n = 1; n < 40; n++) expect(pickTheme(SEED, n, 1, new Set(['forest']))).not.toBe('bountySea');
  });

  it('판 양으로 의뢰를 재고, 문턱을 넘으면 그 단계 인장을 찍는다 (단계가 오르면 그 줄을 고친다)', () => {
    s.season!.theme = 'bountySea';
    const salt = THEMES.find((t) => t.id === 'bountySea')!.quests.find((q) => q.id === 'saltMagnate')!;
    s.players.me!.record!.trades.push(sell(s.day, 'salt', salt.tiers[0], 10));
    expect(questProgress(s, s.players.me!, salt)).toBe(salt.tiers[0]);
    expect(questTier(salt, salt.tiers[0])).toBe('bronze');
    checkBadges(s, s.players.me!);
    expect(s.players.me!.certificate.badges.filter((b) => b.badge === 'quest-saltMagnate')).toEqual([
      expect.objectContaining({ tier: 'bronze' }),
    ]);
    s.players.me!.record!.trades.push(sell(s.day, 'salt', salt.tiers[2], 10));
    checkBadges(s, s.players.me!);
    expect(s.players.me!.certificate.badges.filter((b) => b.badge === 'quest-saltMagnate')).toEqual([expect.objectContaining({ tier: 'gold' })]);
  });

  it('계절과 마을 규모를 정한 의뢰는 그때·그곳 판 것만 센다', () => {
    const tower = THEMES.find((t) => t.id === 'frost')!.quests.find((q) => q.id === 'towerFire')!;
    const city = map.towns.find((t) => t.tier === 'city')!.id;
    const town = map.towns.find((t) => t.tier === 'town')!.id;
    s.players.me!.record!.trades.push(sell(1, 'wood', 7, 5, city), sell(1, 'wood', 9, 5, town));
    expect(questProgress(s, s.players.me!, tower)).toBe(7);
  });
});

describe('인장', () => {
  it('업적 인장: 처음 말을 사면 "첫 말"', () => {
    horseMorning(s, map);
    const town = stableTowns(map)[0]!;
    s.players.me!.town = town;
    s.players.me!.gold = 1000;
    stableAt(s, town)!.stock.pony = 2;
    // 사기 신청은 그날 밤 추첨이다 (0.1.0). 혼자면 남은 말이 있는 한 뽑힌다
    expect(applyCommand(s, map, 'me', { type: 'buyHorse', kind: 'pony' }).ok).toBe(true);
    advanceDay(s, map);
    expect(s.players.me!.certificate.badges.map((b) => b.badge)).toContain('firstHorse');
  });

  it('업적 인장: 원정에서 횃불로 곰을 쫓으면 "곰 쫓는 상인"', () => {
    loadGear(s.players.me!.cart, 'torch', 4);
    s.players.me!.expedition = {
      town: s.players.me!.town,
      rng: 1,
      deck: ['log'],
      card: 'bear',
      left: 1,
      haul: [],
      rumors: [],
      log: [],
      flags: [],
      guide: false,
      markDays: {},
    };
    expect(applyCommand(s, map, 'me', { type: 'chooseExpeditionCard', choice: 2 }).ok).toBe(true);
    expect(s.players.me!.certificate.badges.map((b) => b.badge)).toContain('bearChaser');
  });

  it('오뚝이: 순자산이 시작의 절반 아래로 떨어졌다가 시작보다 위로 돌아오면', () => {
    const r = s.players.me!.record!;
    r.minWorth = r.startWorth * 0.4;
    s.players.me!.gold += 1000;
    checkBadges(s, s.players.me!);
    expect(s.players.me!.certificate.badges.map((b) => b.badge)).toContain('comeback');
  });

  it('업적은 한 번만 찍고, 숨김 업적이 4개 있다 (시안의 ???)', () => {
    s.players.me!.record!.moments.push({ id: 'firstHorse', day: 1 }, { id: 'firstHorse', day: 2 });
    checkBadges(s, s.players.me!);
    checkBadges(s, s.players.me!);
    expect(s.players.me!.certificate.badges.filter((b) => b.badge === 'firstHorse')).toHaveLength(1);
    expect(ACHIEVEMENTS.filter((a) => a.hidden)).toHaveLength(4);
  });

  it('모든 인장 id를 찾을 수 있다 (의뢰, 업적, 랭킹, 기념)', () => {
    for (const id of ['quest-winterFood', 'comeback', 'season-3', 'rank-bigShot-first', 'rank-goodsKing:salt-top10']) {
      expect(badgeDef(id), id).not.toBeNull();
    }
    expect(badgeDef('rank-goodsKing:salt-top10')!.name).toBe('소금왕 상위 10%');
    expect(badgeDef('없는-인장')).toBeNull();
  });
});

describe('시즌 마감과 상인 증서', () => {
  it('시즌이 바뀌면 완주 기념 인장과 연차가 오르고, 기록을 새로 센다', () => {
    const len = s.season!.length;
    for (let d = 0; d < len; d++) advanceDay(s, map);
    advanceDay(s, map);
    expect(s.season!.number).toBe(2);
    expect(s.players.me!.record!.season).toBe(2);
    expect(s.players.me!.certificate.seasonsCompleted).toBe(1);
    expect(s.players.me!.certificate.badges.map((b) => b.badge)).toContain('season-1');
  });

  it('증서는 순자산을 담지 않고, 앞면 인장은 4개까지, 연차에 따라 종이가 바뀐다', () => {
    const c = s.players.me!.certificate;
    s.players.me!.record!.moments.push({ id: 'firstHorse', day: 1 }, { id: 'bearTorch', day: 1 });
    checkBadges(s, s.players.me!);
    pinBadges(c, [0, 1, 1, 7, 9]);
    expect(c.pinned).toEqual([0, 1]);
    const v = certificateView(c);
    expect(JSON.stringify(v)).not.toMatch(/worth|gold/i);
    expect(v.pinned.map((b) => b.name).sort()).toEqual(['곰 쫓는 상인', '첫 말'].sort());
    expect([paperGrade(0), paperGrade(3), paperGrade(10)]).toEqual(['worn', 'parchment', 'gilded']);
  });
});

describe('여행 식량의 값 (0.1.3 첫 5일 벌이)', () => {
  it('실은 여행 식량은 산 값으로 따로 센다. 순자산에는 넣지 않는다', () => {
    const me = s.players.me!;
    me.cart = createCart('handcart');
    const before = worthParts(s, me);
    loadGoods(me.cart, 'rations', 3, 0, 5);
    loadGoods(me.cart, 'rations', 1, 0, 0);
    const after = worthParts(s, me);
    expect(after.rations - before.rations).toBe(15);
    expect(after.total).toBe(before.total);
  });
});
