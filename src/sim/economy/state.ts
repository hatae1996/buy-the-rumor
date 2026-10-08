// 경제 상태. 모두 단순한 데이터라 JSON으로 저장하고 서버로 보낼 수 있다.
import type { Season } from '../season';
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
  | { day: number; kind: 'inn'; town: number; fee: number; recovered: number };

export interface PlayerState {
  gold: number;
  town: number;
  travel: Travel | null;
  cargo: Inventory;
  capacity: number;
  memory: Record<number, PriceMemory>;
  ledger: LedgerEntry[];
  /** 피로 0~max. 원정마다 쌓이고, 밤잠·음식·여관으로 준다 */
  fatigue: number;
  /** 원정 기회. 자원지가 있는 마을에 머무는 동안 하루 1개씩 쌓이고, 떠나면 사라진다 */
  expeditionChances: number;
  /** 오늘 먹은 끼니 수, 오늘 여관에서 쉬었는지 (날이 바뀌면 다시 센다) */
  mealsToday: number;
  restedToday: boolean;
}

export type OrderOwner =
  | { kind: 'player' }
  | { kind: 'worker'; id: number }
  | { kind: 'trader'; id: number }
  | { kind: 'citizens'; town: number };

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
}
