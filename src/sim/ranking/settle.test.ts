// 랭킹과 시즌 결산 (0.1.0 작업 5): 장날마다 순위, 마지막 장날 뒤 결산 한 번, 넘어 남는 것만 다음 시즌으로.
import { describe, expect, it } from 'vitest';
import { applyCommand, advanceDay, createEconomy, nextSeasonEconomy, playerView, type EconomyState } from '../economy';
import { generateWorld } from '../worldgen';
import { loadGoods } from '../cart';
import { settleSeason } from './settle';
import { newsName } from './table';
import { tradeRecord } from './record';

const SEED = 4242;
const map = generateWorld(SEED);
const IDS = ['me', 'b1', 'b2'];

/** 세 상단, 시즌을 짧게(3일) 줄인 세계. 소금을 me 10, b1 5, b2 1개 팔았고 돈은 me가 가장 적다 */
function world(): EconomyState {
  const s = createEconomy(map, SEED, { players: IDS.map((id, i) => ({ id, name: ['나의 상단', '붉은 여우 상단', '푸른 돛 상단'][i] })) });
  s.season!.length = 3;
  [10, 5, 1].forEach((n, i) => s.players[IDS[i]!]!.record!.trades.push(tradeRecord(1, 'sell', 0, 'salt', n, 20)));
  [100, 900, 500].forEach((g, i) => (s.players[IDS[i]!]!.gold = g));
  return s;
}

describe('장날마다 순위', () => {
  it('장날 뒤 부문마다 순위를 매긴다. 내 화면에는 1~3위 이름과 내 순위만 (남의 점수는 없다)', () => {
    const s = world();
    advanceDay(s, map);
    expect(s.rankings?.day).toBe(1);
    const v = playerView(s, map, 'me');
    const salt = v.ranking.categories.find((c) => c.id === 'goodsKing:salt')!;
    expect(salt.top.map((t) => [t.name, t.rank])).toEqual([
      ['나의 상단', 1],
      ['붉은 여우 상단', 2],
      ['푸른 돛 상단', 3],
    ]);
    expect(salt.mine).toMatchObject({ rank: 1, score: 10 });
    expect(JSON.stringify(salt.top)).not.toMatch(/score/);
    const big = v.ranking.categories.find((c) => c.id === 'bigShot')!;
    expect(big.top[0]!.name).toBe('붉은 여우 상단');
    expect(big.mine!.rank).toBe(3);
    // 판 적 없는 물품왕에는 아무도 없다
    expect(v.ranking.categories.find((c) => c.id === 'goodsKing:ore')!.top).toEqual([]);
  });
});

describe('시즌 결산', () => {
  it('마지막 장날 뒤 한 번: 부문마다 가장 좋은 랭킹 인장 하나, 1위 칭호, 완주 기념 인장과 연차, 리포트', () => {
    const s = world();
    for (let d = 0; d < 3; d++) advanceDay(s, map);
    const st = s.settlement!;
    expect(st.season).toBe(1);
    const me = s.players.me!.certificate;
    const badges = me.badges.map((b) => b.badge);
    expect(badges).toContain('rank-goodsKing:salt-first');
    expect(badges).toContain('rank-bigShot-top3');
    expect(badges.filter((b) => b.startsWith('rank-goodsKing:salt'))).toHaveLength(1);
    expect(badges).toContain('season-1');
    expect(me.seasonsCompleted).toBe(1);
    expect(me.titles).toContain('1시즌 소금왕');
    expect(me.title).toBe('1시즌 소금왕');
    expect(me.bestBigShotRank).toBe(3);
    expect(s.players.b1!.certificate.titles).toContain('1시즌 큰손');
    expect(st.reports.me).toMatchObject({ towns: 1, trips: 0 });
    // 두 번 해도 한 번만
    expect(settleSeason(s)).toBe(st);
    expect(s.players.me!.certificate.seasonsCompleted).toBe(1);
    expect(s.players.me!.certificate.badges.filter((b) => b.badge === 'season-1')).toHaveLength(1);
  });

  it('결산 뒤에는 장사 명령을 받지 않고, 증서 고치기는 된다. 화면에는 내 리포트만', () => {
    const s = world();
    for (let d = 0; d < 3; d++) advanceDay(s, map);
    loadGoods(s.players.me!.cart, 'ore', 3);
    expect(applyCommand(s, map, 'me', { type: 'placeSellOrder', good: 'ore', qty: 3, minPrice: 1 })).toEqual({ ok: false, error: 'seasonOver' });
    expect(applyCommand(s, map, 'me', { type: 'setCompany', name: '  잿빛   소금 상단 ', crest: 'salt' }).ok).toBe(true);
    expect(s.players.me!.certificate).toMatchObject({ name: '잿빛 소금 상단', crest: 'salt' });
    const v = playerView(s, map, 'me');
    expect(v.settlement).toMatchObject({ season: 1, titles: ['1시즌 소금왕'] });
    expect(v.settlement!.report).toEqual(s.settlement!.reports.me);
    expect(JSON.stringify(v.settlement)).not.toContain(String(s.settlement!.reports.b1!.worth));
  });

  it('같은 세계가 이어지면 다음 날 새 시즌이 열리고 다시 명령을 받는다', () => {
    const s = world();
    for (let d = 0; d < 4; d++) advanceDay(s, map);
    expect(s.season!.number).toBe(2);
    expect(s.settlement).toBeNull();
    expect(applyCommand(s, map, 'me', { type: 'restAtInn' })).not.toEqual({ ok: false, error: 'seasonOver' });
  });
});

describe('다음 시즌은 새 세계 (질문 89 답)', () => {
  it('새 시드로 새 세계를 열고, 증서·인장·칭호·연차와 알림 설정만 들고 간다', () => {
    const s = world();
    for (let d = 0; d < 3; d++) advanceDay(s, map);
    s.players.me!.notify.dailyCap = 2;
    const map2 = generateWorld(SEED + 1);
    const next = nextSeasonEconomy(s, map2, SEED + 1);
    expect(next.seed).toBe(SEED + 1);
    expect(next.season!.number).toBe(2);
    expect(next.settlement).toBeNull();
    const me = next.players.me!;
    expect(me.certificate).toEqual(s.players.me!.certificate);
    expect(me.notify.dailyCap).toBe(2);
    expect(me.gold).not.toBe(100);
    expect(me.ledger).toEqual([]);
    expect(me.record).toMatchObject({ season: 2, trades: [] });
    expect(Object.keys(next.players)).toEqual(IDS);
    expect(me.apprentice).toBeNull();
  });
});

describe('신문의 큰 거래 이름', () => {
  it('큰손 상위권이고 이름을 지었으면 이름이, 아니면 "어느 상단"이 실린다', () => {
    const s = createEconomy(map, SEED, { players: ['me', 'b1', 'b2', 'b3', 'b4'].map((id) => ({ id, name: id === 'b4' ? undefined : `${id} 상단` })) });
    [100, 900, 800, 700, 1000].forEach((g, i) => (s.players[['me', 'b1', 'b2', 'b3', 'b4'][i]!]!.gold = g));
    // 순위를 매기기 전에는 모두 익명
    expect(newsName(s, s.players.b1!)).toBe('어느 상단');
    advanceDay(s, map);
    // 큰손 1~3위(b4, b1, b2) 중 이름을 지은 b1, b2만 이름이 실린다
    expect(newsName(s, s.players.b1!)).toBe('b1 상단');
    expect(newsName(s, s.players.b2!)).toBe('b2 상단');
    expect(newsName(s, s.players.b4!)).toBe('어느 상단');
    expect(newsName(s, s.players.me!)).toBe('어느 상단');
  });
});
