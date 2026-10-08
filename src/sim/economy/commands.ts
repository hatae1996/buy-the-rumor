// 플레이어 명령. 화면은 명령을 보내고 결과 상태를 그리기만 한다.
// 나중에 멀티플레이를 붙이면 이 명령을 서버로 보낸다.
import { CART, ECONOMY, HORSES } from '../constants';
import { seasonOfDay } from '../season';
import type { WorldMap } from '../worldgen';
import { tollAt } from '../events';
import { Accounts } from './accounts';
import { FOODS, GOODS, type GoodId } from './goods';
import {
  cartCount,
  cartLots,
  cartWeight,
  discardPiece,
  movePiece,
  packCart,
  rotatePiece,
  takeGoods,
  unitWeight,
} from '../cart';
import { sellableCount } from './inventory';
import {
  buyGear,
  chooseExpeditionCard,
  finishExpedition,
  GEAR_KINDS,
  hireGuide,
  repairGear,
  startExpedition,
  type ExpeditionError,
  type GearKind,
} from '../expedition';
import { innOf, mealRecovery, pickMeal, spoilRateToday } from './player';
import { buyDrink, dismissInformant, hireInformant, sendPigeon, type RumorError } from '../rumors';
import {
  buyCart,
  buyHorse,
  HORSE_KINDS,
  lacksHorses,
  maxWeight,
  restHorses,
  sellHorse,
  type HorseError,
  type HorseKind,
} from '../horses';
import { CART_TYPES, type Board, type CartType } from '../cart';
import { playerTravelDays } from './travel';
import { apprenticeAfterCommand, updateUnlocks } from '../apprentice';
import { checkBadges } from '../ranking';
import type { NotifyKind } from '../notify';
import { disbandCaravan, formCaravan, recallCaravan, setCaravanPlan, type CaravanError, type CaravanPlan } from '../caravan';
import { arrangeBoard, type ArrangeError, type Placement } from '../cart';
import { dismiss, hire, porterBoards, resolveBoard, splitBuy, splitSell, transferGoods, type BoardError, type BoardRef, type HireError, type HireRole } from '../hire';
import { releaseWarehouse, rentWarehouse, retrieveGoods, storeGoods, warehouseAt, type WarehouseError } from '../warehouse/warehouse';
import type { EconomyState } from './state';

export type Command =
  | { type: 'placeBuyOrder'; good: GoodId; qty: number; maxPrice: number }
  | { type: 'placeSellOrder'; good: GoodId; qty: number; minPrice: number }
  | { type: 'cancelOrder'; orderId: number }
  | { type: 'travel'; to: number }
  /** 짐에 있는 음식 하나를 먹어 피로를 던다 */
  | { type: 'eat'; good: GoodId }
  /** 지금 마을 여관에서 쉰다 (하루 한 번) */
  | { type: 'restAtInn' }
  /** 수레 짐 조각을 옮긴다 (같은 물품 조각 위에 놓으면 합친다) */
  | { type: 'moveCartPiece'; pieceId: number; x: number; y: number; rot: number }
  /** 톡 눌러 돌린다 */
  | { type: 'rotateCartPiece'; pieceId: number }
  /** 빈칸 정리 */
  | { type: 'packCart' }
  /** 수레(또는 내 판) 최종 배치: 폰이 퍼즐을 풀고 마지막 자리만 보낸다. 시뮬이 모양·겹침을 다시 검사한다 */
  | { type: 'arrangeCart'; board?: BoardRef; pieces: Placement[] }
  /** 짐 조각을 버린다 */
  | { type: 'discardCartPiece'; pieceId: number }
  /** 원정을 나간다 (기회 1개를 쓴다) */
  | { type: 'startExpedition' }
  /** 펼친 원정 카드의 선택지를 고른다 (0: 왼쪽, 1: 오른쪽, 2부터: 장비나 말이 여는 선택지) */
  | { type: 'chooseExpeditionCard'; choice: number }
  /** 원정을 그만두고 돌아온다 */
  | { type: 'endExpedition' }
  /** 여관에서 술 한 잔을 사고 소문 하나를 더 듣는다 (하루 한 번) */
  | { type: 'buyDrink' }
  /** 먼 마을로 전서구를 보낸다 (그 마을 오늘 시세가 다음 날 온다) */
  | { type: 'sendPigeon'; to: number }
  /** 지금 마을에 정보원을 심는다 (여관 고용 게시판) */
  | { type: 'hireInformant' }
  | { type: 'dismissInformant'; town: number }
  /** 지금 마을 마구간에서 말을 산다 / 되판다 */
  | { type: 'buyHorse'; kind: HorseKind }
  | { type: 'sellHorse'; horseId: number }
  /** 마구간에서 말을 쉬게 한다 (하루 한 번) */
  | { type: 'restHorses' }
  /** 수레방에서 수레를 바꾼다 (쓰던 수레는 쳐 준다) */
  | { type: 'buyCart'; cart: CartType }
  /** 잡화점에서 장비(활, 횃불, 덫, 그물)를 산다 */
  | { type: 'buyGear'; gear: GearKind }
  /** 닳은 장비를 수레의 도구 하나로 고친다 */
  | { type: 'repairGear'; gear: GearKind }
  /** 여관에서 안내인을 고용한다 (다음 원정 한 번) */
  | { type: 'hireGuide' }
  /** 신문을 읽었다 (견습: 첫 신문 장면이 끝난다. 나중에 신문값을 받는 자리) */
  | { type: 'readNews' }
  /** 지금 마을 창고를 빌린다 / 빈 창고를 돌려준다 */
  | { type: 'rentWarehouse' }
  | { type: 'releaseWarehouse'; town: number }
  /** 수레 짐을 지금 마을 창고에 넣는다 / 창고 짐을 수레로 꺼낸다 */
  | { type: 'storeGoods'; good: GoodId; qty: number }
  | { type: 'retrieveGoods'; good: GoodId; qty: number }
  /** 그 마을 창고 짐으로 팔기 신청 (어디서나 낼 수 있고, 내가 없어도 그 마을 장날에 맞춰진다) */
  | { type: 'placeStoreSellOrder'; town: number; good: GoodId; qty: number; minPrice: number }
  /** 여관 고용 게시판에서 고용한다 / 내보낸다 */
  | { type: 'hire'; role: HireRole }
  | { type: 'dismissHire'; hireId: number }
  /** 내 판들(수레, 짐꾼 수레, 지금 마을 창고) 사이로 짐을 옮긴다 */
  | { type: 'transferGoods'; from: BoardRef; to: BoardRef; good: GoodId; qty: number }
  /** 두 번째 행렬: 꾸리기(마부, 내 말 중 일부, 이 마을 수레방에서 산 수레), 지시서 보내기, 불러들이기, 풀기 */
  | { type: 'formCaravan'; horseIds: number[]; cart: CartType }
  | { type: 'setCaravanPlan'; plan: CaravanPlan }
  | { type: 'recallCaravan' }
  | { type: 'disbandCaravan' }
  /** 알림 설정을 바꾼다 (종류별 켜고 끄기, 하루 상한, 조용한 시간). asked: 알림 허락을 물었다 */
  | { type: 'setNotify'; enabled?: Partial<Record<NotifyKind, boolean>>; dailyCap?: number; quietStart?: number; quietEnd?: number; asked?: boolean };

export type CommandError =
  | 'traveling'
  | 'badGood'
  | 'badQty'
  | 'badPrice'
  | 'notEnoughGold'
  | 'notEnoughGoods'
  | 'spoiling'
  | 'noRoom'
  | 'noOrder'
  | 'sameTown'
  | 'noTown'
  | 'noRoute'
  | 'notFood'
  | 'tooManyMeals'
  | 'alreadyRested'
  | 'notTired'
  | 'overweight'
  | 'noPiece'
  | 'cantPlace'
  | 'pieceBusy'
  | ExpeditionError
  | RumorError
  | HorseError
  | WarehouseError
  | HireError
  | BoardError
  | CaravanError
  | ArrangeError
  | 'boardNotEmpty';

export type CommandResult = { ok: true; orderId?: number } | { ok: false; error: CommandError };

const fail = (error: CommandError): CommandResult => ({ ok: false, error });
const done = (error: CommandError | null): CommandResult => (error ? fail(error) : { ok: true });

export function applyCommand(state: EconomyState, map: WorldMap, cmd: Command): CommandResult {
  const result = runCommand(state, map, cmd);
  if (result.ok) {
    // 견습 장면을 넘기고, 조건이 맞으면 하나씩 연다
    apprenticeAfterCommand(state, map, cmd);
    updateUnlocks(state);
    checkBadges(state);
  }
  return result;
}

function runCommand(state: EconomyState, map: WorldMap, cmd: Command): CommandResult {
  const p = state.player;
  const accounts = new Accounts(state);
  const owner = { kind: 'player' } as const;

  switch (cmd.type) {
    case 'placeBuyOrder': {
      if (p.travel) return fail('traveling');
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      if (!isCount(cmd.qty)) return fail('badQty');
      if (!isCount(cmd.maxPrice)) return fail('badPrice');
      if (p.gold < cmd.qty * cmd.maxPrice) return fail('notEnoughGold');
      // 살 물건이 들어갈 수레 자리를 미리 잡는다: 내 수레에 먼저, 넘치면 짐꾼 수레에 (0.0.6). 못 잡으면 신청할 수 없다
      const parts = splitBuy(p, cmd.good, cmd.qty);
      if (!parts) return fail('noRoom');
      let first: number | null = null;
      for (const part of parts) {
        const o = accounts.place(part.porter === undefined ? owner : { kind: 'player', porter: part.porter }, p.town, cmd.good, 'buy', part.qty, cmd.maxPrice);
        if (!o) return fail('noRoom');
        state.orders.push(o);
        first ??= o.id;
      }
      return { ok: true, orderId: first! };
    }
    case 'placeSellOrder': {
      if (p.travel) return fail('traveling');
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      if (!isCount(cmd.qty)) return fail('badQty');
      if (!isCount(cmd.minPrice)) return fail('badPrice');
      // 내 수레 짐부터, 모자라면 짐꾼 수레 짐으로 판다 (0.0.6)
      const all = (b: Board) => cartCount(b, cmd.good);
      if (!splitSell(p, cmd.qty, all)) return fail('notEnoughGoods');
      // 내일이면 상할 물건은 장에 낼 수 없다
      const rate = ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)];
      const parts = splitSell(p, cmd.qty, (b) => sellableCount(cartLots(b), cmd.good, rate));
      if (!parts) return fail('spoiling');
      let first: number | null = null;
      for (const part of parts) {
        const o = accounts.place(part.porter === undefined ? owner : { kind: 'player', porter: part.porter }, p.town, cmd.good, 'sell', part.qty, cmd.minPrice);
        if (!o) continue;
        state.orders.push(o);
        first ??= o.id;
      }
      return { ok: true, orderId: first! };
    }
    case 'cancelOrder': {
      const i = state.orders.findIndex((o) => o.id === cmd.orderId);
      if (i < 0) return fail('noOrder');
      accounts.cancel(state.orders[i]!);
      state.orders.splice(i, 1);
      return { ok: true };
    }
    case 'travel': {
      if (p.travel) return fail('traveling');
      if (p.expedition) return fail('inExpedition');
      if (!state.towns[cmd.to]) return fail('noTown');
      if (cmd.to === p.town) return fail('sameTown');
      // 짐수레는 말 한 필, 마차는 두 필이 있어야 움직인다
      if (lacksHorses(p.cart, p.horses)) return fail('needHorse');
      // 사건으로 막힌 길은 돌아가고, 말이 있으면 빨리 간다
      const days = playerTravelDays(state, map)[cmd.to]!;
      if (!Number.isFinite(days)) return fail('noRoute');
      // 산적 통행세: 떠나는 마을과 가는 마을 길목
      const toll = tollAt(state, p.town) + tollAt(state, cmd.to);
      const fee = days * ECONOMY.player.travelFeePerDay + toll;
      if (p.gold < fee) return fail('notEnoughGold');
      // 무게를 넘으면 출발할 수 없다. 팔려고 내놓은 짐도 떠나면 돌아오므로 같이 센다
      const selling = state.orders
        .filter((o) => o.side === 'sell')
        .reduce((s, o) => s + o.lots.reduce((a, l) => a + l.qty * unitWeight(l.good), 0), 0);
      if (cartWeight(p.cart) + selling > maxWeight(p.cart, p.horses)) return fail('overweight');
      // 짐꾼은 손수레를 사람 힘으로 끈다
      if (porterBoards(p).some((b) => cartWeight(b) > CART.types.handcart.humanPull)) return fail('overweight');
      // 떠나면 이 마을에 수레 짐으로 낸 신청은 거둔다 (창고 짐 신청은 남는다)
      for (const o of state.orders) if (o.owner.kind === 'player') accounts.cancel(o);
      state.orders = state.orders.filter((o) => o.owner.kind !== 'player');
      p.gold -= fee;
      // 이동비는 마을 금고로, 통행세는 산적이 가져간다 (경제에서 빠져나간다)
      state.towns[p.town]!.treasury += fee - toll;
      p.ledger.push({ day: state.day, kind: 'travel', from: p.town, to: cmd.to, days, fee: fee - toll });
      if (toll > 0) p.ledger.push({ day: state.day, kind: 'toll', town: tollAt(state, p.town) > 0 ? p.town : cmd.to, gold: toll });
      p.travel = { from: p.town, to: cmd.to, days, daysLeft: days };
      // 원정 기회는 그 마을에 묶여 있다. 떠나면 사라진다
      p.expeditionChances = 0;
      // 말은 길에서 지친다 (조랑말은 잘 지친다)
      for (const h of p.horses) h.fatigue = Math.min(HORSES.fatigue.max, h.fatigue + HORSES.kinds[h.kind].travelFatigue * days);
      return { ok: true };
    }
    case 'eat':
      return eat(state, cmd.good);
    case 'restAtInn':
      return restAtInn(state);
    case 'moveCartPiece':
      if (!p.cart.pieces.some((q) => q.id === cmd.pieceId)) return fail('noPiece');
      return movePiece(p.cart, cmd.pieceId, cmd.x, cmd.y, cmd.rot) ? { ok: true } : fail('cantPlace');
    case 'rotateCartPiece':
      if (!p.cart.pieces.some((q) => q.id === cmd.pieceId)) return fail('noPiece');
      return rotatePiece(p.cart, cmd.pieceId) ? { ok: true } : fail('cantPlace');
    case 'packCart':
      return packCart(p.cart) ? { ok: true } : fail('cantPlace');
    case 'arrangeCart': {
      const board = resolveBoard(state, cmd.board ?? 'cart');
      if (typeof board === 'string') return fail(board);
      return done(arrangeBoard(board, cmd.pieces));
    }
    case 'startExpedition':
      return done(startExpedition(state, map));
    case 'chooseExpeditionCard':
      return done(chooseExpeditionCard(state, map, cmd.choice));
    case 'endExpedition':
      return done(finishExpedition(state));
    case 'buyDrink':
      if (p.expedition) return fail('inExpedition');
      return done(buyDrink(state, map));
    case 'sendPigeon':
      return done(sendPigeon(state, cmd.to));
    case 'hireInformant':
      return done(hireInformant(state));
    case 'dismissInformant':
      return done(dismissInformant(state, cmd.town));
    case 'buyHorse':
      if (!HORSE_KINDS.includes(cmd.kind)) return fail('noHorseLeft');
      return done(buyHorse(state, cmd.kind));
    case 'sellHorse':
      return done(sellHorse(state, cmd.horseId));
    case 'restHorses':
      return done(restHorses(state));
    case 'buyGear':
      if (!GEAR_KINDS.includes(cmd.gear)) return fail('needGear');
      return done(buyGear(state, cmd.gear));
    case 'repairGear':
      if (!GEAR_KINDS.includes(cmd.gear)) return fail('needGear');
      return done(repairGear(state, cmd.gear));
    case 'hireGuide':
      return done(hireGuide(state));
    case 'readNews':
      p.newsReadDay = state.day;
      return { ok: true };
    case 'rentWarehouse':
      return done(rentWarehouse(state, map));
    case 'releaseWarehouse':
      return done(releaseWarehouse(state, cmd.town));
    case 'storeGoods':
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      return done(storeGoods(state, cmd.good, cmd.qty));
    case 'retrieveGoods':
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      return done(retrieveGoods(state, cmd.good, cmd.qty));
    case 'hire':
      if (!['porter', 'gatherer', 'carter'].includes(cmd.role)) return fail('noWorker');
      return done(hire(state, map, cmd.role));
    case 'dismissHire':
      return done(dismiss(state, cmd.hireId));
    case 'setNotify': {
      const n = p.notify;
      const hour = (h: number | undefined) => h === undefined || (Number.isInteger(h) && h >= 0 && h <= 23);
      if (!hour(cmd.quietStart) || !hour(cmd.quietEnd) || (cmd.dailyCap !== undefined && !(Number.isInteger(cmd.dailyCap) && cmd.dailyCap >= 0))) {
        return fail('badQty');
      }
      for (const [k, v] of Object.entries(cmd.enabled ?? {})) if (k in n.enabled) n.enabled[k as NotifyKind] = Boolean(v);
      if (cmd.dailyCap !== undefined) n.dailyCap = cmd.dailyCap;
      if (cmd.quietStart !== undefined) n.quietStart = cmd.quietStart;
      if (cmd.quietEnd !== undefined) n.quietEnd = cmd.quietEnd;
      if (cmd.asked) n.askedDay ??= state.day;
      return { ok: true };
    }
    case 'formCaravan':
      return done(formCaravan(state, map, cmd.horseIds, cmd.cart));
    case 'setCaravanPlan':
      return done(setCaravanPlan(state, cmd.plan));
    case 'recallCaravan':
      return done(recallCaravan(state));
    case 'disbandCaravan':
      return done(disbandCaravan(state));
    case 'transferGoods':
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      return done(transferGoods(state, cmd.from, cmd.to, cmd.good, cmd.qty));
    case 'placeStoreSellOrder': {
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      if (!isCount(cmd.qty)) return fail('badQty');
      if (!isCount(cmd.minPrice)) return fail('badPrice');
      const w = warehouseAt(p, cmd.town);
      if (!w) return fail('noWarehouse');
      if (w.owed > 0) return fail('warehouseOwed');
      if (cartCount(w.board, cmd.good) < cmd.qty) return fail('notEnoughGoods');
      const rate = ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)];
      if (sellableCount(cartLots(w.board), cmd.good, rate) < cmd.qty) return fail('spoiling');
      const o = accounts.place({ kind: 'store', town: cmd.town }, cmd.town, cmd.good, 'sell', cmd.qty, cmd.minPrice)!;
      state.orders.push(o);
      return { ok: true, orderId: o.id };
    }
    case 'buyCart':
      if (!CART_TYPES.includes(cmd.cart)) return fail('sameCart');
      if (p.expedition) return fail('inExpedition');
      return done(buyCart(state, map, cmd.cart));
    case 'discardCartPiece': {
      const piece = p.cart.pieces.find((q) => q.id === cmd.pieceId);
      if (!piece) return fail('noPiece');
      const lots = discardPiece(p.cart, cmd.pieceId);
      if (!lots) return fail('pieceBusy');
      const qty = lots.reduce((s, l) => s + l.qty, 0);
      p.ledger.push({ day: state.day, kind: 'discard', good: piece.good, qty });
      return { ok: true };
    }
  }
}

function eat(state: EconomyState, good: GoodId): CommandResult {
  const p = state.player;
  if (p.fatigue <= 0) return fail('notTired');
  if (p.mealsToday >= ECONOMY.fatigue.mealsPerDay) return fail('tooManyMeals');
  const lot = pickMeal(p, good);
  if (!lot) return fail(FOODS.includes(good) ? 'notEnoughGoods' : 'notFood');
  const recovered = Math.min(p.fatigue, mealRecovery(lot, spoilRateToday(state)));
  // 가장 먼저 상할 것 하나를 꺼내 먹는다
  takeGoods(p.cart, good, 1);
  p.fatigue -= recovered;
  p.mealsToday += 1;
  p.ledger.push({ day: state.day, kind: 'eat', good, recovered });
  return { ok: true };
}

function restAtInn(state: EconomyState): CommandResult {
  const p = state.player;
  if (p.travel) return fail('traveling');
  if (p.restedToday) return fail('alreadyRested');
  // 묵으면 말도 쉰다 (0.0.5 시안): 나나 말이 지쳤으면 묵을 수 있다
  if (p.fatigue <= 0 && p.horses.every((h) => h.fatigue <= 0)) return fail('notTired');
  const town = state.towns[p.town]!;
  const { fee, recovery } = innOf(town);
  if (p.gold < fee) return fail('notEnoughGold');
  // 여관비는 경제에서 빠져나가는 돈이다 (기획서 "퍼즐 기회와 피로도")
  p.gold -= fee;
  const recovered = Math.min(p.fatigue, recovery);
  p.fatigue -= recovered;
  p.restedToday = true;
  for (const h of p.horses) h.fatigue = Math.max(0, h.fatigue - HORSES.fatigue.rest.recovery);
  p.ledger.push({ day: state.day, kind: 'inn', town: town.id, fee, recovered });
  return { ok: true };
}

function isCount(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}
