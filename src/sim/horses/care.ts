// 말 돌보기 (기획서 "말"): 말은 쉬는 날에도 곡물을 먹고, 무리하면 지친다 (플레이어 피로와 같은 규칙).
// 마을에 있으면 마구간에서 먹이고(값은 곡물 시세보다 조금 비싸고, 그만큼 주민이 장에서 곡물을 사 온다),
// 길 위에서는 수레에 실은 곡물을 먹는다. 연달아 굶으면 말이 마구간으로 돌아가 버린다.
import { HORSES } from '../constants';
import { cartCount, takeGoods, type Board } from '../cart';
import type { EconomyState, Trader } from '../economy/state';
import { buyPrice, returnHorse, sellPrice, takeHorse } from './stable';
import { stableAt } from './supply';
import type { Horse, HorseKind } from './types';

const F = HORSES.fatigue;

/** 이 마을 마구간에서 곡물 한 개를 먹이는 값 */
export function feedPrice(state: EconomyState, town: number): number {
  return Math.max(1, Math.round(state.towns[town]!.refPrice.grain * HORSES.stableFeedMarkup));
}

/** 마구간에서 먹인다: 돈은 마을 금고로, 먹인 곡물은 내일 주민이 장에서 사 온다 */
function stableFeed(state: EconomyState, town: number, qty: number, pay: (fee: number) => boolean): boolean {
  const fee = qty * feedPrice(state, town);
  if (!pay(fee)) return false;
  const t = state.towns[town]!;
  t.treasury += fee;
  t.stableGrain += qty;
  return true;
}

/** 먹었으면 피로를 풀고, 굶었으면 피로가 쌓인다. 너무 오래 굶으면 도망친다 (true) */
function afterMeal(h: Horse, fed: boolean, resting: boolean): boolean {
  if (fed) {
    h.hungry = 0;
    if (resting) h.fatigue = Math.max(0, h.fatigue - F.nightlyRecovery);
    return false;
  }
  h.hungry++;
  h.fatigue = Math.min(F.max, h.fatigue + F.hunger);
  return h.hungry >= HORSES.runAwayAfterHungryDays;
}

/**
 * 플레이어 쪽 말 무리를 먹이고 쉬게 한다 (내 행렬, 두 번째 행렬). 남은 말을 돌려준다.
 * town이 null이면 길 위: 그 행렬 수레(board)에 실은 곡물을 먹는다
 */
export function feedHorses(state: EconomyState, horses: readonly Horse[], town: number | null, board: Board, resting = town !== null): Horse[] {
  const p = state.player;
  let fee = 0;
  let fedAtStable = 0;
  const keep: Horse[] = [];
  for (const h of horses) {
    const need = HORSES.kinds[h.kind].feed;
    let fed = false;
    if (town !== null) {
      fed = stableFeed(state, town, need, (f) => {
        if (p.gold < f) return false;
        p.gold -= f;
        fee += f;
        fedAtStable += need;
        return true;
      });
    }
    // 길 위이거나 돈이 모자라면 수레에 실은 곡물을 먹는다
    if (!fed && cartCount(board, 'grain') >= need) {
      takeGoods(board, 'grain', need);
      p.ledger.push({ day: state.day, kind: 'horseFeed', town, qty: need, fee: 0 });
      fed = true;
    }
    if (afterMeal(h, fed, resting)) {
      returnHorse(state, h.home, h);
      p.ledger.push({ day: state.day, kind: 'horse', what: 'lost', town: h.home, horse: h.kind, price: 0 });
    } else keep.push(h);
  }
  if (fee > 0) p.ledger.push({ day: state.day, kind: 'horseFeed', town, qty: fedAtStable, fee });
  return keep;
}

/** 밤에: 플레이어 말을 먹이고 쉬게 한다 */
export function playerHorsesNight(state: EconomyState): void {
  const p = state.player;
  p.horsesRested = false;
  if (!p.horses.length) return;
  p.horses = feedHorses(state, p.horses, p.travel ? null : p.town, p.cart);
}

/** 밤에: NPC 상단 말. 상단은 지치지 않고, 있는 마을(길 위면 가는 마을) 마구간 값으로 먹인다 */
export function traderHorsesNight(state: EconomyState, t: Trader): void {
  const keep: Horse[] = [];
  const town = t.travel ? t.travel.to : t.town;
  for (const h of t.horses) {
    const fed = stableFeed(state, town, HORSES.kinds[h.kind].feed, (f) => {
      if (t.gold < f) return false;
      t.gold -= f;
      return true;
    });
    // 굶다 도망친 말은 마구간으로 돌아간다 (파산하면 말은 시장으로)
    if (afterMeal(h, fed, true)) returnHorse(state, h.home, h);
    else keep.push(h);
  }
  t.horses = keep;
}

/**
 * NPC 상단과 마구간: 돈이 넉넉하고 말이 없으면 짐말, 빠른 말, 조랑말 순으로 사고,
 * 돈이 떨어지면 그 마구간에 되판다
 */
export function traderHorseDeal(state: EconomyState, t: Trader): void {
  if (t.travel) return;
  const stable = stableAt(state, t.town);
  if (!stable) return;
  const town = state.towns[t.town]!;
  const own = t.horses[0];
  if (own) {
    const price = sellPrice(stable, own.kind);
    if (t.gold >= HORSES.traderSellGold || town.treasury < price) return;
    t.horses = [];
    returnHorse(state, t.town, own);
    town.treasury -= price;
    t.gold += price;
    return;
  }
  if (t.gold < HORSES.traderBuyGold) return;
  const order: HorseKind[] = ['draft', 'swift', 'pony'];
  for (const kind of order) {
    const price = buyPrice(stable, kind);
    // 남은 돈이 장사 밑천보다 적어지면 사지 않는다
    if (price === null || t.gold - price < HORSES.traderBuyGold / 2) continue;
    const h = takeHorse(state, stable, kind)!;
    t.gold -= h.price;
    t.horses.push(h);
    return;
  }
}
