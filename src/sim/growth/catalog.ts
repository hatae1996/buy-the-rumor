// 살 수 있는 것 (기획서 "성장은 단계가 아니라 가진 것이다", 0.0.5).
// 종류, 오르는 능력, 파는 곳(건물), 값, 유지비를 데이터로 한곳에 모은다. 값은 각 시스템의 상수를 가리킨다.
// 무엇을 먼저 살지는 플레이어가 고른다. 자연스러운 순서는 값과 유지비, 그리고 말의 귀함이 만든다.
import { CART, ECONOMY, GROWTH, HORSES, RUMORS } from '../constants';
import type { BuildingId } from './buildings';

export type PurchaseKind = 'cart' | 'horse' | 'gear' | 'porter' | 'gatherer' | 'warehouse' | 'caravan' | 'informant' | 'workshop' | 'loan';

export interface PurchaseDef {
  id: string;
  kind: PurchaseKind;
  name: string;
  /** 오르는 능력 */
  ability: string;
  /** 파는 곳 */
  building: BuildingId;
  /** 값 (한 번). 남은 수에 따라 바뀌면 기준값. 없으면 0 */
  price: number;
  /** 유지비: 하루에 드는 돈(어림), 무엇으로 */
  upkeep: { perDay: number; what: string };
  /** 이번 버전에서 실제로 움직이나, 구조만 있나 */
  ready: boolean;
}

const carts: PurchaseDef[] = (['handcart', 'wagon', 'carriage'] as const).map((t) => ({
  id: `cart:${t}`,
  kind: 'cart',
  name: CART.types[t].name,
  ability: `칸 ${CART.types[t].rows.join('').split('').filter((c) => c === '#').length}개${CART.types[t].horses ? `, 말 ${CART.types[t].horses}필이 끈다` : ''}`,
  building: 'cartShop',
  price: CART.types[t].price,
  upkeep: { perDay: 0, what: '가끔 수리(도구)' },
  ready: true,
}));

const horses: PurchaseDef[] = (Object.keys(HORSES.kinds) as (keyof typeof HORSES.kinds)[]).map((k) => ({
  id: `horse:${k}`,
  kind: 'horse',
  name: HORSES.kinds[k].name,
  ability: `끄는 무게 ${HORSES.kinds[k].pull}, 걸음 ×${HORSES.kinds[k].speed}`,
  building: 'stable',
  price: HORSES.kinds[k].price,
  // 마구간 먹이: 곡물 기준값 × 마구간 웃돈
  upkeep: { perDay: Math.round(HORSES.kinds[k].feed * ECONOMY.goods.grain.basePrice * HORSES.stableFeedMarkup), what: `곡물 ${HORSES.kinds[k].feed}개 (쉬는 날에도)` },
  ready: true,
}));

const gear: PurchaseDef[] = (Object.keys(ECONOMY.expedition.gear) as (keyof typeof ECONOMY.expedition.gear)[]).map((g) => ({
  id: `gear:${g}`,
  kind: 'gear',
  name: ECONOMY.expedition.gear[g].name,
  ability: '원정 선택지',
  building: 'store',
  price: ECONOMY.expedition.gear[g].price,
  upkeep: { perDay: 0, what: '망가지면 도구로 수리' },
  ready: true,
}));

const H = GROWTH.hire;

export const PURCHASES: readonly PurchaseDef[] = [
  ...carts,
  ...horses,
  ...gear,
  { id: 'porter', kind: 'porter', name: H.porter.name, ability: '내 행렬에 손수레 하나 더', building: 'inn', price: 0, upkeep: { perDay: H.porter.wage, what: '일당' }, ready: true },
  { id: 'gatherer', kind: 'gatherer', name: H.gatherer.name, ability: '내가 없어도 매일 원정 (결과는 그 마을 창고로)', building: 'inn', price: 0, upkeep: { perDay: H.gatherer.wage, what: '일당' }, ready: true },
  { id: 'warehouse', kind: 'warehouse', name: GROWTH.warehouse.name, ability: '짐을 두고 다니고, 없어도 그 마을 장날에 팔기', building: 'warehouse', price: GROWTH.warehouse.deposit, upkeep: { perDay: GROWTH.warehouse.rentPerDay, what: '보관료' }, ready: true },
  { id: 'caravan', kind: 'caravan', name: '두 번째 행렬', ability: '마부가 지시서대로 두 번째 길을 돈다 (말과 수레가 따로 있어야)', building: 'inn', price: 0, upkeep: { perDay: H.carter.wage, what: '마부 일당, 말 먹이' }, ready: true },
  { id: 'informant', kind: 'informant', name: H.informant.name, ability: '한 마을의 시세와 장날 신청 현황을 매일', building: 'inn', price: RUMORS.informant.hireFee, upkeep: { perDay: H.informant.wage, what: '비싼 일당' }, ready: true },
  { id: 'workshop', kind: 'workshop', name: '작업장', ability: '가공품 생산 (염장소, 대장간)', building: 'workshop', price: 0, upkeep: { perDay: 0, what: '운영비' }, ready: false },
  { id: 'loan', kind: 'loan', name: '대출', ability: '큰 밑천', building: 'bank', price: 0, upkeep: { perDay: 0, what: `이자 (연 ${GROWTH.bank.loanRate * 100}%)` }, ready: false },
];

export const purchaseDef = (id: string): PurchaseDef | null => PURCHASES.find((p) => p.id === id) ?? null;

/** 이 건물에서 파는 것 */
export function purchasesAt(building: BuildingId): PurchaseDef[] {
  return PURCHASES.filter((p) => p.building === building);
}
