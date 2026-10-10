// 견습과 하나씩 열리는 화면 (기획서 "처음 하는 플레이어"). 대사와 연출은 나중 버전.
// 성장에는 단계가 없다 (0.0.5): 여기서 여는 것은 화면을 하나씩 보여 주는 것이지, 살 수 있는 것을 막지 않는다.
import type { GoodId } from '../economy/goods';

/** 첫 5분의 7장면 */
export type SceneId = 'start' | 'firstExpedition' | 'firstLoad' | 'firstSale' | 'firstNews' | 'firstBuy' | 'graduation';

/**
 * 하나씩 열리는 것. 탭(짐칸, 장부, 소식, 지도)은 견습 장면이, 나머지는 견습 뒤 조건이 연다 (0.1.2: 짐칸 탭이 장부에서 나왔다).
 * reservation(예약 주문)과 bank(은행)는 기능이 아직 없어 열린 날만 적어 둔다
 */
export type UnlockId = 'cart' | 'ledger' | 'news' | 'map' | 'memory' | 'rumors' | 'editPrice' | 'reservation' | 'bank';

export interface ApprenticeState {
  scene: SceneId;
  /** 견습 마을 (혼자 쓰는 마을. 지금은 로컬이라 세계의 그 마을을 그대로 쓴다) */
  town: number;
  /** 졸업하고 처음 떠날 마을 (첫 신문의 사건이 난 곳) */
  destination: number;
  /** 이 장면에 들어온 날 (장날을 겪었는지 볼 때) */
  sceneDay: number;
}

/**
 * 견습 손님 (기획 0.2.1, 답 137): 졸업생이 가는 마을에서 그 사람만의 손님이 견습에서 산 물건을
 * 견습에서 산 수량까지만, 견습에서 안내한 값에 사 준다. 그 마을에 도착한 뒤 첫 장날 한 번
 */
export interface ApprenticeGuest {
  town: number;
  good: GoodId;
  qty: number;
  price: number;
}
