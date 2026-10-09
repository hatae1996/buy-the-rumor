// 봇 돌리기: 세계 하나에 봇 하나를 플레이어 자리에 앉혀 여러 날을 돌리고 기록한다.
// 지금은 플레이어 자리가 하나라, 여러 봇은 같은 시드의 세계를 따로 돌려 비교한다 (서로 경쟁하지 않는다).
import { applyCommand, createEconomy, advanceDay, playerView, type CommandError, type EconomyState, type GoodId } from '../economy';
import { createRng, mixSeed } from '../rng';
import { generateWorld, type WorldMap } from '../worldgen';
import { botStep, createMind } from './bot';
import type { AffordKind, GrowthKind } from './growth';
import { createCart } from '../cart';
import type { BotProfile } from './profiles';
import { netWorth, worthParts } from '../ranking/worth';
import { seasonOfDay, type Season } from '../season';
import { eventDef } from '../events';

export interface BotRun {
  profile: BotProfile;
  /** 플레이어가 온 날(1일)의 계절 */
  startSeason: Season;
  /** 날마다 순자산 (기획서 랭킹 계산: 현금 + 맡긴 돈 + (짐과 말) × 절반, src/sim/ranking/worth.ts) */
  worth: number[];
  /** 날마다 가진 것의 온값 (현금 + 예금 − 빚 + 짐 + 말). 하루 벌이는 이것의 변화로 잰다 (순자산은 짐을 절반만 쳐서 산 날 줄어 보인다) */
  wealth: number[];
  /** 날마다 하루 유지비 (일당, 말 먹이, 보관료) */
  upkeep: number[];
  /** 날마다 판 것의 이익 (판 값 − 산 값. 원정에서 얻은 것은 산 값 0). "10배 번 날"을 센다 */
  profit: number[];
  gold: number[];
  trades: number;
  expeditions: number;
  travels: number;
  /** 하루에 고른 명령 수 평균 (접속 한 번에 하는 일) */
  commandsPerDay: number;
  /** 실패한 명령 (봇이 잘못 판단한 횟수) */
  errors: Partial<Record<CommandError, number>>;
  /** 이 시즌에 일어난 큰 주문 사건이 어느 계절이었나 (0.0.8: 겨울에 더 자주) */
  bigOrders: Season[];
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
  /** 시작 계절을 정한다 (없으면 시드로 랜덤). 시작 계절마다 재 볼 때 (0.0.8) */
  startSeason?: Season;
}

export function runBot(seed: number, profile: BotProfile, opt: BotRunOptions, world?: WorldMap): BotRun {
  const map = world ?? generateWorld(seed);
  const state = createEconomy(map, seed, { warmupDays: opt.warmupDays ?? 20, startSeason: opt.startSeason });
  // 봇은 견습을 마친 자리에서 시작한다: 졸업 선물 손수레 (기획서 "처음 하는 플레이어")
  state.player.cart = createCart('handcart');
  return runBotOn(state, map, profile, opt);
}

/**
 * 하루 벌이: from일부터 to일까지 가진 것의 온값이 하루에 는 양 (시작 200에서).
 * 첫 5일 목표(5~10)만 이것으로 잰다: 처음엔 사 모아 두는 것도 좋은 장사라 판 것의 이익으로는 0에 가깝다 (questions.md 76번, 0.0.9)
 */
export function dailyIncome(run: BotRun, from: number, to: number, start = 200): number {
  const w = [start, ...run.wealth];
  const b = Math.min(to, w.length - 1);
  const a = Math.min(from, b - 1);
  return (w[b]! - w[a]!) / Math.max(1, b - a);
}

/**
 * 판 것의 이익으로 잰 하루 벌이: from일 다음 날부터 to일까지 (날은 1부터, dailyIncome과 같은 구간) 하루 평균.
 * 기획에서 정한 "그날 벌이" = 판 값 − 산 값, 원정에서 얻은 것은 산 값 0 (questions.md 75번)
 */
export function profitIncome(run: BotRun, from: number, to: number): number {
  const days = run.profit.slice(Math.max(0, from), Math.max(0, to));
  return days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
}

/**
 * 시즌 벌이 (0.0.8 목표): 시즌 평균 하루 벌이, 전반(앞쪽 절반)과 후반(뒤쪽 절반) 평균.
 * 겨울은 얇은 계절이라 시즌 끝 하루 벌이로 재지 않고, 후반 평균이 전반보다 높은지를 본다
 */
export function seasonIncome(run: BotRun): { avg: number; firstHalf: number; secondHalf: number } {
  const n = run.profit.length;
  const half = Math.floor(n / 2);
  return { avg: profitIncome(run, 0, n), firstHalf: profitIncome(run, 0, half), secondHalf: profitIncome(run, half, n) };
}

/**
 * "하루 벌이의 10배 넘게 번 날" 수 (0.0.7 목표: 보통 사람이 시즌에 2~3번).
 * 그날 벌이 = 그날 판 것의 이익(판 값 − 산 값), 평소 하루 벌이 = 그 시즌 평균, 적어도 1냥 (questions.md 75번).
 * 가진 것의 온값으로 재면 싸게 사기만 해도 뛰어서 쓰지 않는다
 */
export function bigDays(run: BotRun, times = 10): number {
  const usual = Math.max(1, run.profit.reduce((a, b) => a + b, 0) / Math.max(1, run.profit.length));
  return run.profit.filter((d) => d >= usual * times).length;
}

export function runBotOn(state: EconomyState, map: WorldMap, profile: BotProfile, opt: BotRunOptions): BotRun {
  // 봇의 판단은 세계와 다른 난수로 (세계의 난수를 건드리지 않는다)
  const rng = createRng(mixSeed(state.seed, profile.id.length * 7919 + profile.id.charCodeAt(0)));
  const mind = createMind();
  const run: BotRun = { profile, startSeason: state.startSeason, bigOrders: [], worth: [], wealth: [], upkeep: [], profit: [], gold: [], trades: 0, expeditions: 0, travels: 0, commandsPerDay: 0, errors: {}, firsts: mind.growth.firsts, couldAfford: mind.growth.couldAfford };
  const max = opt.maxCommandsPerDay ?? 40;
  let commands = 0;
  const cost: Partial<Record<GoodId, { qty: number; value: number }>> = {};

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
    // 판 것의 이익: 물품마다 산 값 평균을 들고 다닌다
    let profit = 0;
    for (const e of state.player.ledger.slice(ledgerBefore)) {
      if (e.kind === 'buy') {
        const c = cost[e.good] ?? { qty: 0, value: 0 };
        cost[e.good] = { qty: c.qty + e.qty, value: c.value + e.qty * e.price };
      } else if (e.kind === 'sell') {
        const c = cost[e.good] ?? { qty: 0, value: 0 };
        const unit = c.qty > 0 ? c.value / c.qty : 0;
        const used = Math.min(c.qty, e.qty);
        cost[e.good] = { qty: c.qty - used, value: c.value - used * unit };
        profit += e.qty * e.price - used * unit;
      }
    }
    run.profit.push(Math.round(profit));
    run.trades += state.player.ledger.slice(ledgerBefore).filter((e) => e.kind === 'buy' || e.kind === 'sell').length;
    run.worth.push(netWorth(state));
    const p = worthParts(state);
    run.wealth.push(Math.round(p.cash + p.deposit - p.debt + p.goods + p.horses));
    run.upkeep.push(playerView(state, map).upkeep.total);
    run.gold.push(state.player.gold);
  }
  run.commandsPerDay = commands / Math.max(1, opt.days);
  run.bigOrders = (state.season?.log ?? [])
    .filter((e) => eventDef(e.event).effects.some((x) => x.kind === 'bigOrder'))
    .map((e) => seasonOfDay(e.day, state.startSeason));
  return run;
}
