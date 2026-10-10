// 장날 시각 (작업목록-0.2.0 3번): 시즌 여는 때(격주 월요일 아침 9시, 한국 시간)부터 2시간 30분마다 장날 하나.
// 1일째 신청은 여는 때부터 받고, 첫 장날은 여는 때 + 2시간 30분이다.

/** 게임 속 하루 = 실제 2시간 30분 (로컬 src/ui/game.ts의 DAY_MS와 같다, 시험으로 고정) */
export const DAY_MS = 2.5 * 60 * 60 * 1000;

/** now까지 열렸어야 할 장날 수. 시즌이 열리기 전이면 0 */
export function marketsDue(opensAtMs: number, nowMs: number): number {
  return nowMs < opensAtMs ? 0 : Math.floor((nowMs - opensAtMs) / DAY_MS);
}

/**
 * 이 세계가 지금 돌려야 할 날 수. 세계의 day는 다음에 열 장날의 날 번호(1부터)라,
 * 이미 연 장날은 day - 1개다
 */
export function daysBehind(opensAtMs: number, nowMs: number, worldDay: number): number {
  return Math.max(0, marketsDue(opensAtMs, nowMs) - (worldDay - 1));
}

/** day일째 장날 시각 */
export function marketAt(opensAtMs: number, day: number): number {
  return opensAtMs + day * DAY_MS;
}
