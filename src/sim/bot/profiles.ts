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
}

export const BOT_PROFILES: readonly BotProfile[] = [
  // 원정으로 모은 것을 그 마을에서 판다. 마을은 잘 옮기지 않는다
  { id: 'gatherer', name: '원정꾼', trades: false, expeditions: true, expeditionsPerDay: 3, minMargin: 0.25, explore: 0.02, restAt: 6 },
  // 원정은 안 나가고 싼 마을에서 사서 비싼 마을에 판다
  { id: 'trader', name: '장사꾼', trades: true, expeditions: false, expeditionsPerDay: 0, minMargin: 0.2, explore: 0.1, restAt: 7 },
  // 기획서의 "평범하게 하는 사람": 원정도 조금, 장사도 조금
  { id: 'casual', name: '보통 사람', trades: true, expeditions: true, expeditionsPerDay: 2, minMargin: 0.3, explore: 0.08, restAt: 5 },
];

export const botProfile = (id: BotProfileId): BotProfile => BOT_PROFILES.find((p) => p.id === id)!;
