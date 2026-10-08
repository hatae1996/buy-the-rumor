// 알림 종류와 처음 설정 (기획서 표 그대로).
import type { NotifyKind, NotifyKindDef, NotifySettings } from './types';

export const NOTIFY_KINDS: readonly NotifyKindDef[] = [
  { kind: 'market', name: '장날 결과', when: '내 팔기·사기 신청이 체결되거나 안 됐을 때', defaultOn: true, bundle: '장날 결과' },
  { kind: 'reservation', name: '예약 주문', when: '예약 구매·예약 판매가 체결됐을 때', defaultOn: true, bundle: '예약 주문' },
  { kind: 'arrival', name: '도착', when: '내 행렬이나 두 번째 행렬이 마을에 도착했을 때', defaultOn: true, bundle: '도착' },
  { kind: 'spoiling', name: '곧 상할 짐', when: '수레나 창고의 음식이 내일 상할 때', defaultOn: true, bundle: '곧 상할 짐' },
  { kind: 'people', name: '사람과 말', when: '일당이 모자라 일꾼이 떠나려 할 때, 말 먹이가 떨어졌을 때', defaultOn: true, bundle: '사람과 말' },
  { kind: 'season', name: '시즌', when: '시즌 마지막 날, 공동 의뢰 결과', defaultOn: true, bundle: '시즌 소식' },
  { kind: 'chances', name: '원정 기회', when: '기회가 최대(6개)까지 찼을 때', defaultOn: false, bundle: '원정 기회' },
  { kind: 'newspaper', name: '신문', when: '새 신문이 나왔을 때', defaultOn: false, bundle: '새 신문' },
];

export const notifyKind = (kind: NotifyKind): NotifyKindDef => NOTIFY_KINDS.find((k) => k.kind === kind)!;

/** 처음 설정: 표의 켜짐/꺼짐, 하루 6개, 밤 11시~아침 8시 조용히 */
export function defaultNotifySettings(): NotifySettings {
  return {
    enabled: Object.fromEntries(NOTIFY_KINDS.map((k) => [k.kind, k.defaultOn])) as Record<NotifyKind, boolean>,
    dailyCap: 6,
    quietStart: 23,
    quietEnd: 8,
    askedDay: null,
  };
}
