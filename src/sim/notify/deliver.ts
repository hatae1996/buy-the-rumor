// 알림 보내기 규칙 (기획서 "알림"): 켠 종류만, 비슷한 알림은 하나로 묶고("장날 결과 3건"),
// 하루 상한(6개)을 넘으면 다음 접속의 "자리를 비운 사이"로 넘기고, 조용한 시간에는 끝나는 시각에 한 번에.
// 시각(시)은 화면·서버가 넘겨준다. 시뮬은 실제 시간을 모른다.
import { notifyKind } from './kinds';
import type { Notification, NotifyEvent, NotifySettings } from './types';

/** 조용한 시간인가 (밤 11시~아침 8시처럼 자정을 넘을 수 있다) */
export function isQuiet(settings: NotifySettings, hour: number): boolean {
  const { quietStart: a, quietEnd: b } = settings;
  if (a === b) return false;
  return a < b ? hour >= a && hour < b : hour >= a || hour < b;
}

/** 같은 종류를 하나로 묶는다. 하나뿐이면 그 문장 그대로 */
export function bundle(events: readonly NotifyEvent[]): Notification[] {
  const byKind = new Map<string, NotifyEvent[]>();
  for (const e of events) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  return [...byKind.values()].map((list) => {
    const first = list[0]!;
    const def = notifyKind(first.kind);
    return list.length === 1
      ? { kind: first.kind, title: def.name, body: first.text, target: first.target, count: 1 }
      : { kind: first.kind, title: `${def.bundle} ${list.length}건`, body: list.map((e) => e.text).join('\n'), target: first.target, count: list.length };
  });
}

export interface DeliveryPlan {
  /** 지금 보낼 알림 */
  send: Notification[];
  /** 조용한 시간이라 아침에 보낼 것 */
  later: NotifyEvent[];
  /** 하루 상한을 넘어 "자리를 비운 사이"로 넘길 것 */
  toSummary: NotifyEvent[];
}

/**
 * 오늘 사건을 어떻게 보낼지 정한다.
 * sentToday: 오늘 이미 보낸 알림 수. hour: 지금 시각(0~23)
 */
export function planDelivery(events: readonly NotifyEvent[], settings: NotifySettings, hour: number, sentToday: number): DeliveryPlan {
  const on = events.filter((e) => settings.enabled[e.kind]);
  if (isQuiet(settings, hour)) return { send: [], later: on, toSummary: [] };
  const bundled = bundle(on);
  const room = Math.max(0, settings.dailyCap - sentToday);
  const send = bundled.slice(0, room);
  const sentKinds = new Set(send.map((n) => n.kind));
  return { send, later: [], toSummary: on.filter((e) => !sentKinds.has(e.kind)) };
}

/** 재촉하는 말이 섞이지 않았는지 (사실만 쓴다). 화면·서버가 문구를 바꿀 때 검사용 */
export function isFactual(text: string): boolean {
  return !/(지금 안 오면|손해|서두르세요|놓치지 마세요|빨리 오세요)/.test(text);
}
