// 플레이어 봇의 성향. 숫자는 균형을 보려고 정한 초안이다.

export type BotProfileId = 'gatherer' | 'trader' | 'casual';

export interface BotProfile {
  id: BotProfileId;
  name: string;
  /** 마을 사이를 오가며 사고파나 */
  trades: boolean;
  /** 원정을 나가나 */
  expeditions: boolean;
  /** 하루에 원정을 몇 번까지 */
  expeditionsPerDay: number;
  /** 물건 하나당 이만큼(비율) 남아야 사서 옮긴다 */
  minMargin: number;
  /** 할 일이 없을 때 시세를 모르는(오래된) 마을로 둘러보러 갈 확률 (하루) */
  explore: number;
  /** 이 피로 이상이면 원정을 쉬고 먹거나 여관에 간다 */
  restAt: number;
  /** 살 것 고르기 (src/sim/bot/growth.ts). null이면 아무것도 사지 않는다 */
  growth: BotGrowth | null;
}

export interface BotGrowth {
  /** 사고 나서도 남기는 비상금 */
  reserve: number;
  /** 하루 유지비(일당, 말 먹이, 보관료) 이 날 수만큼은 늘 남긴다 */
  upkeepDays: number;
  /** 첫 말이 목표다 (수레가 차지 않아도 돈이 모이면 산다) */
  horseGoal: boolean;
  /** 채집꾼과 창고를 둔다 */
  gatherer: boolean;
  /** 얻는 값이 하루 유지비(먹이, 일당 + 보관료)의 이 배는 되어야 산다 */
  payMargin: number;
  /**
   * 두 번째 행렬을 큰 주문 도구로 쓴다 (0.0.8, src/sim/bot/caravanBig.ts). 같은 길을 도는 반복 지시는 쓰지 않는다
   * (0.0.7: 반복 지시로 장이 넘쳐 잃었다, questions.md 73번)
   */
  caravan: boolean;
  /** 이 돈이 모이면 두 번째 행렬을 생각한다 */
  caravanGold: number;
  /** 시간차 장사: 싼 철에 사서 창고에 두었다가 비싼 철에 판다 (0.0.7) */
  timeShift: boolean;
}

export const BOT_PROFILES: readonly BotProfile[] = [
  // 원정으로 모은 것을 그 마을에서 판다. 마을은 잘 옮기지 않는다
  { id: 'gatherer', name: '원정꾼', trades: false, expeditions: true, expeditionsPerDay: 3, minMargin: 0.25, explore: 0.02, restAt: 6,
    growth: { reserve: 80, upkeepDays: 10, horseGoal: false, gatherer: true, payMargin: 1.2, caravan: false, caravanGold: Infinity, timeShift: false } },
  // 원정은 안 나가고 싼 마을에서 사서 비싼 마을에 판다
  { id: 'trader', name: '장사꾼', trades: true, expeditions: false, expeditionsPerDay: 0, minMargin: 0.2, explore: 0.1, restAt: 7,
    growth: { reserve: 100, upkeepDays: 10, horseGoal: false, gatherer: false, payMargin: 1.2, caravan: true, caravanGold: 450, timeShift: true } },
  // 기획서의 "평범하게 하는 사람": 원정도 조금, 장사도 조금
  { id: 'casual', name: '보통 사람', trades: true, expeditions: true, expeditionsPerDay: 2, minMargin: 0.3, explore: 0.08, restAt: 5,
    growth: { reserve: 60, upkeepDays: 10, horseGoal: false, gatherer: true, payMargin: 1.2, caravan: false, caravanGold: Infinity, timeShift: false } },
];

export const botProfile = (id: BotProfileId): BotProfile => BOT_PROFILES.find((p) => p.id === id)!;
