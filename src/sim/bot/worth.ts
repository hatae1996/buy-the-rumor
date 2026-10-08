// 순자산 (기획서 "랭킹과 보상"): 현금 + 예금 − 빚 + (짐과 말의 값 × 절반).
// 짐은 마지막으로 본 장날 시세로 친다. 예금, 빚, 말은 아직 없다.
import type { PlayerView } from '../economy';

export const CARGO_WORTH_SHARE = 0.5;

export function netWorth(view: PlayerView): number {
  // 지금 마을 시세, 길 위면 떠나온 마을의 기억
  const town = view.location.kind === 'town' ? view.location.town : view.location.from;
  const prices = view.market?.price ?? view.memory[town]?.prices;
  const cargo = view.cargo.reduce((s, l) => s + l.qty * (prices?.[l.good] ?? 0), 0);
  return view.gold + view.reserved + Math.round(cargo * CARGO_WORTH_SHARE);
}
