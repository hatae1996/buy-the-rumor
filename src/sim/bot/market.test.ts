// 봇 여럿이 한 시장 (0.1.0 작업 2): 같은 시드면 같은 결과, 사람이 많으면 한 사람 벌이가 준다.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../worldgen';
import { byProfile, MARKET_MIX, runBots } from './market';
import { runBot } from './run';

const SEED = 777;
const map = generateWorld(SEED);

describe('봇 n명 한 시장', () => {
  it('같은 시드면 같은 결과', () => {
    const a = runBots(SEED, 4, { days: 20 }, map);
    const b = runBots(SEED, 4, { days: 20 }, map);
    expect(b).toEqual(a);
    expect(a.seats.map((s) => s.profile.id)).toEqual(MARKET_MIX.map((p) => p.id));
  }, 60000);

  it('한 명이면 혼자 돌린 봇과 같다', () => {
    const one = runBots(SEED, 1, { days: 30 }, map).seats[0]!;
    const solo = runBot(SEED, MARKET_MIX[0]!, { days: 30 }, map);
    expect(one.worth).toEqual(solo.worth);
    expect(one.profit).toEqual(solo.profit);
  }, 60000);

  it('같은 성향 봇이 여럿이어도 저마다 다르게 움직인다', () => {
    const r = runBots(SEED, 5, { days: 15 }, map);
    const casual = r.seats.filter((s) => s.profile.id === 'casual');
    expect(casual.length).toBeGreaterThan(1);
    expect(new Set(casual.map((s) => JSON.stringify(s.worth))).size).toBe(casual.length);
  }, 60000);

  it('사람이 많으면 한 사람 벌이가 준다 (40명이 1명보다 낮다)', () => {
    const days = 40;
    const solo = byProfile(runBots(SEED, 1, { days }, map)).casual!;
    const crowd = byProfile(runBots(SEED, 40, { days }, map)).casual!;
    expect(crowd.endWorth).toBeLessThan(solo.endWorth);
  }, 120000);
});
