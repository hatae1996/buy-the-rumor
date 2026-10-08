// 장비와 도구 (기획서 "원정 카드 목록 - 덱 짜기와 결과 규칙").
// 도구는 소모품: 나무를 베거나 광석을 캐는 선택지가 도구를 쓴다.
// 장비(활, 횃불, 덫, 그물)는 잡화점에서 사고, 쓰다 보면 망가지고, 망가지면 도구 하나로 고친다.
// 안내인은 여관에서 고용하면 다음 원정 한 번 동안 나쁜 카드 1장을 건너뛴다.
import { cartCount, takeGoods } from '../cart';
import { ECONOMY } from '../constants';
import { hasExpeditions } from '../economy/player';
import type { EconomyState, PlayerState } from '../economy/state';
import type { ChoiceNeeds, GearKind } from './types';

const X = ECONOMY.expedition;

export const GEAR_KINDS = Object.keys(X.gear) as GearKind[];

export type GearError = 'needTool' | 'needGear' | 'haveGear' | 'gearFine' | 'alreadyGuide';
type Err = GearError | 'traveling' | 'notEnoughGold' | 'noExpedition' | 'inExpedition';

/** 쓸 수 있는 장비인가 (가졌고 망가지지 않았다) */
export function hasGear(p: PlayerState, gear: GearKind): boolean {
  return (p.gear[gear] ?? 0) > 0;
}

/** 이 선택지를 지금 고를 수 있나. 못 고르면 이유 */
export function needsMet(state: EconomyState, needs: ChoiceNeeds | undefined): GearError | 'noHorse' | null {
  if (!needs) return null;
  const p = state.player;
  if (needs.gear && !hasGear(p, needs.gear)) return 'needGear';
  if (needs.horse && p.horses.length === 0) return 'noHorse';
  if (needs.tool && cartCount(p.cart, 'tools') < needs.tool) return 'needTool';
  return null;
}

/** 장비를 한 번 쓴다 */
export function useGear(p: PlayerState, gear: GearKind, uses = 1): void {
  if (p.gear[gear] === undefined) return;
  p.gear[gear] = Math.max(0, p.gear[gear]! - uses);
}

/** 도구를 쓴다: usesPerTool번 쓰면 수레의 도구 하나가 닳아 없어진다 */
export function useTool(p: PlayerState, n: number): number {
  let spent = 0;
  for (let i = 0; i < n; i++) {
    p.toolUses++;
    if (p.toolUses >= X.usesPerTool) {
      p.toolUses = 0;
      spent += takeGoods(p.cart, 'tools', 1).reduce((s, l) => s + l.qty, 0);
    }
  }
  return spent;
}

/** 잡화점에서 장비를 산다 (어느 마을이나). 값은 그 마을 금고로 */
export function buyGear(state: EconomyState, gear: GearKind): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  if (hasGear(p, gear)) return 'haveGear';
  const price = X.gear[gear].price;
  if (p.gold < price) return 'notEnoughGold';
  p.gold -= price;
  state.towns[p.town]!.treasury += price;
  p.gear[gear] = X.gear[gear].durability;
  p.ledger.push({ day: state.day, kind: 'gear', what: 'buy', town: p.town, gear, price });
  return null;
}

/** 닳거나 망가진 장비를 수레의 도구 하나로 고친다 */
export function repairGear(state: EconomyState, gear: GearKind): Err | null {
  const p = state.player;
  if (p.expedition) return 'inExpedition';
  const left = p.gear[gear];
  if (left === undefined) return 'needGear';
  if (left >= X.gear[gear].durability) return 'gearFine';
  if (cartCount(p.cart, 'tools') < 1) return 'needTool';
  takeGoods(p.cart, 'tools', 1);
  p.gear[gear] = X.gear[gear].durability;
  p.ledger.push({ day: state.day, kind: 'gear', what: 'repair', town: p.town, gear, price: 0 });
  return null;
}

export function guideFee(state: EconomyState, town: number): number {
  return state.towns[town]!.tier === 'city' ? X.guideFee.city : X.guideFee.town;
}

/** 여관에서 안내인을 고용한다. 여관비처럼 경제에서 빠져나간다 */
export function hireGuide(state: EconomyState): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  if (!hasExpeditions(state.towns[p.town]!)) return 'noExpedition';
  if (p.guide) return 'alreadyGuide';
  const fee = guideFee(state, p.town);
  if (p.gold < fee) return 'notEnoughGold';
  p.gold -= fee;
  p.guide = true;
  p.ledger.push({ day: state.day, kind: 'guide', town: p.town, fee });
  return null;
}
