// 마을 건물 (기획서 "화면 구성 - 마을 탭: 건물 카드", 0.0.5).
// 마을마다 건물이 달라서 "말을 사려면 목장 마을에 가야 한다"가 자연스럽게 생긴다.
// 건물 카드에는 지금 할 일이 있으면 도장(!)이 찍힌다. 도장 조건은 플레이어가 아는 것만 본다.
import { cartLots } from '../cart';
import { bigOrdersToday } from '../events/active';
import { ECONOMY } from '../constants';
import { shelfLife } from '../economy/goods';
import { seasonOfDay } from '../season';
import { hasExpeditions } from '../economy/player';
import type { EconomyState } from '../economy/state';
import { stableAt } from '../horses/supply';
import { innRumor } from '../rumors/hear';
import type { WorldMap } from '../worldgen';

export type BuildingId = 'market' | 'inn' | 'store' | 'outside' | 'warehouse' | 'stable' | 'cartShop' | 'workshop' | 'bank' | 'guildHall';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** 있는 곳 (화면 설명) */
  where: string;
  does: string;
}

/** 화면에 보이는 차례: 자주 쓰는 시장·여관·바깥이 위 */
export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'market', name: '시장', where: '모든 마을', does: '장날 신청(팔기, 사기), 오늘 시세' },
  { id: 'inn', name: '여관', where: '모든 마을', does: '소문꾼, 술 한 잔, 묵기, 고용 게시판' },
  { id: 'outside', name: '바깥', where: '자원지가 있는 마을', does: '원정 떠나기, 남은 기회' },
  { id: 'store', name: '잡화점', where: '모든 마을', does: '장비 사기와 고치기' },
  { id: 'warehouse', name: '창고', where: '모든 마을', does: '빌리기, 짐 넣고 빼기' },
  { id: 'stable', name: '마구간', where: '목장 마을', does: '말 사고팔기, 남은 수' },
  { id: 'cartShop', name: '수레방', where: '목재 마을과 도시', does: '수레 바꾸기' },
  { id: 'workshop', name: '작업장', where: '도시', does: '대장간, 염장 공방 (나중에)' },
  { id: 'bank', name: '은행', where: '도시', does: '예금, 대출 (나중에)' },
  { id: 'guildHall', name: '길드 회관', where: '도시', does: '시즌 테마와 의뢰, 명예의 전당' },
];

export const buildingDef = (id: BuildingId): BuildingDef => BUILDINGS.find((b) => b.id === id)!;

/** 이 마을에 있는 건물 (화면 차례대로) */
export function townBuildings(state: EconomyState, map: WorldMap, town: number): BuildingId[] {
  const t = state.towns[town]!;
  const city = map.towns[town]!.tier === 'city';
  const has: Record<BuildingId, boolean> = {
    market: true,
    inn: true,
    store: true,
    warehouse: true,
    outside: hasExpeditions(t),
    stable: stableAt(state, town) !== null,
    // 목수가 있는 마을: 숲(목재)이 있는 마을과 도시
    cartShop: city || t.nodes.some((n) => n.kind === 'forest'),
    workshop: city,
    bank: city,
    guildHall: city,
  };
  return BUILDINGS.map((b) => b.id).filter((id) => has[id]);
}

export function hasBuilding(state: EconomyState, map: WorldMap, town: number, id: BuildingId): boolean {
  return townBuildings(state, map, town).includes(id);
}

/** 건물에 찍을 도장(!)과 그 까닭. 지금 있는 마을에서만 본다 */
export function buildingAlerts(state: EconomyState, map: WorldMap): Partial<Record<BuildingId, string>> {
  const p = state.player;
  if (p.travel) return {};
  const town = p.town;
  const out: Partial<Record<BuildingId, string>> = {};
  if (!p.drankToday && innRumor(state, map)) out.inn = '새 소문';
  if (hasExpeditions(state.towns[town]!) && p.expeditionChances >= ECONOMY.expedition.maxChances) out.outside = '기회 가득';
  if (Object.values(p.gear).some((n) => n === 0)) out.store = '장비 수리';
  // 창고: 내일이면 상할 음식이 있다
  const w = p.warehouses.find((x) => x.town === town);
  if (w) {
    const rate = ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)];
    const soon = cartLots(w.board).filter((l) => {
      const life = shelfLife(l.good);
      return life !== null && l.age + rate >= life;
    });
    if (soon.length) out.warehouse = `곧 상함 ${soon.reduce((s, l) => s + l.qty, 0)}`;
    else if (w.owed > 0) out.warehouse = '보관료 밀림';
  }
  // 시장: 큰 주문이 열려 있다 (0.0.7)
  if (bigOrdersToday(state).some(({ event }) => event.town === town)) out.market = '큰 주문';
  // 마구간: 어제나 오늘 말이 들어왔다
  if (state.horses.arrived.some((a) => a.town === town && state.day - a.day <= 1)) out.stable = '말 입고';
  return out;
}
