// 화면이 남기는 기록 사건 (handoff 0.2.0 4번, play_events 표). 로컬 게임에서는 아무것도 하지 않고,
// 서버 게임이 보내는 곳을 꽂는다(setTracker). 실패해도 게임을 막지 않는다.
export type TrackKind = 'founding_start' | 'founding_done' | 'apprentice_start' | 'graduate' | 'session_start' | 'heartbeat' | 'home_tip';

let sink: ((kind: TrackKind, data?: Record<string, unknown>) => void) | null = null;

export function setTracker(fn: typeof sink): void {
  sink = fn;
}

export function track(kind: TrackKind, data?: Record<string, unknown>): void {
  try {
    sink?.(kind, data);
  } catch {
    // 기록은 게임을 막지 않는다
  }
}
