// 로컬 게임의 봇 상인 (질문 87 답, 0.1.0)
import { describe, expect, it } from 'vitest';
import { advanceDay, createEconomy, LOCAL_PLAYER, playerList, playerView, type EconomyState } from '../economy';
import { generateWorld } from '../worldgen';
import { BOT_COMPANY_NAMES, botSpecs, createCrew, crewDay, type BotBrain } from './crew';

const SEED = 4242;
const map = generateWorld(SEED);

function world(n: number): { s: EconomyState; crew: BotBrain[] } {
  const specs = botSpecs(SEED, n);
  const s = createEconomy(map, SEED, { warmupDays: 10, players: [{ id: LOCAL_PLAYER }, ...specs] });
  return { s, crew: createCrew(s, specs.map((x) => x.id)) };
}

describe('봇 상인', () => {
  it('상단 이름은 이름 목록에서 겹치지 않게, 세계마다 다르게', () => {
    const a = botSpecs(SEED, 20);
    expect(new Set(a.map((x) => x.name)).size).toBe(20);
    for (const x of a) expect(BOT_COMPANY_NAMES).toContain(x.name);
    expect(botSpecs(1, 20).map((x) => x.name)).not.toEqual(a.map((x) => x.name));
    // 이름보다 많이 달라면 이름 수까지만
    expect(botSpecs(SEED, 99)).toHaveLength(BOT_COMPANY_NAMES.length);
    const { s } = world(3);
    expect(playerList(s).map((p) => p.certificate.name)).toEqual(['이름 없는 상단', ...a.slice(0, 3).map((x) => x.name)]);
  });

  it('봇은 명령으로 장사하고, 머릿속은 JSON으로 저장했다 불러와도 같은 결과', () => {
    const run = (saveAt: number) => {
      let { s, crew } = world(4);
      for (let d = 0; d < 20; d++) {
        if (d === saveAt) ({ s, crew } = JSON.parse(JSON.stringify({ s, crew })) as { s: EconomyState; crew: BotBrain[] });
        crewDay(s, map, crew);
        advanceDay(s, map);
      }
      return s;
    };
    const a = run(-1);
    expect(run(9)).toEqual(a);
    expect(playerList(a).filter((p) => p.id !== LOCAL_PLAYER).every((p) => p.ledger.length > 0)).toBe(true);
    // 사람 자리는 봇이 건드리지 않는다
    expect(a.players[LOCAL_PLAYER]!.ledger.filter((e) => e.kind === 'buy' || e.kind === 'sell')).toEqual([]);
  }, 60000);

  it('내 화면에는 다른 상단의 이름과 있는 곳, 떠돌이 표시만 보인다', () => {
    const { s } = world(3);
    const v = playerView(s, map, LOCAL_PLAYER);
    expect(v.rivals.map((r) => r.id)).toEqual(['bot1', 'bot2', 'bot3']);
    expect(Object.keys(v.rivals[0]!).sort()).toEqual(['bot', 'id', 'location', 'name']);
    expect(v.rivals.every((r) => r.bot)).toBe(true);
  });
});
