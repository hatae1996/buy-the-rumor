// 봇 돌리기: 세계 하나에 봇 하나를 플레이어 자리에 앉혀 여러 날을 돌리고 기록한다.
// 지금은 플레이어 자리가 하나라, 여러 봇은 같은 시드의 세계를 따로 돌려 비교한다 (서로 경쟁하지 않는다).
import { applyCommand, createEconomy, advanceDay, playerView, type CommandError, type EconomyState } from '../economy';
import { createRng, mixSeed } from '../rng';
import { generateWorld, type WorldMap } from '../worldgen';
import { botStep, createMind } from './bot';
import type { BotProfile } from './profiles';
import { netWorth } from '../ranking/worth';

export interface BotRun {
  profile: BotProfile;
  /** 날마다 순자산 (기획서 랭킹 계산: 현금 + 맡긴 돈 + (짐과 말) × 절반, src/sim/ranking/worth.ts) */
  worth: number[];
  gold: number[];
  trades: number;
  expeditions: number;
  travels: number;
  /** 하루에 고른 명령 수 평균 (접속 한 번에 하는 일) */
  commandsPerDay: number;
  /** 실패한 명령 (봇이 잘못 판단한 횟수) */
  errors: Partial<Record<CommandError, number>>;
}

export interface BotRunOptions {
  days: number;
  /** 플레이어가 오기 전에 세계를 미리 돌리는 날 (게임과 같게 20) */
  warmupDays?: number;
  /** 하루에 고를 수 있는 명령 수 상한 (끝없이 돌지 않게) */
  maxCommandsPerDay?: number;
}

export function runBot(seed: number, profile: BotProfile, opt: BotRunOptions, world?: WorldMap): BotRun {
  const map = world ?? generateWorld(seed);
  const state = createEconomy(map, seed, { warmupDays: opt.warmupDays ?? 20 });
  return runBotOn(state, map, profile, opt);
}

export function runBotOn(state: EconomyState, map: WorldMap, profile: BotProfile, opt: BotRunOptions): BotRun {
  // 봇의 판단은 세계와 다른 난수로 (세계의 난수를 건드리지 않는다)
  const rng = createRng(mixSeed(state.seed, profile.id.length * 7919 + profile.id.charCodeAt(0)));
  const mind = createMind();
  const run: BotRun = { profile, worth: [], gold: [], trades: 0, expeditions: 0, travels: 0, commandsPerDay: 0, errors: {} };
  const max = opt.maxCommandsPerDay ?? 40;
  let commands = 0;

  for (let d = 0; d < opt.days; d++) {
    for (let i = 0; i < max; i++) {
      const cmd = botStep(playerView(state, map), map, profile, mind, rng);
      if (!cmd) break;
      commands++;
      const r = applyCommand(state, map, cmd);
      if (!r.ok) run.errors[r.error] = (run.errors[r.error] ?? 0) + 1;
      else if (cmd.type === 'startExpedition') run.expeditions++;
      else if (cmd.type === 'travel') run.travels++;
    }
    const ledgerBefore = state.player.ledger.length;
    advanceDay(state, map);
    run.trades += state.player.ledger.slice(ledgerBefore).filter((e) => e.kind === 'buy' || e.kind === 'sell').length;
    run.worth.push(netWorth(state));
    run.gold.push(state.player.gold);
  }
  run.commandsPerDay = commands / Math.max(1, opt.days);
  return run;
}
