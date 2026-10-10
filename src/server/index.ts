// 서버 번들의 입구 (0.2.0). Edge Function은 이 모듈만 부른다 (`npm run build:server`).
// src/server는 서버 쪽 일(표 읽고 쓰기, 잠금, 시각)을 맡고, 게임 규칙은 모두 src/sim에 있다.
export * from '../sim/service';
export { parityRun, type ParityResult } from './parity';
export { tickDue, type TickOptions, type TickSummary, type WorldTick } from './tick';
export { DAY_MS, daysBehind, marketAt, marketsDue } from './schedule';
export type { Db } from './db';
export { accountRequest, cleanInviteCode, type AccountError, type AccountRequest, type Me } from './account';
export { bannedWordIn, nameKey } from './names';
export { commandFor, gameRequest, viewFor, type CommandReply, type GameError, type Screen } from './game';
