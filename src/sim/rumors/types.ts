// 소문 데이터 모양 (기획서 "소문"). 모두 단순한 데이터라 JSON으로 저장하고 서버로 보낼 수 있다.
// 세계의 소문(WorldRumor)은 진짜 여부를 갖고 있어 플레이어에게 보이지 않는다.
// 플레이어에게는 들은 말(HeardRumor)만 보인다.
import type { GoodId } from '../economy/goods';
import type { ScheduledEventId } from '../events/types';
import type { RegionTagId } from '../worldgen';

/** 소문이 어디서 생겼나. 말 입고(horse)는 말(0.0.4 작업 4)이 들어오면 만든다 */
export type RumorSource = 'omen' | 'hidden' | 'price' | 'orders' | 'trait' | 'horse' | 'false';

/** 숨은 숫자를 소문으로 내는 자원지 (사냥감, 물고기, 광맥) */
export type NodeRumorKind = 'forest' | 'fish' | 'ore';

/** 소문의 내용. 진짜 상태에서 만들고, 헛소문은 일부러 틀리게 만든다 */
export type RumorFact =
  /** 다가오는 사건의 징조. 헛징조면 eventDay가 null */
  | { kind: 'omen'; event: ScheduledEventId; town: number; eventDay: number | null }
  /** 자원지 남은 양 ("사냥꾼들이 빈손이다") */
  | { kind: 'node'; town: number; resource: NodeRumorKind; level: 'low' | 'high' }
  /** 다른 마을 시세 ("스톤힐에서 가죽이 금값이래") */
  | { kind: 'price'; town: number; good: GoodId; dir: 'high' | 'low'; price: number }
  /** 장날 신청 현황 ("소금 사려는 사람이 많다더라"). qty는 사려는 양과 팔려는 양의 차이 */
  | { kind: 'orders'; town: number; good: GoodId; side: 'buy' | 'sell'; qty: number }
  /** 마을 특색 ("북쪽 숲에 곰이 산다") */
  | { kind: 'trait'; town: number; tag: RegionTagId };

export type RumorKind = RumorFact['kind'];

/** 한 마을에 닿은 소문. 건널 때마다 흐려지고(blur) 부풀려진다(scale) */
export interface RumorCopy {
  town: number;
  /** 이 마을에 닿는 날 */
  day: number;
  /** 흐려진 정도. 0이면 숫자가 그대로, 1이면 어림, 2부터는 숫자가 사라진다 */
  blur: number;
  /** 부풀린 배율 (1이면 그대로). 소문의 방향으로 부풀린다 */
  scale: number;
}

export interface WorldRumor {
  id: number;
  source: RumorSource;
  fact: RumorFact;
  /** 시작한 마을 */
  origin: number;
  /** 생긴 날 */
  day: number;
  /** 진짜인가 (플레이어에게 숨김) */
  truth: boolean;
  /** 이날이 지나면 더 들리지 않는다 */
  expires: number;
  importance: number;
  /** 마을마다 닿는 날과 흐려진 정도. 생길 때 길을 따라 미리 정해 둔다 */
  reach: RumorCopy[];
}

/** 소문꾼 성격 (기획서 "소문꾼의 성격"). 화면에 보이지 않는다 */
export type Personality = 'elder' | 'braggart' | 'merchant' | 'coward';

export interface Gossip {
  id: number;
  town: number;
  /** "우물가 마르타" */
  name: string;
  personality: Personality;
  /** 장사꾼이 파는 물품. 아니면 null */
  good: GoodId | null;
}

/** 세계의 소문 상태 */
export interface RumorMill {
  /** 아직 사라지지 않은 소문 */
  live: WorldRumor[];
  gossips: Gossip[];
  /** 소문꾼을 짠 시즌 번호 (시즌이 바뀌면 다시 짠다). 아직 없으면 0 */
  gossipSeason: number;
  /** 같은 이야기를 다시 소문 내지 않는 날 (이야기 열쇠 → 이날부터 다시) */
  cooldown: Record<string, number>;
  /**
   * 지난번 소문 낸 값 (시세는 값, 신청 현황은 사려는 양 − 팔려는 양).
   * 늘 싼 물건이 "헐값이래"로 수첩을 덮지 않게, 크게 바뀌었을 때만 다시 소문 낸다
   */
  lastSaid: Record<string, number>;
  /** 소문과 수첩 줄 번호. 경제 쪽 번호(state.nextId)와 따로 세어 소문이 경제 결과를 바꾸지 않게 한다 */
  nextId: number;
}

/**
 * 플레이어가 들은 주장. 수첩 도장을 찍을 때 실제와 견준다.
 * 플레이어가 들은 그대로라 숨길 것이 없다
 */
export type Claim =
  /** 징조: from(소문이 생긴 날)부터 until까지 그 사건이 신문에 나오면 맞았다 */
  | { kind: 'omen'; event: ScheduledEventId; town: number; from: number; until: number }
  | { kind: 'node'; town: number; resource: NodeRumorKind; level: 'low' | 'high' }
  /**
   * 시세. bound가 about이면 "48에 팔린다", atLeast면 "40은 넘는다", atMost면 "20도 안 한다",
   * null이면 숫자 없이 "금값"/"헐값"
   */
  | { kind: 'price'; town: number; good: GoodId; dir: 'high' | 'low'; price: number | null; bound: 'about' | 'atLeast' | 'atMost' | null }
  | { kind: 'orders'; town: number; good: GoodId; side: 'buy' | 'sell'; qty: number | null }
  | { kind: 'trait'; town: number; tag: RegionTagId };

/** 어떻게 들었나: 소문꾼, 여관 손님, 원정에서 직접 봄, 전서구, 정보원 */
export type HeardVia = 'gossip' | 'inn' | 'seen' | 'pigeon' | 'informant';

/** 들은 이야기 수첩 한 줄 */
export interface HeardRumor {
  id: number;
  /** 들은 날 */
  day: number;
  /** 들은 마을 */
  town: number;
  text: string;
  via: HeardVia;
  /** 누구에게 (소문꾼 이름, "여관 손님" 등) */
  from: string;
  /** 소문꾼 번호. 소문꾼에게 들은 게 아니면 null */
  gossip: number | null;
  /** 세계 소문 번호 (같은 소문을 두 번 듣지 않게). 없으면 null */
  rumor: number | null;
  importance: number;
  /** 도장을 찍을 주장. 직접 본 것처럼 확인할 게 없으면 null */
  claim: Claim | null;
  /** 맞았다/틀렸다 도장. 아직 확인 못 했으면 null */
  stamp: 'right' | 'wrong' | null;
  stampDay: number | null;
}
