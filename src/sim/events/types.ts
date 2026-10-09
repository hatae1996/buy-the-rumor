// 사건 데이터 모양 (기획서 "사건"). 사건은 시뮬 숫자(생산, 수요, 길, 원정 덱)만 바꾸고 가격을 직접 정하지 않는다.
import type { GoodId } from '../economy/goods';
import type { JobId } from '../economy/jobs';
import type { TownEventKind } from '../expedition/types';
import type { Season } from '../season';
import type { RegionTagId, ResourceKind, TownTier } from '../worldgen';

export type ScheduledEventId =
  | 'landslide'
  | 'mineCollapse'
  | 'wolves'
  | 'animalSickness'
  | 'drought'
  | 'storm'
  | 'ranchFire'
  | 'bigCatch'
  | 'bumperHarvest'
  | 'newVein'
  | 'shipyard'
  | 'castleRepair'
  | 'festival'
  | 'army'
  | 'winterFestival'
  | 'relief'
  | 'plagueRumor'
  | 'bandits'
  | 'bridgeCollapse'
  | 'taxHike'
  | 'grandCaravan';

/** 반응 사건: 일정표가 아니라 시장 상태에서 생긴다 */
export type ReactiveEventId = 'workersQuit' | 'rush' | 'famine' | 'sellout';

export type EventId = ScheduledEventId | ReactiveEventId;

export type EventCategory = 'supplyDown' | 'supplyUp' | 'demandUp' | 'demandDown' | 'road' | 'rule' | 'market' | 'reactive';

/**
 * 효과. good이나 job을 비워 두면 그 사건에 붙은 물품·직업 (반응 사건, 대상단)
 */
export type EventEffect =
  /** 채집 생산 배율 */
  | { kind: 'produce'; good?: GoodId; factor: number }
  /** 주민 수요: 배율과 하루 더 사는 양 */
  | { kind: 'demand'; good?: GoodId; factor?: number; extra?: number }
  /** 주민이 음식을 더 비싸게라도 산다 (굶주린 마을) */
  | { kind: 'citizenBid'; goods: 'food'; factor: number }
  /** 일꾼이 그 일의 벌이를 이 배율로 본다 (일을 줄이거나 몰려든다) */
  | { kind: 'jobIncome'; job?: JobId; factor: number }
  /** 그 마을 장에서 그 물건을 팔 수 없다 */
  | { kind: 'saleBan'; good: GoodId }
  /** 장날 거래세: 판 값의 이 비율을 마을 금고가 가져간다 */
  | { kind: 'salesTax'; rate: number }
  /** 이 마을로 오가는 길에 통행세 */
  | { kind: 'toll'; gold: number }
  /** 마을 근처 길 칸을 막는다 (일정 짤 때 칸을 정한다) */
  | { kind: 'blockRoads'; terrain: 'highland' | 'any'; count: number | 'all' }
  /** 사건이 시작할 때 한 번: 자원지 남은 양 배율, 자원지 칸 더하기 */
  | { kind: 'node'; resource: ResourceKind; amountFactor?: number; addTiles?: number }
  /** NPC 대상인이 그 물건을 한꺼번에 사거나 판다 (시작하는 날 장날) */
  | { kind: 'bulk'; side: 'buy' | 'sell'; qty: number }
  /**
   * 큰 주문 (0.0.7): 사건 기간 동안 그 마을 장날마다 한 물품을 기준 가격의 factor배에 사들인다. 모두 qty개가 차면 끝.
   * good을 비우면 사건에 붙은 물품. 돈은 바깥(조선소, 영주, 군대, 대상단)에서 온다
   */
  | { kind: 'bigOrder'; good?: GoodId; qty: number; factor: number }
  /** 말 입고가 늦어진다 (말은 0.0.4 작업 4에서) */
  | { kind: 'horseDelay'; days: number };

export interface EventNeeds {
  /** 이 자원지가 있는 마을에서만 */
  resource?: ResourceKind;
  /** 이 특색이 근처에 있는 마을에서만 */
  tag?: RegionTagId;
  tier?: TownTier;
  /** 막을 산길이 근처에 있어야 */
  highlandRoad?: boolean;
}

export interface EventDef {
  id: EventId;
  name: string;
  category: EventCategory;
  /** 한 마을, 인근 마을(가까운 마을들), 전체 */
  scope: 'town' | 'nearby' | 'all';
  /** 일어날 수 있는 계절 (없으면 언제나) */
  seasons?: readonly Season[];
  needs?: EventNeeds;
  /** 일정에 뽑힐 무게 (기본 1). 계절별로 다르면 배열 */
  weight?: number | readonly [number, number, number, number];
  effects: readonly EventEffect[];
  /** 이어지는 날. 'season'이면 시즌 끝까지 */
  days: number | 'season';
  /** 1~3일 전에 도는 징조 소문. 없으면 null */
  omen: string | null;
  /** 일어나지 않는 헛징조로도 잘 도나 (새 광맥) */
  fakeOmenWeight?: number;
  /** 신문 머리기사 (사실만). 물품과 직업은 그 사건에 붙은 것 (없으면 null) */
  news: (c: { town: string; good: GoodId | null; job: JobId | null }) => string;
  /** 원정 덱의 사건 카드를 부르는 종류 */
  deck: TownEventKind | null;
  /** 대상단처럼 물품 하나를 골라 붙이는 사건이면 고를 수 있는 물품 */
  goods?: readonly GoodId[];
  /** 징조 소문이 도는 비율과 며칠 전에 도는지. 없으면 ECONOMY.events의 기본값 (큰 주문은 늘 일찍 돈다) */
  omenShare?: number;
  omenLead?: readonly [number, number];
}

/** 큰 주문 하나: 남은 양과 사는 값 */
export interface BigOrder {
  good: GoodId;
  left: number;
  price: number;
}

/** 일정표의 사건 하나 */
export interface ScheduledEvent {
  event: ScheduledEventId;
  town: number;
  day: number;
  /** 징조 소문이 도는 날 (없으면 null) */
  omenDay: number | null;
  good?: GoodId;
  /** 막는 길 칸 */
  tiles?: number[];
}

/** 일어나지 않는 헛징조 */
export interface FakeOmen {
  event: ScheduledEventId;
  town: number;
  day: number;
}

/** 지금 벌어지고 있는 사건 */
export interface ActiveEvent {
  id: number;
  event: EventId;
  /** 사건이 난 마을 */
  town: number;
  /** 효과가 미치는 마을들 */
  towns: number[];
  start: number;
  /** 이날까지 (포함) */
  end: number;
  good?: GoodId;
  job?: JobId;
  tiles?: number[];
  /** 큰 주문 (남은 양). 다 차면 사건이 끝난다 */
  orders?: BigOrder[];
}

/** 시즌 기록 한 줄: 랭킹의 "Buy the Rumor" 부문이 징조와 신문 날짜를 본다 */
export interface EventRecord {
  event: EventId;
  town: number;
  /** 신문에 실린 날 (= 시작한 날) */
  day: number;
  end: number;
  omenDay: number | null;
  good?: GoodId;
}

/** 시즌 (기획서 "멀티플레이와 시즌": 실제 13일 = 게임 속 사계절 한 바퀴) */
export interface SeasonState {
  /** 몇 번째 시즌 (1부터) */
  number: number;
  startDay: number;
  /** 게임 속 날 수 */
  length: number;
  /** 시즌 테마 (혹한, 풍어 등. src/sim/ranking/quests.ts). 길드 의뢰가 테마를 따른다 */
  theme: string | null;
  schedule: ScheduledEvent[];
  fakeOmens: FakeOmen[];
  /** 이번 시즌에 일어난 사건 (반응 사건 포함) */
  log: EventRecord[];
}

/** 반응 사건을 위한 기억: 값이 며칠째 너무 낮거나 높은지, 같은 사건을 또 내지 않을 날 */
export interface ReactiveMemo {
  low: Record<string, number>;
  high: Record<string, number>;
  cooldown: Record<string, number>;
}
