// 봇 상단 "떠돌이" (0.2.0 9번, 답 108): 내 세계 순위·지도·신문에는 보이고, 시즌 전체 순위·인장·칭호에서는 뺀다
import { describe, expect, it } from 'vitest';
import { botSpecs } from '../bot';
import { createEconomy, getPlayer, nextSeasonEconomy, playerList, playerView, type EconomyState } from '../economy';
import { fillBots, openWorld, seasonMap, tickWorld, type WorldBlob } from '../service';
import { generateWorld } from '../worldgen';
import { awardBadge } from './record';
import { newsName, rankAll, scoreRows } from './table';

const SEASON = '2026-10-26';
const ME = 'me';

/** 사람 한 명 + 봇 11, 시즌을 짧게 해 결산까지 돌린다 */
function playedSeason(days = 8): WorldBlob {
  const map = seasonMap(SEASON);
  const blob = openWorld(map, { seasonId: SEASON, worldId: 'w1', humans: [{ id: ME, name: '소금 상단', apprentice: false }], bots: 11, warmupDays: 3 });
  blob.state.season!.length = days;
  while (tickWorld(blob, map)) {
    /* 결산까지 */
  }
  return blob;
}

describe('봇 표시', () => {
  it('봇 자리와 채운 봇은 봇, 사람은 사람', () => {
    expect(botSpecs(1, 3).every((s) => s.bot)).toBe(true);
    const map = seasonMap(SEASON);
    const blob = openWorld(map, { seasonId: SEASON, worldId: 'w1', humans: [{ id: ME, name: '소금 상단' }], bots: 2, warmupDays: 0 });
    expect(playerList(blob.state).map((p) => [p.id, p.bot])).toEqual([
      [ME, false],
      ['bot1', true],
      ['bot2', true],
    ]);
    const empty = openWorld(map, { seasonId: SEASON, worldId: 'w2', warmupDays: 0 });
    fillBots(empty, map);
    expect(playerList(empty.state).every((p) => p.bot)).toBe(true);
  });

  it('다음 시즌에도 봇은 봇', () => {
    const map = generateWorld(5);
    const s = createEconomy(map, 5, { players: [{ id: ME }, ...botSpecs(5, 2)] });
    const next = nextSeasonEconomy(s, generateWorld(6), 6);
    expect(playerList(next).map((p) => p.bot)).toEqual([false, true, true]);
  });

  it('화면 데이터의 증서와 다른 상단에 봇 표시', () => {
    const blob = openWorld(seasonMap(SEASON), { seasonId: SEASON, worldId: 'w1', humans: [{ id: ME, name: '소금 상단' }], bots: 2, warmupDays: 0 });
    const v = playerView(blob.state, seasonMap(SEASON), ME);
    expect(v.rivals.map((r) => r.bot)).toEqual([true, true]);
    expect(v.certificates[ME]!.bot).toBe(false);
    expect(v.certificates.bot1!.bot).toBe(true);
  });
});

describe('순위와 결산에서 봇 빼기', () => {
  it('점수 줄에 봇 표시, 내 세계 순위에는 봇도, 시즌 전체 순위는 사람만', () => {
    const blob = playedSeason();
    const rows = scoreRows(blob.state);
    expect(rows.some((r) => r.bot)).toBe(true);
    expect(rows.filter((r) => r.playerId.startsWith('bot')).every((r) => r.bot)).toBe(true);
    const { world, season } = rankAll(blob.state);
    const ids = (t: typeof world) => Object.values(t).flatMap((rs) => rs!.map((r) => r.id));
    expect(ids(world).some((id) => id.startsWith('bot'))).toBe(true);
    expect(ids(season).every((id) => id === ME)).toBe(true);
  });

  it('시즌 전체 순위에 다른 세계의 봇 줄도 섞지 않는다', () => {
    const blob = playedSeason();
    const other = { seasonId: SEASON, worldId: 'w2', playerId: 'bot1', name: '먼 봇', bot: true, category: 'bigShot' as const, score: 1e9 };
    expect(rankAll(blob.state, [other]).season.bigShot!.some((r) => r.worldId === 'w2')).toBe(false);
  });

  it('결산: 봇은 인장·칭호·연차를 받지 않는다', () => {
    const blob = playedSeason();
    const st = blob.state.settlement!;
    expect(st).not.toBeNull();
    for (const p of playerList(blob.state).filter((x) => x.bot)) {
      expect(p.certificate.badges).toEqual([]);
      expect(p.certificate.titles).toEqual([]);
      expect(p.certificate.seasonsCompleted).toBe(0);
      expect(st.awarded[p.id]).toBeUndefined();
    }
    // 사람은 완주 인장과 연차
    expect(getPlayer(blob.state, ME).certificate.seasonsCompleted).toBe(1);
    expect(st.awarded[ME]!.badges.length).toBeGreaterThan(0);
  });

  it('봇에게는 시즌 중 인장도 찍히지 않는다', () => {
    const s: EconomyState = createEconomy(generateWorld(5), 5, { players: [{ id: ME }, ...botSpecs(5, 1)] });
    expect(awardBadge(s, getPlayer(s, 'bot1'), 'season-1', null)).toBeNull();
    expect(awardBadge(s, getPlayer(s, ME), 'season-1', null)).not.toBeNull();
  });

  it('신문 큰손 기사에 실리는 봇 이름에는 떠돌이 표시', () => {
    const blob = playedSeason();
    const s = blob.state;
    const top = s.rankings!.table.bigShot!.find((r) => r.id.startsWith('bot'))!;
    s.rankings!.table.bigShot = [{ ...top, rank: 1 }];
    const bot = getPlayer(s, top.id);
    expect(newsName(s, bot)).toBe(`${bot.certificate.name}(떠돌이)`);
  });
});
