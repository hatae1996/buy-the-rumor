// 랭킹과 보상 데이터 모양 (기획서 "랭킹과 보상", 시안 prototypes/id-card.html).
// 이번 버전은 데이터 구조와 계산만. 화면, 서버, 시즌 결산은 멀티플레이 버전에서.
import type { GoodId } from '../economy/goods';
import type { ScheduledEventId } from '../events/types';
import type { Season } from '../season';
import type { TownTier } from '../worldgen';

/** 랭킹 부문 (확정): 큰손, 수완가, 한 방, Buy the Rumor, 물품왕(물품마다) */
export type CategoryId = 'bigShot' | 'multiplier' | 'oneShot' | 'buyTheRumor' | `goodsKing:${GoodId}`;

/** 이야기가 되는 순간 (업적 인장과 길드 의뢰가 센다). 반복 횟수로만 오르는 것은 두지 않는다 */
export type MomentId =
  /** 횃불로 곰을 쫓아냈다 */
  | 'bearTorch'
  /** 늑대 무리를 짐을 잃지 않고 지났다 */
  | 'wolfSafe'
  /** 말 덕분에 곰이나 늑대에게서 빠져나왔다 */
  | 'horseEscape'
  /** 얼어붙은 개울·항구에서 생선을 얻었다 */
  | 'iceFishing'
  /** 은빛 떼를 그물에 담았다 */
  | 'silverRun'
  /** 거센 파도에 배를 띄워 고기를 잡았다 */
  | 'stormSail'
  /** 놓아 둔 덫에 무언가 걸려 있었다 */
  | 'trapLuck'
  /** 처음 말을 샀다 */
  | 'firstHorse'
  /** 수첩에 "맞았다" 도장이 찍혔다 */
  | 'rumorRight';

/** 시즌 동안의 내 거래 한 줄 (Buy the Rumor와 한 방 계산) */
export interface TradeRecord {
  day: number;
  side: 'buy' | 'sell';
  town: number;
  good: GoodId;
  qty: number;
  price: number;
}

/** 시즌 기록: 시즌이 바뀌면 새로 센다 */
export interface SeasonRecord {
  season: number;
  /** 어느 시즌, 어느 세계의 기록인가 (0.1.3: 랭킹은 같은 시즌의 모든 세계를 합친다) */
  seasonId: string;
  worldId: string;
  /** 이 시즌에 들어온 날과 그때 순자산 (수완가 부문의 시작 자금) */
  joinedDay: number;
  startWorth: number;
  /** 시즌 동안 가장 낮았던 순자산 (오뚝이) */
  minWorth: number;
  trades: TradeRecord[];
  /** 들은 징조 소문: 어느 사건을, 어느 마을 일로, 언제 들었나 (Buy the Rumor) */
  heardOmens: { event: ScheduledEventId; town: number; day: number }[];
  moments: { id: MomentId; day: number }[];
}

export type BadgeKind = 'quest' | 'ranking' | 'achievement' | 'memorial';
export type Tier = 'bronze' | 'silver' | 'gold';

export interface BadgeDef {
  id: string;
  name: string;
  kind: BadgeKind;
  /** 얻는 조건 (화면에 보이는 말) */
  how: string;
  /** 숨김 업적 (얻기 전에는 ???) */
  hidden?: boolean;
}

/** 증서에 찍힌 인장 하나 */
export interface EarnedBadge {
  badge: string;
  /** 의뢰 인장의 동·은·금 */
  tier: Tier | null;
  season: number;
  day: number;
}

/** 길드 의뢰가 재는 것 */
export type QuestMeasure =
  /** 이 물품들을 판 양 (계절, 마을 규모를 정하면 그때·그곳만) */
  | { kind: 'sold'; goods: readonly GoodId[]; seasons?: readonly Season[]; tier?: TownTier }
  /** 이 순간이 몇 번 */
  | { kind: 'moment'; moment: MomentId };

export interface QuestDef {
  id: string;
  name: string;
  /** 개인 의뢰, 또는 서버 전체가 함께 채우는 공동 의뢰 */
  scope: 'personal' | 'communal';
  text: string;
  measure: QuestMeasure;
  /** 동, 은, 금 문턱. 공동 의뢰는 서버 전체 합 (로컬에서는 내 기여만 센다) */
  tiers: readonly [number, number, number];
}

export interface ThemeDef {
  id: string;
  name: string;
  /** 이 테마가 잘 어울리는 시작 계절 (없으면 언제나) */
  seasons?: readonly Season[];
  /** 이 자원지가 있는 맵에서만 */
  needs?: 'fish' | 'field' | 'ore';
  quests: readonly QuestDef[];
}

/** 상인 증서 (ID카드). 순자산 숫자는 담지 않는다 (정보 게임이므로) */
export interface Certificate {
  /** 상단 이름, 문장(깃발) */
  name: string;
  crest: string;
  /** 시작 출신 (나중에 해금). 없으면 null */
  origin: string | null;
  /** 완주한 시즌 수 (상인 연차). 오르면 증서 종이가 바뀐다 */
  seasonsCompleted: number;
  /** 대표 칭호 ("3시즌 소금왕"). 없으면 null */
  title: string | null;
  titles: string[];
  /** 모은 인장 (인장첩) */
  badges: EarnedBadge[];
  /** 앞면에 달고 다니는 인장 (인장첩 줄 번호, 많아야 4개) */
  pinned: number[];
  /** 지난 시즌 기록 (큰손 최고 순위 등은 서버가 채운다) */
  bestBigShotRank: number | null;
}
