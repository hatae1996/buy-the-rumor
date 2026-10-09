// 신문값 (0.1.0 작업 4): 머리기사는 공짜, 사면 전문, 견습 무료, 돈은 세계 밖으로.
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../constants';
import { applyCommand, createEconomy, playerView, type EconomyState } from '../economy';
import { moneySupply } from '../economy/stats';
import { generateWorld } from '../worldgen';

const SEED = 777;
const map = generateWorld(SEED);

/** 어제 장날 신문에 기사 셋, 그제 신문에 기사 하나 */
function withNews(opt: { apprentice?: boolean } = {}): EconomyState {
  const s = createEconomy(map, SEED, { apprentice: opt.apprentice ?? false });
  s.day = 10;
  s.news = [
    { day: 8, text: '그제 머리기사' },
    { day: 9, text: '어제 머리기사' },
    { day: 9, text: '어제 둘째 기사' },
    { day: 9, text: '어제 셋째 기사' },
  ];
  return s;
}

describe('신문', () => {
  it('사지 않은 날은 머리기사(그날 첫 줄)만 보인다', () => {
    const v = playerView(withNews(), map, 'me');
    expect(v.news.map((n) => n.text)).toEqual(['그제 머리기사', '어제 머리기사']);
    expect(v.newspaper.hidden).toEqual({ 9: 2 });
    expect(v.newspaper.free).toBe(false);
  });

  it('사면 그날 전문을 계속 읽는다. 값은 세계 밖으로 나간다', () => {
    const s = withNews();
    const money = moneySupply(s);
    const gold = s.players.me!.gold;
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 9 }).ok).toBe(true);
    expect(s.players.me!.gold).toBe(gold - ECONOMY.newspaper.fee);
    expect(moneySupply(s)).toBe(money - ECONOMY.newspaper.fee);
    expect(s.players.me!.ledger.at(-1)).toMatchObject({ kind: 'info', what: 'newspaper', fee: ECONOMY.newspaper.fee });
    const v = playerView(s, map, 'me');
    expect(v.news.map((n) => n.text)).toEqual(['그제 머리기사', '어제 머리기사', '어제 둘째 기사', '어제 셋째 기사']);
    expect(v.newspaper.hidden).toEqual({});
    s.day = 15;
    expect(playerView(s, map, 'me').news).toHaveLength(4);
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 9 })).toEqual({ ok: false, error: 'alreadyBought' });
  });

  it('지난 신문은 며칠 안의 것만, 아직 안 나온 신문과 돈이 없으면 못 산다', () => {
    const s = withNews();
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 11 })).toEqual({ ok: false, error: 'noPaper' });
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 5 })).toEqual({ ok: false, error: 'noPaper' });
    s.day = 9 + ECONOMY.newspaper.backDays + 1;
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 9 })).toEqual({ ok: false, error: 'noPaper' });
    s.day = 10;
    s.players.me!.gold = 0;
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 9 })).toEqual({ ok: false, error: 'notEnoughGold' });
  });

  it('견습 동안은 무료로 전문을 읽는다', () => {
    const s = withNews({ apprentice: true });
    const v = playerView(s, map, 'me');
    expect(v.newspaper.free).toBe(true);
    expect(v.news).toHaveLength(4);
    expect(applyCommand(s, map, 'me', { type: 'buyNewspaper', day: 9 })).toEqual({ ok: false, error: 'paperFree' });
  });

  it('남이 산 신문은 내 화면에 전문으로 보이지 않는다', () => {
    const s = createEconomy(map, SEED, { players: [{ id: 'me' }, { id: 'b1' }] });
    s.day = 10;
    s.news = [
      { day: 9, text: '머리' },
      { day: 9, text: '둘째' },
    ];
    expect(applyCommand(s, map, 'b1', { type: 'buyNewspaper', day: 9 }).ok).toBe(true);
    expect(playerView(s, map, 'me').news).toHaveLength(1);
    expect(playerView(s, map, 'b1').news).toHaveLength(2);
  });
});
