// 카드 데이터를 짧게 쓰는 도움 함수.
import type { Season } from '../../season';
import type { RegionTagId, ResourceKind } from '../../worldgen';
import type { CardSource, Choice, Effect, TownEventKind } from '../types';

export const T = (resource: ResourceKind): CardSource => ({ kind: 'terrain', resource });
export const S = (season: Season, resource: ResourceKind): CardSource => ({ kind: 'season', season, resource });
export const TAG = (tag: RegionTagId): CardSource => ({ kind: 'tag', tag });
export const EV = (event: TownEventKind): CardSource => ({ kind: 'event', event });

export const SPRING = 0;
export const SUMMER = 1;
export const AUTUMN = 2;
export const WINTER = 3;

/** 아무 일 없이 지나간다 */
export const pass = (label = '지나친다', fatigue = 0): Choice => ({ label, fatigue, success: [] });
/** 원정을 여기서 끝낸다 */
export const turnBack = (label = '돌아간다'): Choice => ({ label, fatigue: 0, success: [{ kind: 'end' }] });
/** 쉬어 간다 */
export const rest = (label: string, fatigue = -1): Choice => ({ label, fatigue, success: [] });

export const maybe = (chance: number, ...effects: Effect[]): Effect => ({ kind: 'maybe', chance, effects });
