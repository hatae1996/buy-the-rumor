// 원정에서 생기는 이야기가 되는 순간 (업적 인장과 길드 의뢰가 센다).
// 카드와 고른 선택지, 얻고 잃은 것을 보고 정한다. 반복만 하면 쌓이는 것(원정 횟수)은 세지 않는다.
import type { EconomyState, PlayerState } from '../economy/state';
import type { Choice } from '../expedition/types';
import { noteMoment } from './record';

export interface CardOutcome {
  card: string;
  choice: Choice;
  /** 확률이 있던 선택이면 성공했는지 (없으면 true) */
  success: boolean;
  /** 이 선택으로 얻은 물품 수 (물품마다) */
  gained: Partial<Record<string, number>>;
  /** 이 선택으로 잃은 짐 수 */
  lost: number;
}

export function noteExpeditionMoments(state: EconomyState, p: PlayerState, o: CardOutcome): void {
  const got = (good: string) => (o.gained[good] ?? 0) > 0;
  const anything = Object.values(o.gained).some((n) => (n ?? 0) > 0);
  if (o.card === 'bear' && o.choice.needs?.gear === 'torch') noteMoment(state, p, 'bearTorch');
  if ((o.card === 'bear' || o.card === 'wolfPack') && o.choice.needs?.horse) noteMoment(state, p, 'horseEscape');
  if (o.card === 'wolfPack' && !o.choice.needs?.horse && o.lost === 0) noteMoment(state, p, 'wolfSafe');
  if ((o.card === 'frozenCreek' || o.card === 'frozenHarbor') && got('fish')) noteMoment(state, p, 'iceFishing');
  if (o.card === 'silverRun' && got('fish')) noteMoment(state, p, 'silverRun');
  if (o.card === 'storm' && o.success && got('fish')) noteMoment(state, p, 'stormSail');
  if (o.card === 'checkTrap' && anything) noteMoment(state, p, 'trapLuck');
}
