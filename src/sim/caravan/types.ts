// 두 번째 행렬 (기획서 "성장", 시안 prototypes/screens-0.0.5.html의 지시서).
import type { Cart } from '../cart';
import type { GoodId } from '../economy/goods';
import type { Travel } from '../economy/state';
import type { Horse } from '../horses/types';

/** 지시서 한 줄: 이 마을에서 무엇을 얼마까지 사고 팔지 */
export interface CaravanStop {
  town: number;
  buys: { good: GoodId; qty: number; maxPrice: number }[];
  /** qty가 'all'이면 실은 것 전부 */
  sells: { good: GoodId; qty: number | 'all'; minPrice: number }[];
}

/** 지시서: 마을 순서와 끝나면 처음부터 다시 할지 */
export interface CaravanPlan {
  stops: CaravanStop[];
  repeat: boolean;
}

export interface Caravan {
  /** 행렬을 모는 마부 (고용한 일꾼 번호) */
  carter: number;
  horses: Horse[];
  cart: Cart;
  /** 있는 마을 (길 위면 떠난 마을) */
  town: number;
  travel: Travel | null;
  plan: CaravanPlan | null;
  /** 지시서에서 지금 가는(있는) 줄 번호 */
  stop: number;
  /** 이 마을 장날 신청을 낸 날 (장날이 지나면 다음 마을로 떠난다) */
  tradedDay: number | null;
  /** 불러들이는 중: 지시서를 멈추고 내가 있는 마을로 온다 */
  recalled: boolean;
  /** 빌린 수레 (0.0.9): 빌린 수레방 마을, 하루 값, 밀린 값. 산 수레면 null */
  rent: CartRent | null;
}

export interface CartRent {
  town: number;
  perDay: number;
  owed: number;
}
