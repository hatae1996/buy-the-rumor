// 봇 기록으로 재는 벌이 (0.0.8 목표): 시즌 평균 하루 벌이, 전반·후반 평균, 시작 계절을 정해 돌리기.
import { describe, expect, it } from 'vitest';
import { WINTER } from '../season';
import { generateWorld } from '../worldgen';
import { botProfile } from './profiles';
import { profitIncome, runBot, seasonIncome, type BotRun } from './run';

/** 판 것의 이익만 채운 기록 */
const withProfit = (profit: number[]): BotRun => ({ profit }) as BotRun;

describe('벌이 재기', () => {
  it('하루 벌이는 그 구간 날들의 판 것의 이익 평균', () => {
    const run = withProfit([0, 10, 20, 30, 40, 50]);
    expect(profitIncome(run, 0, 6)).toBe(25);
    expect(profitIncome(run, 1, 3)).toBe(15);
    // 기록보다 긴 구간은 있는 날만
    expect(profitIncome(run, 4, 100)).toBe(45);
    expect(profitIncome(run, 10, 20)).toBe(0);
  });

  it('시즌 벌이: 평균, 앞쪽 절반, 뒤쪽 절반', () => {
    expect(seasonIncome(withProfit([0, 10, 20, 30]))).toEqual({ avg: 15, firstHalf: 5, secondHalf: 25 });
    // 큰 주문 하루가 후반에 있으면 후반이 높다
    const s = seasonIncome(withProfit([5, 5, 5, 5, 5, 0, 0, 300, 0, 0]));
    expect(s.secondHalf).toBeGreaterThan(s.firstHalf);
    expect(s.avg).toBe(32.5);
  });

  it('시작 계절을 정해 봇을 돌린다', () => {
    const run = runBot(777, botProfile('casual'), { days: 3, startSeason: WINTER }, generateWorld(777));
    expect(run.startSeason).toBe(WINTER);
    expect(run.profit).toHaveLength(3);
  });
});
