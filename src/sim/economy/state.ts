// 경제 상태. 모두 단순한 데이터라 JSON으로 저장하고 서버로 보낼 수 있다.
import type { ActiveEvent, ReactiveMemo, SeasonState } from '../events/types';
import type { HeardRumor, RumorMill } from '../rumors/types';
import type { Horse, HorseKind, HorseMarket } from '../horses/types';
import type { CartType, ItemId } from '../cart';
import type { IncidentCause, RoadRisk } from './incidents';
import type { ApprenticeState, UnlockId } from '../apprentice/types';
import type { Certificate, SeasonRecord } from '../ranking/types';
import type { Rankings } from '../ranking/table';
import type { SeasonSettlement } from '../ranking/settle';
import type { Warehouse } from '../warehouse/warehouse';
import type { Hire, HireRole } from '../hire/hire';
import type { DrawRequest } from '../draws/draws';
import type { Reservation } from '../reservations/reservations';
import type { Caravan } from '../caravan/types';
import type { BankAccount } from '../bank/bank';
import type { OwnedWorkshop } from '../growth/workshop';
import type { NotifySettings } from '../notify/types';
import type { Season } from '../season';
import type { Cart } from '../cart';
import type { ExpeditionFlag, GearKind, TownEventKind } from '../expedition/types';
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
  /** 도시 공방의 재료와 만든 물건. 공방이 없는 마을은 null */
  workshop: Inventory | null;
  /** 신문에 실린 이 마을 사건 (원정 덱의 사건 카드를 부른다) */
  recentEvents: { kind: TownEventKind; day: number }[];
  /** 어젯밤 마구간이 말에게 먹인 곡물. 오늘 장날에 주민이 그만큼 사 온다 */
  stableGrain: number;
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
  /** 떠날 때 잰 길의 위험 (짐칸 손상, 0.1.2). NPC 상단과 예전 저장에는 없다 */
  risk?: RoadRisk;
  /** 배고픈 날로 늘어난 길 (하루가 차면 남은 날 +1, 0.1.2) */
  hunger?: number;
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
  /** 상단 말 (많아야 한 필). 싣는 양과 걸음이 달라진다 */
  horses: Horse[];
}

/** 플레이어가 아는 다른 마을 시세: 마지막으로 본 날짜와 함께 */
export interface PriceMemory {
  day: number;
  prices: Record<GoodId, number>;
  /** 그 전에 본 시세 (오르내림 표시용). 처음 보면 null */
  previous: Record<GoodId, number> | null;
}

export type LedgerEntry =
  /** by: 창고 짐이나 두 번째 행렬이 한 거래 (없으면 내가 직접). reserved: 예약 주문이 한 거래 (0.1.0) */
  | { day: number; kind: 'buy' | 'sell'; town: number; good: GoodId; qty: number; price: number; by?: 'store' | 'caravan'; reserved?: true }
  | { day: number; kind: 'travel'; from: number; to: number; days: number; fee: number }
  | { day: number; kind: 'spoil'; good: GoodId; qty: number }
  | { day: number; kind: 'eat'; good: GoodId; recovered: number }
  | { day: number; kind: 'inn'; town: number; fee: number; recovered: number }
  | { day: number; kind: 'discard'; good: ItemId; qty: number }
  /** 길 위 사건으로 짐칸 한 칸이 망가졌다 (0.1.2). 그 칸의 짐 조각은 잃었다 */
  | { day: number; kind: 'cartDamage'; cause: IncidentCause; lost: { good: ItemId; qty: number } | null; caravan: boolean }
  /** 길에서 식량을 먹었다 (모자란 양이 있으면 배고픈 날, 0.1.2) */
  | { day: number; kind: 'roadFood'; eaten: { good: ItemId; qty: number }[]; short: number; caravan?: boolean }
  /** 잡화점에서 여행 식량을 샀다 */
  | { day: number; kind: 'rations'; town: number; qty: number; price: number }
  /** 수레방에서 망가진 칸을 고쳤다 */
  | { day: number; kind: 'cartRepair'; town: number; cells: number; price: number }
  | { day: number; kind: 'expedition'; town: number; goods: { good: GoodId; qty: number }[]; leftBehind: number }
  | { day: number; kind: 'toll'; town: number; gold: number }
  /** 소식을 산 돈: 여관 술 한 잔, 전서구, 정보원 */
  | { day: number; kind: 'info'; what: 'drink' | 'pigeon' | 'informant' | 'newspaper'; town: number; fee: number }
  /** 말 사고팔기, 굶다 도망친 말 */
  | { day: number; kind: 'horse'; what: 'buy' | 'sell' | 'lost'; town: number; horse: HorseKind; price: number }
  /** 말 먹이: 마구간에서 먹였으면 fee, 길 위에서 수레 곡물을 먹였으면 fee 0 (town null) */
  | { day: number; kind: 'horseFeed'; town: number | null; qty: number; fee: number }
  | { day: number; kind: 'horseRest'; town: number; fee: number }
  /** 잡화점에서 장비를 샀거나 도구로 고쳤음 (고치면 price 0) */
  | { day: number; kind: 'gear'; what: 'buy' | 'repair'; town: number; gear: GearKind; price: number }
  /** 여관에서 안내인을 고용함 */
  | { day: number; kind: 'guide'; town: number; fee: number }
  /** 원정에서 일하고 받은 돈 (목장 일손) */
  | { day: number; kind: 'earn'; town: number; gold: number }
  /** 수레방에서 수레를 바꿈 (쓰던 수레를 쳐 준 값을 뺀 값) */
  | { day: number; kind: 'cart'; town: number; from: CartType; to: CartType; price: number }
  /** 두 번째 행렬: 꾸림(수레값), 풂(수레를 쳐 준 값은 fee가 음수), 떠남(여비), 도착 */
  /** form·disband의 rented: 빌린 수레 (0.0.9). rent: 밤마다 내는 빌린 값 */
  | { day: number; kind: 'caravan'; what: 'form' | 'disband' | 'travel' | 'arrive' | 'rent'; town: number; to?: number; fee: number; rented?: boolean }
  /** 추첨에서 떨어짐 (0.1.0): 말이나 게시판 일꾼을 사겠다고 신청했지만 뽑히지 않았다. 맡긴 돈은 돌려받았다 */
  | { day: number; kind: 'draw'; what: 'horse' | 'hire'; town: number; horse?: HorseKind; role?: HireRole }
  /** 고용: 데려옴, 하루 일당 합, 일당을 못 받아 떠남, 내보냄 */
  | { day: number; kind: 'hire'; what: 'hire' | 'wage' | 'quit' | 'dismiss'; role: HireRole | null; name: string | null; town: number; fee: number }
  /** 채집꾼이 그 마을 창고에 넣은 것 (창고가 없거나 차서 버린 양) */
  | { day: number; kind: 'gathered'; town: number; name: string; goods: { good: GoodId; qty: number }[]; lost: number }
  /** 창고: 빌리기와 보관료, 오래 밀려 짐을 거둬 감 */
  | { day: number; kind: 'warehouse'; what: 'rent' | 'seized'; town: number; fee: number; lost?: number };

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
  /** 이번 원정에만 붙은 상태 (무더위, 눈 덮인 길, 말에 싣는다 등) */
  flags: ExpeditionFlag[];
  /** 안내인과 함께 왔고 아직 나쁜 카드를 건너뛰지 않았나 */
  guide: boolean;
  /** 덱에 넣은 내 카드가 남겨진 날 (놓아 둔 덫) */
  markDays: Record<string, number>;
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

/** 플레이어 id. 로컬 게임은 'me'와 봇 id, 서버에서는 계정 id */
export type PlayerId = string;

export interface PlayerState {
  id: PlayerId;
  /** 세계에 들어온 차례 (0부터). 첫 플레이어는 한 사람 세계와 같은 난수를 쓴다 (playerSeed) */
  seq: number;
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
  /** 들은 이야기 수첩 (src/sim/rumors) */
  rumors: HeardRumor[];
  /** 오늘 여관에서 술 한 잔을 샀는지 (소문 1개 더, 하루 한 번) */
  drankToday: boolean;
  /** 날려 보낸 전서구. 장날이 끝나면 그 마을 시세를 갖고 온다 */
  pigeons: { town: number; day: number }[];
  /** 정보원을 심어 둔 마을 */
  informants: number[];
  /** 내 말 (많아야 2필) */
  horses: Horse[];
  /** 오늘 마구간에서 말을 쉬게 했는지 */
  horsesRested: boolean;
  /** 지난 원정에 남긴 카드 (놓아 둔 덫 등)와 남긴 날. 다음에 그 마을 원정 덱에 들어간다 */
  marks: { town: number; card: string; day: number }[];
  /** 여관에서 고용한 안내인이 다음 원정에 따라간다 */
  guide: boolean;
  /** 원정에서 도구를 쓴 횟수 (usesPerTool번 쓰면 도구 하나가 닳아 없어진다) */
  toolUses: number;
  /** 견습 중이면 지금 장면. 견습을 마쳤거나 건너뛰었으면 null */
  apprentice: ApprenticeState | null;
  /** 하나씩 열리는 것과 열린 날 (탭, 내가 아는 시세, 소문, 최소 가격 고치기 등) */
  unlocks: Partial<Record<UnlockId, number>>;
  /** 처음 시작한 마을 (견습 마을). 다른 마을에 처음 닿으면 시세 기억과 소문이 열린다 */
  homeTown: number;
  /** 마지막으로 신문을 읽은 날 */
  newsReadDay: number | null;
  /** 산 신문 (그 신문이 나온 장날). 산 날 신문은 전문을 계속 읽는다 (0.1.0) */
  newspapers: number[];
  /** 산 신문 중 읽은 것 (장날, 0.1.2 신문함의 안 읽음 표시) */
  papersRead: number[];
  /** 이번 시즌 기록 (랭킹 부문 점수, 길드 의뢰, 업적). 시즌이 시작되기 전이면 null */
  record: SeasonRecord | null;
  /** 상인 증서: 시즌이 바뀌어도 남는다 */
  certificate: Certificate;
  /** 빌린 창고 (마을마다 하나) */
  warehouses: Warehouse[];
  /** 고용한 일꾼 (짐꾼, 채집꾼, 마부) */
  hires: Hire[];
  /** 두 번째 행렬 (마부 + 말 + 수레). 없으면 null */
  caravan: Caravan | null;
  /** 은행 계좌 (도시 은행, 어느 도시에서나 같다). 이번 버전은 구조만 */
  bank: BankAccount;
  /** 가진 작업장 (염장소, 대장간). 이번 버전은 구조만 */
  workshops: OwnedWorkshop[];
  /** 알림 설정 (종류별 켜고 끄기, 하루 상한, 조용한 시간). 실제 푸시는 서버 버전에서 */
  notify: NotifySettings;
  /** 가 본 마을 (플레이어가 아는 것: 서버가 이 경계로 데이터를 보낸다) */
  visited: number[];
  /** 예약 주문 (0.1.0): 날마다 장날 신청으로 다시 들어가는 신청, 도착하면 팔기 */
  reservations: Reservation[];
}

/** 플레이어의 신청 (pid: 주인 플레이어) */
export type PlayerOwner =
  /** 플레이어. porter가 있으면 그 짐꾼 손수레 짐으로 팔고, 산 것도 그 수레에 싣는다 (내 수레에 다 안 들어갈 때, 0.0.6) */
  | { kind: 'player'; pid: PlayerId; porter?: number }
  /** 플레이어 창고: 그 마을 창고 짐으로 낸 팔기 신청 (내가 없어도 장날에 맞춰진다). 돈은 플레이어에게 */
  | { kind: 'store'; pid: PlayerId; town: number }
  /** 두 번째 행렬: 행렬 수레 짐으로 팔고, 내 돈으로 사서 행렬 수레에 싣는다 */
  | { kind: 'caravan'; pid: PlayerId };

export type OrderOwner =
  | PlayerOwner
  | { kind: 'worker'; id: number }
  | { kind: 'trader'; id: number }
  | { kind: 'citizens'; town: number }
  /** 도시 공방. 돈은 마을 금고를 쓴다 */
  | { kind: 'workshop'; town: number }
  /** 큰 주문 (0.0.7): 사건이 바깥 돈으로 사들인다. 산 물건은 바깥으로 나간다 */
  | { kind: 'buyer'; event: number };

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
  /** 예약 주문이 넣은 신청이면 그 예약 번호 */
  reservation?: number;
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
  /** 이 세계의 플레이어 (사람과 봇). 차례가 결과를 바꾸는 곳은 playerOrder로 날마다 섞는다 */
  players: Record<PlayerId, PlayerState>;
  /** 오늘 장날을 기다리는 플레이어 신청 */
  orders: Order[];
  /** 오늘 밤 추첨을 기다리는 신청 (말, 게시판 일꾼) */
  draws: DrawRequest[];
  news: NewsItem[];
  /** 이번 겨울 첫날의 일꾼 수 (겨울에 줄어드는 한도를 잰다). 겨울이 아니면 null */
  winterStartWorkers: number | null;
  /** 지금 시즌과 사건 일정. 세계를 미리 돌리는 동안은 null (사건 없음) */
  season: SeasonState | null;
  /** 벌어지고 있는 사건 */
  events: ActiveEvent[];
  /** 반응 사건을 위한 기억 */
  reactive: ReactiveMemo;
  /** 세계의 소문과 소문꾼 (플레이어에게 숨김) */
  rumorMill: RumorMill;
  /** 마구간 재고와 시즌 말 입고 일정 (남은 수는 그 마구간에 가야 보인다) */
  horses: HorseMarket;
  /** 장날마다 매긴 부문 순위 (0.1.0). 아직 장날이 없었으면 null */
  rankings: Rankings | null;
  /** 이번 시즌 결산 (시즌 마지막 장날 뒤). 다음 시즌이 열리면 null. 결산 뒤에는 명령을 받지 않는다 */
  settlement: SeasonSettlement | null;
}
