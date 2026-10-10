// 견습 진행: 플레이어가 한 일(명령)과 지나간 장날을 보고 다음 장면으로 넘긴다.
// 견습 마을은 혼자 쓰는 마을이라 실제 시간이 흐르지 않고, "하루 보내기"로만 날이 간다.
// 견습 동안은 손해를 보지 않고, 첫 판매는 반드시 이익이 난다 (market.ts).
import { createCart, loadGoods, moveAll } from '../cart';
import { ECONOMY, FOOD } from '../constants';
import type { Command } from '../economy/commands';
import { hasExpeditions } from '../economy/player';
import type { EconomyState, PlayerState } from '../economy/state';
import { activate } from '../events/active';
import { eventDef } from '../events/defs';
import type { Rng } from '../rng';
import { townTravelDays, type WorldMap } from '../worldgen';
import { AUTUMN, seasonOfDay } from '../season';
import { nextScene, sceneDef } from './scenes';
import type { SceneId, UnlockId } from './types';

const A = ECONOMY.apprentice;

/** 견습을 건너뛴 사람(두 번째 시즌부터)과 봇은 처음부터 모두 열려 있다 */
export const ALL_UNLOCKS: readonly UnlockId[] = ['cart', 'ledger', 'news', 'map', 'memory', 'rumors', 'editPrice', 'reservation', 'bank'];

/**
 * 견습을 시작한다: 자원지가 있는 생산 마을에서, 빈 등짐과 금화 50으로.
 * 졸업하고 갈 마을은 길로 가장 가까운 마을이다
 */
export function startApprentice(state: EconomyState, p: PlayerState, map: WorldMap, rng: Rng): void {
  const producers = state.towns.filter((t) => hasExpeditions(t) && t.nodes.some((n) => n.kind === 'forest'));
  const pool = producers.length ? producers : state.towns.filter(hasExpeditions);
  const town = pool.some((t) => t.id === p.town) ? p.town : pool[rng.int(0, pool.length - 1)]!.id;
  const days = townTravelDays(map, AUTUMN)[town]!;
  const destination = map.towns
    .filter((t) => t.id !== town && Number.isFinite(days[t.id]!))
    .sort((a, b) => days[a.id]! - days[b.id]! || a.id - b.id)[0]!.id;
  p.town = town;
  p.homeTown = town;
  p.visited = [town];
  p.gold = A.startGold;
  p.cart = createCart('pack');
  p.fatigue = 0;
  p.expeditionChances = 1;
  p.unlocks = {};
  p.apprentice = { scene: 'start', town, destination, sceneDay: state.day };
}

export function inApprentice(p: PlayerState): boolean {
  return p.apprentice !== null;
}

function unlock(state: EconomyState, p: PlayerState, id: UnlockId): void {
  p.unlocks[id] ??= state.day;
}

/** 다음 장면으로. 장면에 들어올 때 열리는 것을 열고, 일어날 일을 일으킨다 */
function advance(state: EconomyState, p: PlayerState, map: WorldMap): void {
  const ap = p.apprentice!;
  const next = nextScene(ap.scene);
  if (!next) return;
  ap.scene = next;
  ap.sceneDay = state.day;
  for (const id of sceneDef(next).unlocks) unlock(state, p, id);
  if (next === 'firstNews') firstNews(state, p, map);
  if (next === 'graduation') graduationGift(state, p, map);
}

/** 첫 신문: 졸업하고 갈 마을에 조선소 대형 상선 (목재 수요가 는다). 견습 동안 신문은 무료다 */
function firstNews(state: EconomyState, p: PlayerState, map: WorldMap): void {
  const ap = p.apprentice!;
  const def = eventDef('shipyard');
  const days = typeof def.days === 'number' ? def.days : 5;
  // 졸업하고 도착할 때까지 이어지도록 길 위의 날만큼 더 둔다
  const travel = townTravelDays(map, AUTUMN)[ap.town]![ap.destination]!;
  activate(state, map, 'shipyard', ap.destination, state.day + days + travel);
  // 첫 신문 장면의 기사이니 그날 신문의 머리기사로 (0.1.2: 신문팔이에게서 받아 읽는다)
  const item = { day: state.day, text: def.news({ town: map.towns[ap.destination]!.name, good: null, job: null }) };
  const at = state.news.findIndex((n) => n.day === state.day);
  if (at < 0) state.news.push(item);
  else state.news.splice(at, 0, item);
}

/**
 * 졸업 선물: 손수레(짐은 그대로 옮겨 싣는다)와 여행 식량 (0.1.2 길의 식량).
 * 식량은 첫 두 번의 이동에 넉넉하게 (0.1.3): 첫 길 + 도착 마을에서 가장 가까운 마을까지, 그 계절 길로 하루씩 올려 센다
 */
export function graduationRations(state: EconomyState, p: PlayerState, map: WorldMap): number {
  const ap = p.apprentice!;
  const days = townTravelDays(map, seasonOfDay(state.day, state.startSeason));
  const first = days[ap.town]![ap.destination]!;
  if (!Number.isFinite(first)) return 0;
  const next = Math.min(...map.towns.filter((t) => t.id !== ap.destination && t.id !== ap.town).map((t) => days[ap.destination]![t.id]!));
  return (Math.ceil(first) + (Number.isFinite(next) ? Math.ceil(next) : 0)) * FOOD.perPersonPerDay;
}

function graduationGift(state: EconomyState, p: PlayerState, map: WorldMap): void {
  if (p.cart.type === 'pack') {
    const next = createCart('handcart');
    moveAll(p.cart, next);
    p.cart = next;
  }
  const n = graduationRations(state, p, map);
  if (n > 0) loadGoods(p.cart, 'rations', n, 0, 0);
}

/** 명령이 성공한 뒤 부른다 */
export function apprenticeAfterCommand(state: EconomyState, p: PlayerState, map: WorldMap, cmd: Command): void {
  const ap = p.apprentice;
  if (!ap) return;
  const is = (scene: SceneId) => ap.scene === scene;
  if (is('start') && cmd.type === 'startExpedition') advance(state, p, map);
  else if (is('firstExpedition') && !p.expedition) advance(state, p, map);
  else if (
    is('firstLoad') &&
    (cmd.type === 'moveCartPiece' || cmd.type === 'rotateCartPiece' || cmd.type === 'packCart' || cmd.type === 'arrangeCart')
  ) {
    advance(state, p, map);
  }
  // 첫 신문: 신문팔이에게서 받아(견습 동안 무료) 읽으면 (0.1.2. 소식 탭을 여는 것만으로는 넘어가지 않는다)
  else if (is('firstNews') && cmd.type === 'readPaper') advance(state, p, map);
  else if (is('graduation') && cmd.type === 'travel') {
    // 첫 출발: 견습을 마치고 공유 시장으로 들어간다
    p.apprentice = null;
  }
}

/** 장날이 지난 뒤 부른다: 첫 판매와 첫 구매는 장날을 겪어야 끝난다 */
export function apprenticeAfterDay(state: EconomyState, p: PlayerState, map: WorldMap, day: number): void {
  const ap = p.apprentice;
  if (!ap) return;
  const traded = (kind: 'buy' | 'sell') => p.ledger.some((e) => e.kind === kind && e.day === day);
  if (ap.scene === 'firstSale' && traded('sell')) advance(state, p, map);
  else if (ap.scene === 'firstBuy' && traded('buy')) advance(state, p, map);
}
