// 봇도 신문을 산다 (0.1.6 답 116 가): 도시 시세를 모르면 신문을 사서 실린 값을 아는 시세로 기억한다.
import { describe, expect, it } from 'vitest';
import { createCart } from '../cart';
import { advanceDay, createEconomy, getPlayer, playerView, type PlayerView } from '../economy';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { createMind } from './bot';
import { knownPrices, readPapers } from './paper';
import { botProfile } from './profiles';
import { botTurn } from './run';

const SEED = 777;
const map = generateWorld(SEED, { towns: 6 });
const city = map.towns.find((t) => t.tier === 'city')!.id;
const home = map.towns.find((t) => t.tier !== 'city')!.id;

function world() {
  const state = createEconomy(map, SEED, { warmupDays: 20, players: [{ id: 'bot1' }] });
  const p = getPlayer(state, 'bot1');
  p.cart = createCart('handcart');
  p.town = home;
  return { state, p };
}

describe('봇과 신문 (0.1.6)', () => {
  it('도시 시세를 모르면 신문이 나온 날 신문을 사고, 실린 도시 시세를 기억한다', () => {
    const { state, p } = world();
    const mind = createMind();
    const rng = createRng(1);
    // 신문은 첫 장날 뒤에 나온다. 도시에서 먼 마을은 하루 늦게 온다
    for (let d = 0; d < 3 && !p.newspapers.length; d++) {
      if (!p.travel) botTurn(state, map, 'bot1', botProfile('trader'), mind, rng);
      if (p.newspapers.length) break;
      advanceDay(state, map);
    }
    expect(p.newspapers).toHaveLength(1);
    expect(p.ledger.some((e) => e.kind === 'info' && e.what === 'newspaper')).toBe(true);
    const day = p.newspapers[0]!;
    const line = state.news.find((n) => n.day === day && n.section === 'prices' && n.town === city)!;
    expect(mind.papers?.[city]).toEqual({ day, prices: line.prices });
    // 이미 알면 다시 사지 않는다
    botTurn(state, map, 'bot1', botProfile('trader'), mind, rng);
    expect(p.newspapers).toHaveLength(1);
  });

  it('원정만 하는 봇은 신문을 사지 않는다', () => {
    const { state, p } = world();
    const mind = createMind();
    for (let d = 0; d < 3; d++) {
      if (!p.travel) botTurn(state, map, 'bot1', botProfile('gatherer'), mind, createRng(d));
      advanceDay(state, map);
    }
    expect(p.newspapers).toEqual([]);
  });

  it('아는 시세: 가 본 마을의 기억에 더 새 신문 값을 얹고, 신문으로만 아는 마을은 실린 물품만 안다', () => {
    const mind = createMind();
    mind.papers = { 1: { day: 5, prices: { wood: 20 } }, 2: { day: 3, prices: { wood: 99 } } };
    const view = {
      memory: {
        0: { day: 4, prices: { wood: 10, fish: 7 }, previous: null },
        2: { day: 6, prices: { wood: 12, fish: 8 }, previous: null },
      },
      news: [],
    } as unknown as PlayerView;
    const known = knownPrices(view, mind);
    expect(known[0]).toEqual({ day: 4, prices: { wood: 10, fish: 7 } });
    expect(known[1]).toEqual({ day: 5, prices: { wood: 20 } });
    // 가 본 기억이 더 새면 신문 값은 쓰지 않는다
    expect(known[2]).toEqual({ day: 6, prices: { wood: 12, fish: 8 } });
  });

  it('예전 저장의 머릿속(신문 칸 없음)과 값이 없는 예전 기사도 읽는다', () => {
    const mind = createMind();
    delete mind.papers;
    const view = { news: [{ day: 3, text: '애쉬포드 장 시세: 목재 12골드', section: 'prices' }] } as unknown as PlayerView;
    readPapers(view, mind);
    expect(mind.papers).toEqual({});
  });

  it('같은 시드면 같은 결과 (신문을 사는 날도 같다)', () => {
    const run = () => {
      const { state, p } = world();
      const mind = createMind();
      const rng = createRng(3);
      for (let d = 0; d < 6; d++) {
        if (!p.travel) botTurn(state, map, 'bot1', botProfile('casual'), mind, rng);
        advanceDay(state, map);
      }
      return { ledger: p.ledger, papers: p.newspapers, view: playerView(state, map, 'bot1').gold };
    };
    expect(run()).toEqual(run());
  });
});
