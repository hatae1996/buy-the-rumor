// 경제 상태. 모두 단순한 데이터라 JSON으로 저장하고 서버로 보낼 수 있다.
import type { Season } from '../season';
import type { Cart } from '../cart';
import type { TownEventKind } from '../expedition/types';
import type { ResourceKind, TownTier } from '../worldgen';
import type { GoodId } from './goods';
import type { Inventory, Lot } from './inventory';
import type { JobId } from './jobs';

export interface ResourceNode {
  kind: ResourceKind;
  /** 마을 주변 두 칸 안의 그 자원지 칸 수 */
  tiles: number;
  amount: number;
  capacity: number;
}

/** 하루 장날 결과 (물품 하나) */
export interface MarketResult {
  price: number | null;
  volume: number;
  /** 신청된 전체 양 */
  demand: number;
  supply: number;
  bestBid: number | null;
  bestAsk: number | null;
  /** 정산 가격에서 모자란 양(+) 또는 남는 양(−) */
  imbalance: number;
}

export interface TownEconomy {
  /** WorldMap.towns의 id */
  id: number;
  /** 마을 규모 (맵에서 그대로) */
  tier: TownTier;
  nodes: ResourceNode[];
  /** 기준 시세. 정산 가격을 따라 천천히 움직인다 */
  refPrice: Record<GoodId, number>;
  lastMarket: Record<GoodId, MarketResult>;
  treasury: number;
  /** 폭풍으로 고기잡이를 못 하는 남은 날 */
  storm: number;
  boosts: { good: GoodId; factor: number; daysLeft: number }[];
  /** 도시 공방의 재료와 만든 물건. 공방이 없는 마을은 null */
  workshop: Inventory | null;
  /** 신문에 실린 이 마을 사건 (원정 덱의 사건 카드를 부른다) */
  recentEvents: { kind: TownEventKind; day: number }[];
}

export interface Worker {
  id: number;
  town: number;
  job: JobId;
  gold: number;
  inv: Inventory;
  /** 도구가 버티는 남은 날. 0이면 맨손 */
  tool: number;
  /** 연달아 굶은 날 */
  hunger: number;
  /** 최근 실제로 번 하루 값 (만든 물건을 기준 시세로 친 값의 평균). 일을 바꿀지 따질 때 쓴다 */
  income: number;
  /** 지금 일을 한 날 수 */
  jobDays: number;
  /** 겨울 일을 하는 동안 봄에 돌아갈 원래 일. 아니면 null */
  homeJob: JobId | null;
}

export interface Travel {
  from: number;
  to: number;
  /** 전체 걸리는 날과 남은 날 */
  days: number;
  daysLeft: number;
}

export interface Trader {
  id: number;
  name: string;
  town: number;
  gold: number;
  inv: Inventory;
  travel: Travel | null;
  /** 사서 어디로 가져갈지 */
  plan: { good: GoodId; to: number } | null;
  /** 짐을 못 팔고 머문 날 */
  stuckDays: number;
}

/** 플레이어가 아는 다른 마을 시세: 마지막으로 본 날짜와 함께 */
export interface PriceMemory {
  day: number;
  prices: Record<GoodId, number>;
  /** 그 전에 본 시세 (오르내림 표시용). 처음 보면 null */
  previous: Record<GoodId, number> | null;
}

export type LedgerEntry =
  | { day: number; kind: 'buy' | 'sell'; town: number; good: GoodId; qty: number; price: number }
  | { day: number; kind: 'travel'; from: number; to: number; days: number; fee: number }
  | { day: number; kind: 'spoil'; good: GoodId; qty: number }
  | { day: number; kind: 'eat'; good: GoodId; recovered: number }
  | { day: number; kind: 'inn'; town: number; fee: number; recovered: number }
  | { day: number; kind: 'discard'; good: GoodId; qty: number }
  | { day: number; kind: 'expedition'; town: number; goods: { good: GoodId; qty: number }[]; leftBehind: number }
  | { day: number; kind: 'toll'; town: number; gold: number };

/** 들은 이야기 수첩 한 줄 */
export interface Rumor {
  day: number;
  town: number;
  text: string;
}

/** 진행 중인 원정 */
export interface ActiveExpedition {
  town: number;
  /** 이 원정의 난수 상태 (서버가 같은 결과를 다시 낼 수 있게) */
  rng: number;
  /** 남은 덱 (맨 앞이 다음 카드) */
  deck: string[];
  /** 지금 펼친 카드 */
  card: string;
  /** 지금 카드를 빼고 더 볼 카드 수 */
  left: number;
  haul: { good: GoodId; qty: number }[];
  rumors: string[];
  log: ExpeditionLogLine[];
}

export interface ExpeditionLogLine {
  title: string;
  choice: string;
  /** 확률이 있던 선택이면 성공했는지 */
  outcome: 'success' | 'failure' | null;
  text: string;
}

/** 끝난 원정 결과 (화면이 요약을 보여 준다) */
export interface ExpeditionResult {
  day: number;
  town: number;
  loaded: { good: GoodId; qty: number }[];
  /** 수레에 자리가 없어 두고 온 것 */
  leftBehind: { good: GoodId; qty: number }[];
  rumors: string[];
  log: ExpeditionLogLine[];
}

export interface PlayerState {
  gold: number;
  town: number;
  travel: Travel | null;
  /** 짐은 수레 칸에 싣는다 (기획서 "수레 인벤토리") */
  cart: Cart;
  memory: Record<number, PriceMemory>;
  ledger: LedgerEntry[];
  /** 피로 0~max. 원정마다 쌓이고, 밤잠·음식·여관으로 준다 */
  fatigue: number;
  /** 원정 기회. 자원지가 있는 마을에 머무는 동안 하루 1개씩 쌓이고, 떠나면 사라진다 */
  expeditionChances: number;
  /** 오늘 먹은 끼니 수, 오늘 여관에서 쉬었는지 (날이 바뀌면 다시 센다) */
  mealsToday: number;
  restedToday: boolean;
  expedition: ActiveExpedition | null;
  lastExpedition: ExpeditionResult | null;
  /** 들은 이야기 수첩 */
  rumors: Rumor[];
  /** 지난 원정에 남긴 카드 (놓아 둔 덫 등). 다음에 그 마을 원정 덱에 들어간다 */
  marks: { town: number; card: string }[];
}

export type OrderOwner =
  | { kind: 'player' }
  | { kind: 'worker'; id: number }
  | { kind: 'trader'; id: number }
  | { kind: 'citizens'; town: number }
  /** 도시 공방. 돈은 마을 금고를 쓴다 */
  | { kind: 'workshop'; town: number };

/** 장날 신청. 낼 때 돈(사자)이나 물건(팔자)을 맡겨 두고, 정산 뒤 남은 것을 돌려준다 */
export interface Order {
  id: number;
  town: number;
  good: GoodId;
  side: 'buy' | 'sell';
  qty: number;
  limit: number;
  owner: OrderOwner;
  /** 사자: 맡긴 돈 (qty × limit) */
  reserved: number;
  /** 팔자: 맡긴 물건 */
  lots: Lot[];
}

export interface NewsItem {
  day: number;
  text: string;
}

export interface EconomyState {
  version: 1;
  seed: number;
  /** 오늘 (1부터). 플레이어 신청은 오늘 장날에 정산된다 */
  day: number;
  startSeason: Season;
  /** 난수 상태. 하루를 돌릴 때 이어서 쓴다 */
  rng: number;
  nextId: number;
  towns: TownEconomy[];
  workers: Worker[];
  traders: Trader[];
  player: PlayerState;
  /** 오늘 장날을 기다리는 플레이어 신청 */
  orders: Order[];
  news: NewsItem[];
  /** 이번 겨울 첫날의 일꾼 수 (겨울에 줄어드는 한도를 잰다). 겨울이 아니면 null */
  winterStartWorkers: number | null;
}
