// 길 위 사건으로 짐칸이 망가진다 (0.1.2, 기획서 "수레 인벤토리 - 짐칸 화면: 칸이 망가진다").
// 떠날 때 그 길의 위험(험한 길, 낙석, 산적)을 재 두고, 길 위의 밤마다 굴린다. 망가진 칸은 X가 붙어 실을 수 없고,
// 그 칸에 걸친 짐 조각 하나를 통째로 잃는다. 수레방에서 칸마다 돈을 내고 고친다. 등짐은 망가지지 않는다.
import { openSlots, pieceCells, type Board, type Cart, type ItemId } from '../cart';
import { CART_DAMAGE } from '../constants';
import { blockedTiles, tollAt } from '../events/active';
import { createRng, mixSeed, type Rng } from '../rng';
import { seasonOfDay } from '../season';
import { cellsAround, buildNeighbors, findRoute, type WorldMap } from '../worldgen';
import { hasBuilding } from '../growth/buildings';
import { playerSeed } from './players';
import type { EconomyState, PlayerState, Travel } from './state';

const D = CART_DAMAGE;

/** 길 하나의 위험 (떠날 때 잰다) */
export interface RoadRisk {
  /** 하루에 험한 길로 칸이 망가질 확률 (언덕·산 칸 몫만큼) */
  rough: number;
  /** 하루에 낙석으로 망가질 확률 (산사태가 난 지방 근처를 지나면) */
  rockfall: number;
  /** 떠나는 날, 도착하는 날 산적을 만날 수 있나 (산적 사건 마을) */
  banditsFrom: boolean;
  banditsTo: boolean;
}

export type IncidentCause = 'rough' | 'rockfall' | 'bandits';

export const INCIDENT_NAME: Record<IncidentCause, string> = { rough: '험한 길', rockfall: '낙석', bandits: '산적' };

/** 오늘 이 길을 떠나면 만날 위험 */
export function roadRisk(state: EconomyState, map: WorldMap, from: number, to: number): RoadRisk {
  const blocked = blockedTiles(state);
  const route = findRoute(map, from, to, seasonOfDay(state.day, state.startSeason), blocked);
  const tiles = route?.tiles ?? [];
  const highland = tiles.filter((i) => map.tiles[i]!.terrain === 'hills' || map.tiles[i]!.terrain === 'mountain').length;
  // 산사태가 막은 칸 두 칸 안을 지나면 낙석
  const slide = new Set<number>();
  const nbs = buildNeighbors(map.tiles);
  for (const e of state.events) {
    if (e.event !== 'landslide' || e.start > state.day || e.end < state.day) continue;
    for (const t of e.tiles ?? []) for (const n of [t, ...cellsAround(nbs, t, 2)]) slide.add(n);
  }
  return {
    rough: tiles.length ? (D.rough * highland) / tiles.length : 0,
    rockfall: tiles.some((i) => slide.has(i)) ? D.rockfall : 0,
    banditsFrom: tollAt(state, from) > 0,
    banditsTo: tollAt(state, to) > 0,
  };
}

/** 오늘 밤 길 위에서 무슨 일이 있었나. 아무 일 없으면 null. 수레(등짐 말고)만 망가진다 */
export function rollIncident(travel: Travel, cart: Board, rng: Rng): IncidentCause | null {
  const risk = travel.risk;
  if (!risk || cart.type === 'pack' || cart.type === 'warehouse') return null;
  // 떠난 날이 첫 밤, 도착하는 날이 마지막 밤
  const first = travel.daysLeft === travel.days;
  const last = travel.daysLeft <= 1;
  const chances: [IncidentCause, number][] = [
    ['rough', risk.rough],
    ['rockfall', risk.rockfall],
    ['bandits', (risk.banditsFrom && first) || (risk.banditsTo && last) ? D.bandits : 0],
  ];
  // 사건마다 따로 굴린다 (하룻밤에 하나만: 앞에 걸린 것)
  for (const [cause, p] of chances) if (p > 0 && rng.next() < p) return cause;
  return null;
}

/** 칸 하나를 망가뜨린다: 멀쩡한 칸 중 하나(시드), 그 칸에 걸친 짐 조각은 잃는다. 잃은 짐을 돌려준다 */
export function breakCell(cart: Board, rng: Rng): { cell: string; lost: { good: ItemId; qty: number } | null } | null {
  const open = openSlots(cart);
  if (open.length === 0) return null;
  const [x, y] = open[rng.int(0, open.length - 1)]!;
  const cell = `${x},${y}`;
  (cart.broken ??= []).push(cell);
  const hit = cart.pieces.find((p) => pieceCells(p).some(([cx, cy]) => cx === x && cy === y));
  if (!hit) return { cell, lost: null };
  cart.pieces = cart.pieces.filter((p) => p !== hit);
  return { cell, lost: { good: hit.good, qty: hit.lots.reduce((s, l) => s + l.qty, 0) } };
}

/** 망가진 칸을 모두 고치는 값 */
export function repairCost(cart: Cart): number {
  return (cart.broken?.length ?? 0) * D.repairPerCell[cart.type];
}

/** 길 위의 밤: 사건을 굴려 칸이 망가졌으면 장부에 적는다 (행렬 수레는 caravan) */
export function roadNight(state: EconomyState, p: PlayerState, travel: Travel, cart: Board, caravan: boolean): void {
  const rng = createRng(playerSeed(mixSeed(state.seed, caravan ? 0xda3b : 0xda3a, state.day), p));
  const cause = rollIncident(travel, cart, rng);
  if (!cause) return;
  const hit = breakCell(cart, rng);
  if (hit) p.ledger.push({ day: state.day, kind: 'cartDamage', cause, lost: hit.lost, caravan });
}

/** 수레방에서 망가진 칸을 고친다. 돈이 모자라면 되는 만큼. 값은 그 마을 금고로 */
export function repairCart(state: EconomyState, p: PlayerState, map: WorldMap): 'traveling' | 'noCartShop' | 'cartFine' | 'notEnoughGold' | null {
  if (p.travel) return 'traveling';
  if (!hasBuilding(state, map, p.town, 'cartShop')) return 'noCartShop';
  const broken = p.cart.broken ?? [];
  if (broken.length === 0) return 'cartFine';
  const per = D.repairPerCell[p.cart.type];
  const cells = Math.min(broken.length, per > 0 ? Math.floor(p.gold / per) : broken.length);
  if (cells === 0) return 'notEnoughGold';
  p.cart.broken = broken.slice(cells);
  p.gold -= cells * per;
  state.towns[p.town]!.treasury += cells * per;
  p.ledger.push({ day: state.day, kind: 'cartRepair', town: p.town, cells, price: cells * per });
  return null;
}
