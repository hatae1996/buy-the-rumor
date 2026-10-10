// 말의 털색과 무늬, 이름 (기획서 "게임 시작 화면과 부품", 0.1.7 답 130).
// 종류마다 몸 그림은 하나이고, 마구간에 들어오는 말마다 털색과 무늬를 시즌 시드로 정한다(추첨으로 받은 "그 말").
// 털색과 무늬는 저장하지 않고 세계 시드와 말 번호로 다시 뽑는다. 이름은 플레이어가 지어 줄 때만 저장한다.
import { createRng, mixSeed } from '../rng';
import type { EconomyState, PlayerState } from '../economy/state';
import type { Horse } from './types';

/** 털색 (초안). hex는 그림이 오기 전 점 색이자 털 영역을 칠할 색 */
export const COATS = {
  chestnut: { name: '밤색', hex: '#9a5530' },
  bay: { name: '갈색', hex: '#6e4a32' },
  black: { name: '검정', hex: '#2e2724' },
  gray: { name: '회색', hex: '#9c9a96' },
  cream: { name: '크림', hex: '#e2d1aa' },
} as const;
export type CoatId = keyof typeof COATS;
export const COAT_IDS = Object.keys(COATS) as CoatId[];

/** 무늬: 없음, 이마 흰 줄, 흰 발목, 둘 다 */
export const MARKINGS = {
  none: '무늬 없음',
  blaze: '이마 흰 줄',
  socks: '흰 발목',
  both: '이마 흰 줄 · 흰 발목',
} as const;
export type MarkingId = keyof typeof MARKINGS;
export const MARKING_IDS = Object.keys(MARKINGS) as MarkingId[];

/** 기본 이름 (추천 목록). 이름을 지어 주지 않으면 이 중 하나 */
export const HORSE_NAMES: readonly string[] = [
  '밤톨',
  '바람',
  '구름',
  '들풀',
  '도토리',
  '번개',
  '보리',
  '갈기',
  '솔방울',
  '별이',
  '먼지',
  '콩떡',
  '누룽지',
  '조약돌',
  '산들',
  '꼬마',
  '흑단',
  '단풍',
  '은방울',
  '모래',
];

/** 말 이름 길이 (글자) */
export const HORSE_NAME_LENGTH = [1, 8] as const;

export interface HorseLooks {
  coat: CoatId;
  marking: MarkingId;
  /** 지어 준 이름, 없으면 기본 이름 */
  name: string;
  /** 플레이어가 지어 준 이름인가 */
  named: boolean;
}

/** 이 말의 털색, 무늬, 이름. 같은 세계의 같은 말은 언제나 같다 */
export function horseLooks(state: Pick<EconomyState, 'seed'>, h: Horse): HorseLooks {
  const rng = createRng(mixSeed(state.seed, 0x40a7, h.id));
  const coat = rng.pick(COAT_IDS);
  const marking = rng.pick(MARKING_IDS);
  const fallback = rng.pick(HORSE_NAMES);
  return { coat, marking, name: h.name ?? fallback, named: h.name !== undefined };
}

/** 내 말(따라오는 말과 두 번째 행렬의 말)에 이름을 지어 준다. 빈 이름이면 기본 이름으로 되돌린다 */
export function nameHorse(p: PlayerState, horseId: number, name: string): 'noHorse' | 'badName' | null {
  const h = [...p.horses, ...(p.caravan?.horses ?? [])].find((x) => x.id === horseId);
  if (!h) return 'noHorse';
  const n = name.trim().replace(/\s+/g, ' ');
  if (n === '') {
    delete h.name;
    return null;
  }
  if ([...n].length < HORSE_NAME_LENGTH[0] || [...n].length > HORSE_NAME_LENGTH[1] || /[<>&"]/.test(n)) return 'badName';
  h.name = n;
  return null;
}
