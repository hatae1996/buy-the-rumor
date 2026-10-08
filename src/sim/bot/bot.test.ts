// 플레이어 봇: 같은 시드면 같은 결과, 명령을 거의 틀리지 않고, 손으로 버는 길(원정)로 시즌 동안 돈을 모은다.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../worldgen';
import { BOT_PROFILES, botProfile, runBot } from './index';

const SEEDS = [20261008, 777, 4242, 1, 99999];
const SEASON = 144;

describe('플레이어 봇', () => {
  it('같은 시드, 같은 성향이면 같은 결과', () => {
    const map = generateWorld(777);
    const a = runBot(777, botProfile('casual'), { days: 40 }, map);
    const b = runBot(777, botProfile('casual'), { days: 40 }, map);
    expect(b).toEqual(a);
  });

  const runs = SEEDS.flatMap((seed) => {
    const map = generateWorld(seed);
    return BOT_PROFILES.map((profile) => ({ seed, run: runBot(seed, profile, { days: SEASON }, map) }));
  });

  it('명령을 거의 틀리지 않는다 (틀린 명령 5% 미만)', () => {
    for (const { seed, run } of runs) {
      const errors = Object.values(run.errors).reduce((a, b) => a + (b ?? 0), 0);
      const commands = run.commandsPerDay * SEASON;
      expect(errors, `시드 ${seed}, ${run.profile.name}`).toBeLessThan(Math.max(3, commands * 0.05));
    }
  });

  it('원정을 하는 봇은 시즌 동안 시작보다 순자산이 늘어난다', () => {
    for (const { seed, run } of runs.filter((r) => r.run.profile.expeditions)) {
      expect(run.worth.at(-1), `시드 ${seed}, ${run.profile.name}`).toBeGreaterThan(run.worth[0]!);
    }
  });

  it('장사가 주 수입이다: 시즌 끝 순자산 가운데 값이 장사꾼 > 원정꾼 (0.0.6 "벌이의 균형")', () => {
    const median = (id: string) => {
      const w = runs.filter((r) => r.run.profile.id === id).map((r) => r.run.worth.at(-1)!).sort((a, b) => a - b);
      return w[Math.floor(w.length / 2)]!;
    };
    expect(median('trader')).toBeGreaterThan(median('gatherer') * 1.5);
  });

  it('장사꾼 봇도 실제로 사고팔고 마을을 옮긴다', () => {
    for (const { seed, run } of runs.filter((r) => r.run.profile.id === 'trader')) {
      expect(run.trades, `시드 ${seed}`).toBeGreaterThan(5);
      expect(run.travels, `시드 ${seed}`).toBeGreaterThan(2);
    }
  });
});
