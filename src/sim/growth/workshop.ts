// 플레이어 작업장 (기획서 "성장": 염장소, 대장간). 이번 버전은 구조만, 실제 생산은 나중 버전.
// 도시에는 이미 마을 금고가 운영하는 대장간·염장 공방이 있다 (src/sim/economy/workshop.ts). 플레이어 작업장은 따로 둔다.
import type { GoodId } from '../economy/goods';

export type WorkshopKind = 'curing' | 'smithy';

export interface WorkshopRecipe {
  kind: WorkshopKind;
  name: string;
  /** 하루 한 번 만들 때 드는 재료와 나오는 것 (도시 공방과 같은 비율을 쓸 자리) */
  inputs: Partial<Record<GoodId, number>>;
  output: { good: GoodId; qty: number };
  /** 하루 운영비 */
  upkeep: number;
}

/** 나중에 쓸 초안 (숫자는 도시 공방 비율을 따라 맞춘다) */
export const WORKSHOP_RECIPES: readonly WorkshopRecipe[] = [
  { kind: 'curing', name: '염장소', inputs: { salt: 1, meat: 2 }, output: { good: 'salted', qty: 2 }, upkeep: 5 },
  { kind: 'smithy', name: '대장간', inputs: { ore: 2, wood: 1 }, output: { good: 'tools', qty: 1 }, upkeep: 8 },
];

/** 플레이어가 가진 작업장 하나 (사거나 지으면 생긴다) */
export interface OwnedWorkshop {
  kind: WorkshopKind;
  town: number;
  since: number;
}
