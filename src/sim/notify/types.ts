// 알림 (기획서 "시간과 접속 리듬 - 알림 (확정, 0.0.5)").
// 맡겨 둔 일이 끝났을 때 알려 주는 것이 기본이고, 들어오라고 재촉하지 않는다. 문구는 사실만.
// 이번 버전은 종류·설정·보낼 사건 목록과 묶기 규칙만. 실제 푸시는 서버 버전에서.

export type NotifyKind = 'market' | 'reservation' | 'arrival' | 'spoiling' | 'people' | 'season' | 'chances' | 'newspaper';

export interface NotifyKindDef {
  kind: NotifyKind;
  name: string;
  when: string;
  /** 처음 설정 */
  defaultOn: boolean;
  /** 묶을 때 쓰는 말: "장날 결과 3건" */
  bundle: string;
}

/** 알림을 누르면 가는 화면 */
export type NotifyTarget =
  | { tab: 'town'; building?: string }
  | { tab: 'map' }
  | { tab: 'cart' }
  | { tab: 'ledger'; section?: 'orders' | 'accounts' | 'prices' | 'people' }
  | { tab: 'news'; section?: 'paper' | 'notebook' | 'reports' | 'guild' };

/** 시뮬이 하루마다 만드는 "알림을 보낼 사건" */
export interface NotifyEvent {
  kind: NotifyKind;
  day: number;
  /** 사실만: "벨헤이븐 장날: 소금 20개 팔림, +312" */
  text: string;
  target: NotifyTarget;
  /** 말·일꾼 추첨 결과 (0.1.0). 급한 일이 아니라 보고로 보여 준다 */
  draw?: true;
}

export interface NotifySettings {
  enabled: Record<NotifyKind, boolean>;
  /** 하루 알림 수 상한. 넘치면 다음 접속 때 "자리를 비운 사이"로 넘긴다 */
  dailyCap: number;
  /** 조용한 시간 (시, 0~23). 그동안의 알림은 끝나는 시각에 한 번에 */
  quietStart: number;
  quietEnd: number;
  /** 알림 허락을 물은 날 (견습 졸업 때 묻는다). 아직이면 null */
  askedDay: number | null;
}

/** 실제로 보낼 알림 하나 (같은 종류는 묶는다) */
export interface Notification {
  kind: NotifyKind;
  title: string;
  body: string;
  target: NotifyTarget;
  count: number;
}
