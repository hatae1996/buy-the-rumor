// 견습 진행: 플레이어가 한 일(명령)과 지나간 장날을 보고 다음 장면으로 넘긴다.
// 견습 마을은 혼자 쓰는 마을이라 실제 시간이 흐르지 않고, "하루 보내기"로만 날이 간다.
// 견습 동안은 손해를 보지 않고, 첫 판매는 반드시 이익이 난다 (market.ts).
import { cartLots, createCart, loadGoods } from '../cart';
import { ECONOMY } from '../constants';
import type { Command } from '../economy/commands';
import { hasExpeditions } from '../economy/player';
import type { EconomyState } from '../economy/state';
import { activate } from '../events/active';
import { eventDef } from '../events/defs';
import type { Rng } from '../rng';
import { townTravelDays, type WorldMap } from '../worldgen';
import { AUTUMN } from '../season';
import { nextScene, sceneDef } from './scenes';
import type { SceneId, UnlockId } from './types';

const A = ECONOMY.apprentice;

/** 견습을 건너뛴 사람(두 번째 시즌부터)과 봇은 처음부터 모두 열려 있다 */
export const ALL_UNLOCKS: readonly UnlockId[] = ['ledger', 'news', 'map', 'memory', 'rumors', 'editPrice', 'reservation', 'bank'];

/**
 * 견습을 시작한다: 자원지가 있는 생산 마을에서, 빈 등짐과 금화 50으로.
 * 졸업하고 갈 마을은 길로 가장 가까운 마을이다
 */
export function startApprentice(state: EconomyState, map: WorldMap, rng: Rng): void {
  const p = state.player;
  const producers = state.towns.filter((t) => hasExpeditions(t) && t.nodes.some((n) => n.kind === 'forest'));
  const pool = producers.length ? producers : state.towns.filter(hasExpeditions);
  const town = pool.some((t) => t.id === p.town) ? p.town : pool[rng.int(0, pool.length - 1)]!.id;
  const days = townTravelDays(map, AUTUMN)[town]!;
  const destination = map.towns
    .filter((t) => t.id !== town && Number.isFinite(days[t.id]!))
    .sort((a, b) => days[a.id]! - days[b.id]! || a.id - b.id)[0]!.id;
  p.town = town;
  p.homeTown = town;
  p.gold = A.startGold;
  p.cart = createCart('pack');
  p.fatigue = 0;
  p.expeditionChances = 1;
  p.unlocks = {};
  p.apprentice = { scene: 'start', town, destination, sceneDay: state.day };
}

export function inApprentice(state: EconomyState): boolean {
  return state.player.apprentice !== null;
}

function unlock(state: EconomyState, id: UnlockId): void {
  state.player.unlocks[id] ??= state.day;
}

/** 다음 장면으로. 장면에 들어올 때 열리는 것을 열고, 일어날 일을 일으킨다 */
function advance(state: EconomyState, map: WorldMap): void {
  const ap = state.player.apprentice!;
  const next = nextScene(ap.scene);
  if (!next) return;
  ap.scene = next;
  ap.sceneDay = state.day;
  for (const id of sceneDef(next).unlocks) unlock(state, id);
  if (next === 'firstNews') firstNews(state, map);
  if (next === 'graduation') graduationGift(state);
}

/** 첫 신문: 졸업하고 갈 마을에 조선소 대형 상선 (목재 수요가 는다). 견습 동안 신문은 무료다 */
function firstNews(state: EconomyState, map: WorldMap): void {
  const ap = state.player.apprentice!;
  const def = eventDef('shipyard');
  const days = typeof def.days === 'number' ? def.days : 5;
  // 졸업하고 도착할 때까지 이어지도록 길 위의 날만큼 더 둔다
  const travel = townTravelDays(map, AUTUMN)[ap.town]![ap.destination]!;
  activate(state, map, 'shipyard', ap.destination, state.day + days + travel);
  state.news.push({ day: state.day, text: def.news({ town: map.towns[ap.destination]!.name, good: null, job: null }) });
}

/** 졸업 선물: 손수레. 짐은 그대로 옮겨 싣는다 */
function graduationGift(state: EconomyState): void {
  const p = state.player;
  if (p.cart.type !== 'pack') return;
  const next = createCart('handcart');
  for (const lot of cartLots(p.cart)) loadGoods(next, lot.good, lot.qty, lot.age);
  p.cart = next;
}

/** 명령이 성공한 뒤 부른다 */
export function apprenticeAfterCommand(state: EconomyState, map: WorldMap, cmd: Command): void {
  const ap = state.player.apprentice;
  if (!ap) return;
  const is = (scene: SceneId) => ap.scene === scene;
  if (is('start') && cmd.type === 'startExpedition') advance(state, map);
  else if (is('firstExpedition') && !state.player.expedition) advance(state, map);
  else if (is('firstLoad') && (cmd.type === 'moveCartPiece' || cmd.type === 'rotateCartPiece' || cmd.type === 'packCart')) advance(state, map);
  else if (is('firstNews') && cmd.type === 'readNews') advance(state, map);
  else if (is('graduation') && cmd.type === 'travel') {
    // 첫 출발: 견습을 마치고 공유 시장으로 들어간다
    state.player.apprentice = null;
  }
}

/** 장날이 지난 뒤 부른다: 첫 판매와 첫 구매는 장날을 겪어야 끝난다 */
export function apprenticeAfterDay(state: EconomyState, map: WorldMap, day: number): void {
  const ap = state.player.apprentice;
  if (!ap) return;
  const traded = (kind: 'buy' | 'sell') => state.player.ledger.some((e) => e.kind === kind && e.day === day);
  if (ap.scene === 'firstSale' && traded('sell')) advance(state, map);
  else if (ap.scene === 'firstBuy' && traded('buy')) advance(state, map);
}
