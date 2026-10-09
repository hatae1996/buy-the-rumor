// 장비와 도구 (기획서 "원정 카드 목록 - 덱 짜기와 결과 규칙").
// 도구는 소모품: 나무를 베거나 광석을 캐는 선택지가 도구를 쓴다.
// 장비(활, 횃불, 덫, 그물)는 잡화점에서 사고, 쓰다 보면 망가지고, 망가지면 도구 하나로 고친다.
// 장비도 짐칸 자리를 차지한다 (0.1.2): 수레에 실은 장비만 원정에서 쓴다. 남은 횟수는 조각이 기억한다.
// 안내인은 여관에서 고용하면 다음 원정 한 번 동안 나쁜 카드 1장을 건너뛴다.
import { cartCount, loadGear, takeGoods, type Piece } from '../cart';
import { ECONOMY } from '../constants';
import { hasExpeditions } from '../economy/player';
import type { EconomyState, PlayerState } from '../economy/state';
import type { ChoiceNeeds, GearKind } from './types';

const X = ECONOMY.expedition;

export const GEAR_KINDS = Object.keys(X.gear) as GearKind[];

export type GearError = 'needTool' | 'needGear' | 'haveGear' | 'gearFine' | 'alreadyGuide';
type Err = GearError | 'traveling' | 'notEnoughGold' | 'noExpedition' | 'inExpedition' | 'noRoom';

/** 수레에 실린 그 장비 조각들 (남은 횟수 많은 것부터) */
function gearPieces(p: PlayerState, gear: GearKind): Piece[] {
  return p.cart.pieces.filter((q) => q.good === gear && q.uses !== undefined).sort((a, b) => b.uses! - a.uses! || a.id - b.id);
}

/** 수레에 실린 그 장비의 남은 횟수 (가장 많이 남은 것). 없으면 null, 0이면 망가진 것 */
export function gearUses(p: PlayerState, gear: GearKind): number | null {
  return gearPieces(p, gear)[0]?.uses ?? null;
}

/** 쓸 수 있는 장비인가 (수레에 실었고 망가지지 않았다) */
export function hasGear(p: PlayerState, gear: GearKind): boolean {
  return (gearUses(p, gear) ?? 0) > 0;
}

/** 이 선택지를 지금 고를 수 있나. 못 고르면 이유 */
export function needsMet(p: PlayerState, needs: ChoiceNeeds | undefined): GearError | 'noHorse' | null {
  if (!needs) return null;
  if (needs.gear && !hasGear(p, needs.gear)) return 'needGear';
  if (needs.horse && p.horses.length === 0) return 'noHorse';
  if (needs.tool && cartCount(p.cart, 'tools') < needs.tool) return 'needTool';
  return null;
}

/** 장비를 한 번 쓴다 (가장 많이 남은 것부터) */
export function useGear(p: PlayerState, gear: GearKind, uses = 1): void {
  const piece = gearPieces(p, gear)[0];
  if (!piece) return;
  piece.uses = Math.max(0, piece.uses! - uses);
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
export function buyGear(state: EconomyState, p: PlayerState, gear: GearKind): Err | null {
  if (p.travel) return 'traveling';
  if (hasGear(p, gear)) return 'haveGear';
  const price = X.gear[gear].price;
  if (p.gold < price) return 'notEnoughGold';
  // 망가진 같은 장비는 잡화점에 두고 새것을 싣는다 (예전처럼 바꿔 끼우기)
  const broken = gearPieces(p, gear).filter((q) => q.uses === 0);
  const before = p.cart.pieces;
  p.cart.pieces = p.cart.pieces.filter((q) => !broken.includes(q));
  if (!loadGear(p.cart, gear, X.gear[gear].durability)) {
    p.cart.pieces = before;
    return 'noRoom';
  }
  p.gold -= price;
  state.towns[p.town]!.treasury += price;
  p.ledger.push({ day: state.day, kind: 'gear', what: 'buy', town: p.town, gear, price });
  return null;
}

/** 닳거나 망가진 장비를 수레의 도구 하나로 고친다 */
export function repairGear(state: EconomyState, p: PlayerState, gear: GearKind): Err | null {
  if (p.expedition) return 'inExpedition';
  // 가장 닳은 것부터 고친다
  const piece = gearPieces(p, gear).at(-1);
  if (!piece) return 'needGear';
  if (piece.uses! >= X.gear[gear].durability) return 'gearFine';
  if (cartCount(p.cart, 'tools') < 1) return 'needTool';
  takeGoods(p.cart, 'tools', 1);
  piece.uses = X.gear[gear].durability;
  p.ledger.push({ day: state.day, kind: 'gear', what: 'repair', town: p.town, gear, price: 0 });
  return null;
}

export function guideFee(state: EconomyState, town: number): number {
  return state.towns[town]!.tier === 'city' ? X.guideFee.city : X.guideFee.town;
}

/** 여관에서 안내인을 고용한다. 여관비처럼 경제에서 빠져나간다 */
export function hireGuide(state: EconomyState, p: PlayerState): Err | null {
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
