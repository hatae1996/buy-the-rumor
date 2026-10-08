// 봇 돌리기: 세계 하나에 봇 하나를 플레이어 자리에 앉혀 여러 날을 돌리고 기록한다.
// 지금은 플레이어 자리가 하나라, 여러 봇은 같은 시드의 세계를 따로 돌려 비교한다 (서로 경쟁하지 않는다).
import { applyCommand, createEconomy, advanceDay, playerView, type CommandError, type EconomyState } from '../economy';
import { createRng, mixSeed } from '../rng';
import { generateWorld, type WorldMap } from '../worldgen';
import { botStep, createMind } from './bot';
import type { AffordKind, GrowthKind } from './growth';
import { createCart } from '../cart';
import type { BotProfile } from './profiles';
import { netWorth, worthParts } from '../ranking/worth';

export interface BotRun {
  profile: BotProfile;
  /** 날마다 순자산 (기획서 랭킹 계산: 현금 + 맡긴 돈 + (짐과 말) × 절반, src/sim/ranking/worth.ts) */
  worth: number[];
  /** 날마다 가진 것의 온값 (현금 + 예금 − 빚 + 짐 + 말). 하루 벌이는 이것의 변화로 잰다 (순자산은 짐을 절반만 쳐서 산 날 줄어 보인다) */
  wealth: number[];
  gold: number[];
  trades: number;
  expeditions: number;
  travels: number;
  /** 하루에 고른 명령 수 평균 (접속 한 번에 하는 일) */
  commandsPerDay: number;
  /** 실패한 명령 (봇이 잘못 판단한 횟수) */
  errors: Partial<Record<CommandError, number>>;
  /** 처음 산 날 (말, 짐수레, 짐꾼, 채집꾼, 창고, 두 번째 행렬, 장비). 시즌 안에 안 샀으면 없다 */
  firsts: Partial<Record<GrowthKind, number>>;
  /** 셈과 상관없이 돈으로는 살 수 있게 된 첫날 (그 마을에 마구간·게시판이 있을 때) */
  couldAfford: Partial<Record<AffordKind, number>>;
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
  // 봇은 견습을 마친 자리에서 시작한다: 졸업 선물 손수레 (기획서 "처음 하는 플레이어")
  state.player.cart = createCart('handcart');
  return runBotOn(state, map, profile, opt);
}

export function runBotOn(state: EconomyState, map: WorldMap, profile: BotProfile, opt: BotRunOptions): BotRun {
  // 봇의 판단은 세계와 다른 난수로 (세계의 난수를 건드리지 않는다)
  const rng = createRng(mixSeed(state.seed, profile.id.length * 7919 + profile.id.charCodeAt(0)));
  const mind = createMind();
  const run: BotRun = { profile, worth: [], wealth: [], gold: [], trades: 0, expeditions: 0, travels: 0, commandsPerDay: 0, errors: {}, firsts: mind.growth.firsts, couldAfford: mind.growth.couldAfford };
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
    const p = worthParts(state);
    run.wealth.push(Math.round(p.cash + p.deposit - p.debt + p.goods + p.horses));
    run.gold.push(state.player.gold);
  }
  run.commandsPerDay = commands / Math.max(1, opt.days);
  return run;
}
