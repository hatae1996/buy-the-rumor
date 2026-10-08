// 원정 카드 목록 (기획서 "원정 카드 목록 (초안)" 약 60장 + 0.0.3에서 만든 카드).
// 이름이 같은 카드는 기획서 쪽을 따랐고, 지금만 있던 염전·길·광부 카드 등은 살렸다.
// 숫자(피로, 확률, 얻는 양)는 초안이며 돌려보며 맞춘다.
import type { CardDef } from '../types';
import { EVENT_CARDS } from './events';
import { FIELD_CARDS } from './field';
import { FOREST_CARDS } from './forest';
import { MINE_CARDS } from './mine';
import { MOUNTAIN_CARDS } from './mountain';
import { REGIONAL_CARDS } from './regional';
import { SEA_CARDS } from './sea';
import { SEASON_CARDS } from './season';

export const CARDS: readonly CardDef[] = [
  ...FOREST_CARDS,
  ...MOUNTAIN_CARDS,
  ...SEA_CARDS,
  ...FIELD_CARDS,
  ...REGIONAL_CARDS,
  ...SEASON_CARDS,
  ...EVENT_CARDS,
  ...MINE_CARDS,
];

const byId = new Map(CARDS.map((c) => [c.id, c]));

export const cardById = (id: string): CardDef => {
  const c = byId.get(id);
  if (!c) throw new Error(`없는 원정 카드: ${id}`);
  return c;
};
