// 말 데이터 모양 (기획서 "말"). 모두 단순한 데이터라 JSON으로 저장하고 서버로 보낼 수 있다.
import type { HORSES } from '../constants';

export type HorseKind = keyof typeof HORSES.kinds;

export interface Horse {
  id: number;
  kind: HorseKind;
  /** 체력: 피로 0~max (플레이어 피로와 같은 규칙) */
  fatigue: number;
  /** 연달아 굶은 날 */
  hungry: number;
  /** 사 온 값 (랭킹 순자산은 말을 구입가의 절반으로 친다) */
  price: number;
  /** 사 온 마구간. 굶다 도망치면 이리로 돌아간다 */
  home: number;
}

/** 목장 마을의 마구간. 남은 수는 그 마을에 가야만 보인다 */
export interface Stable {
  town: number;
  stock: Record<HorseKind, number>;
}

/** 일정표의 입고 하나 */
export interface HorseArrival {
  day: number;
  town: number;
  kind: HorseKind;
  count: number;
}

export interface HorseMarket {
  /** 입고 일정을 짠 시즌 번호. 아직 없으면 0 */
  season: number;
  stables: Stable[];
  /** 아직 풀리지 않은 입고 (목장 화재 동안은 미뤄진다) */
  arrivals: HorseArrival[];
  /** 풀린 입고 기록 (소문 도장과 개발용 화면) */
  arrived: HorseArrival[];
  /** 말 번호 (경제 쪽 번호와 따로 센다) */
  nextId: number;
}
