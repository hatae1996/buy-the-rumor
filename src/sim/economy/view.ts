// 플레이어에게 보이는 것만 골라 낸다. 화면은 실제 상태(EconomyState) 대신 이것만 그린다.
// 지금 있는 마을 시세만 정확히 알고, 다른 마을은 날짜가 붙은 기억으로만 안다.
import { foodPerDay, myFood, rationPrice } from './food';
import { repairCost } from './incidents';
import { boardStack, CART_TYPES, cartCount, cartLots, cartWeight, isGear, pieceCells, roomFor, unitWeight, usedCells, type Board, type Cart, type CartType, type ItemId, type ItemLot } from '../cart';
import { boardFee, WAREHOUSE_CELLS } from '../warehouse/fee';
import {
  buyPrice,
  cartCost,
  feedPrice,
  HORSE_KINDS,
  horseDays,
  horsePull,
  horsesNeeded,
  maxWeight,
  sellPrice,
  stableAt,
  type Horse,
  type HorseKind,
  horseLooks,
  type CoatId,
  type MarkingId,
} from '../horses';
import { townTravelDays, type WorldMap } from '../worldgen';
import { playerTravelDays } from './travel';
import { buildingAlerts, buildingDef, hasBuilding, townBuildings, type BuildingId } from '../growth/buildings';
import { hireBoard, porterBuyRoom, porters, restWage, wageToday, type HireOffer, type HireRole } from '../hire';
import type { CaravanPlan } from '../caravan';
import type { NotifySettings } from '../notify';
import { badgeDef, CATEGORIES, categoryName, certificateView, questProgress, questTier, themeDef, type CategoryId, type CertificateView, type RankTable, type SeasonReport, type Standing } from '../ranking';
import { regionTag } from '../worldgen';
import { JOB_NAME } from './jobs';
import { apprenticeGuestOf, SCENES, sceneDef, type ApprenticeGuest, type SceneId, type UnlockId } from '../apprentice';
import { CART, ECONOMY, GROWTH, HORSES, RUMORS } from '../constants';
import { CYCLE_DAYS, seasonOfDay, type Season } from '../season';
import { hasExpeditions, innOf } from './player';
import { GOOD_NAME, GOODS, type GoodId } from './goods';
import { sellableCount, totalCount, type Lot } from './inventory';
import { euro, iGa } from '../josa';
import { cardById, chanceOf, choiceFatigue, GEAR_KINDS, gearUses, guideFee, needsMet, type GearKind } from '../expedition';
import { bigOrdersToday, blockedTiles, eventDef, tollAt, type ScheduledEventId } from '../events';
import type {
  ActiveExpedition,
  EconomyState,
  ExpeditionResult,
  LedgerEntry,
  MarketResult,
  NewsItem,
  Order,
  PlayerId,
  PlayerState,
  PriceMemory,
} from './state';
import { drinkFee, freshGossip, type HeardRumor } from '../rumors';
import { drawsOf } from '../draws';
import { paperDelay, paperFree, paperHeadline, paperOnSale, papersOnSale, visibleNews } from '../news';
import type { Reservation } from '../reservations';
import { getPlayer, ownedBy, playerList } from './players';

export type PlayerLocation =
  | { kind: 'town'; town: number }
  | { kind: 'road'; from: number; to: number; days: number; daysLeft: number };

export interface MarketView {
  town: number;
  /** 오늘 기준 시세 (반올림) */
  price: Record<GoodId, number>;
  /** 전에 본 시세. 처음 온 마을이면 null */
  previous: Record<GoodId, number> | null;
  /** 어제 장날 결과: 정산 가격, 거래량, 사려는 양과 팔려는 양 */
  yesterday: Record<GoodId, MarketResult>;
}

export interface PendingOrder {
  id: number;
  good: GoodId;
  side: 'buy' | 'sell';
  qty: number;
  limit: number;
  /** 어느 마을 장날에 */
  town: number;
  /** 수레 짐이면 cart, 그 마을 창고 짐이면 store */
  from: 'cart' | 'store';
}

export interface RankingCategoryView {
  id: CategoryId;
  name: string;
  /** 시즌 전체 1~3위 (같은 점수는 같은 순위, 사람만). mine: 내 세계 상단이면 true (다른 세계 상단은 증서를 열 수 없다) */
  top: { id: PlayerId; name: string; rank: number; mine: boolean; bot: boolean }[];
  /** 내 세계 1~3위 (봇 포함, 0.2.0). 모두 내 세계 상단이라 증서를 열 수 있다 */
  worldTop: { id: PlayerId; name: string; rank: number; mine: true; bot: boolean }[];
  /** 시즌 전체에서 내 순위. 이 부문에 아직 기록이 없으면 null */
  mine: { rank: number; topShare: number; score: number } | null;
  /** 시즌 전체에서 이 부문에 오른 상단 수 */
  count: number;
  /** 내 세계 순위 (0.1.3). 로컬은 세계가 하나라 시즌 전체와 같다 */
  world: { mine: { rank: number; topShare: number } | null; count: number };
}

export interface RankingView {
  /** 순위를 매긴 장날. 아직 없으면 null */
  day: number | null;
  categories: RankingCategoryView[];
}

export interface SettlementView {
  season: number;
  categories: RankingCategoryView[];
  report: SeasonReport | null;
  /** 새로 받은 인장 이름과 칭호 */
  badges: string[];
  titles: string[];
}

export interface DrawView {
  id: number;
  kind: 'horse' | 'hire';
  town: number;
  /** 말 종류나 일꾼 자리 */
  horse: HorseKind | null;
  role: HireRole | null;
  /** 말 이름, 일꾼 자리 이름 */
  name: string;
  /** 맡긴 돈 (떨어지면 돌려받는다) */
  reserved: number;
}

export interface HireView {
  id: number;
  role: HireRole;
  roleName: string;
  name: string;
  jobName: string;
  town: number;
  /** 일하는 날 일당 */
  wage: number;
  /** 마부가 쉬는 날 일당 (0.0.9). 다른 일꾼은 null */
  restWage: number | null;
  /** 오늘 밤 줄 일당 */
  wageToday: number;
  /** 짐꾼 손수레 (아니면 null) */
  board: { rows: readonly string[]; pieces: CartPieceView[]; weight: number; maxWeight: number } | null;
}

export interface CaravanView {
  carter: string | null;
  horses: HorseView[];
  cart: { type: CartType; name: string; rows: readonly string[]; pieces: CartPieceView[]; weight: number; maxWeight: number };
  town: number;
  travel: { from: number; to: number; daysLeft: number } | null;
  plan: CaravanPlan | null;
  stop: number;
  recalled: boolean;
  /** 내가 있는 마을에 와 있어 짐을 주고받을 수 있나 */
  here: boolean;
  /** 빌린 수레 (0.0.9): 하루 값과 밀린 값. 산 수레면 null */
  rent: { perDay: number; owed: number } | null;
}

export interface WarehouseView {
  town: number;
  name: string;
  rows: readonly string[];
  pieces: CartPieceView[];
  /** 짐 수 */
  count: number;
  /** 밀린 보관료 (밀리면 꺼내거나 팔 수 없다) */
  owed: number;
  /** 오늘 밤 보관료 (짐이 차지한 칸 수만큼, 0.0.8) */
  fee: number;
  /** 짐이 차지한 칸 / 창고 칸 */
  usedCells: number;
  cells: number;
  /** 물품마다 더 넣을 수 있는 양 (창고는 수레보다 높이 쌓는다) */
  room: Record<GoodId, number>;
  /** 물품마다 장에 낼 수 있는 양 (내일이면 상할 묶음은 빼고) */
  sellable: Record<GoodId, number>;
}

export interface PlayerView {
  /** 오늘 (이날 장날에 신청이 정산된다) */
  day: number;
  season: Season;
  /** 이 계절(봄·여름·가을·겨울)이 오늘 뒤로 며칠 더 가나 */
  seasonDaysLeft: number;
  gold: number;
  /** 사자 신청과 말·일꾼 추첨 신청에 맡겨 둔 돈 */
  reserved: number;
  /** 수레에 실린 물건 (묶음 목록) */
  cargo: readonly Lot[];
  /** 내 행렬 전체 짐 (내 수레 + 짐꾼 수레). 장에 낼 수 있는 짐 (0.0.6: 짐꾼 수레 짐도 장에 낸다) */
  haul: readonly Lot[];
  /** 장에서 사서 더 실을 수 있는 양: 내 수레(칸과 끄는 무게) + 짐꾼 수레 */
  buyRoom: Record<GoodId, number>;
  /** 짐 + 팔자 신청에 맡긴 물건 */
  cargoCount: number;
  cart: CartView;
  location: PlayerLocation;
  /** 길 위면 null */
  market: MarketView | null;
  /** 지금 마을의 큰 주문 (0.0.7). 남은 양은 그 마을에 와야 보인다 */
  bigOrders: { event: string; good: GoodId; left: number; price: number; until: number }[];
  orders: PendingOrder[];
  /** 오늘 밤 추첨을 기다리는 내 신청 (말, 게시판 일꾼). 남이 낸 신청은 보이지 않는다 */
  draws: DrawView[];
  /** 예약 주문 (0.1.0): 여러 날 가는 신청(남은 양, 마감 날), 도착하면 팔기 */
  reservations: Reservation[];
  /** 랭킹 (장날마다 갱신, 0.1.0): 부문마다 1~3위 이름과 내 순위. 남의 점수(순자산)는 보이지 않는다 */
  ranking: RankingView;
  /** 이번 시즌 결산 (시즌 마지막 장날 뒤). 끝난 시즌 순위, 내 리포트, 새로 받은 인장과 칭호 */
  settlement: SettlementView | null;
  /** 이 세계 상단들의 증서 (남에게 보이는 증서라 순자산이 없다). 이름을 누르면 본다. bot: 봇 상단("떠돌이", 0.2.0) */
  certificates: Record<PlayerId, CertificateView & { bot: boolean }>;
  /** 같은 세계의 다른 상단: 이름과 있는 곳만 (지도에 말로 보인다, 0.1.0). bot: 봇 상단("떠돌이", 0.2.0) */
  rivals: { id: PlayerId; name: string; bot: boolean; location: PlayerLocation }[];
  memory: Readonly<Record<number, PriceMemory>>;
  ledger: readonly LedgerEntry[];
  /** 신문: 산 신문의 기사만 (0.1.2) */
  news: readonly NewsItem[];
  newspaper: {
    fee: number;
    /** 견습 동안은 무료 */
    free: boolean;
    /** 산 신문 (장날, 새것부터)과 읽었는지 */
    papers: { day: number; headline: string; read: boolean }[];
    /** 지금 마을 신문팔이가 파는 오늘 신문의 날짜 (아직 신문이 없거나 길 위면 null)와 샀는지, 하루 늦은 신문이 오는 마을인지 */
    onSale: { day: number; bought: boolean } | null;
    /** 지난 신문 (0.1.3): 오늘 신문 앞 며칠 치, 새것부터. 값은 backFee */
    back: { day: number; fee: number; bought: boolean }[];
    backFee: number;
    late: boolean;
  };
  fatigue: number;
  fatigueMax: number;
  /** 많이 지쳐서 원정 결과가 나빠지는 상태 */
  tired: boolean;
  expeditionChances: number;
  /** 지금 마을에서 원정을 나갈 수 있나 (자원지가 있는 마을, 길 위가 아님) */
  canExpedition: boolean;
  mealsLeft: number;
  /** 지금 마을 여관. 길 위면 null */
  inn: { fee: number; recovery: number; rested: boolean } | null;
  /** 진행 중인 원정 */
  expedition: ExpeditionView | null;
  lastExpedition: ExpeditionResult | null;
  /** 들은 이야기 수첩. 도장 판정용 주장은 빼고 보인다 */
  rumors: readonly NoteView[];
  /** 여관에서 들었지만 아직 수첩에 적지 않은 이야기 (적기 / 흘려듣기, 며칠 뒤 사라진다, 0.1.2) */
  recentHeard: readonly NoteView[];
  /** 이 마을 여관 소문꾼: 오늘 들을 수 있나, 아직 못 들은 이야기 수. 길 위면 null */
  gossip: { canListen: boolean; fresh: number } | null;
  /** 지금 마을 여관의 술 한 잔 (소문 1개 더). 길 위면 null */
  drink: { fee: number; drank: boolean } | null;
  /** 전서구: 한 번 값과 날려 보낸 마을 (다음 날 시세가 온다) */
  pigeon: { fee: number; pending: number[] };
  /** 정보원을 심어 둔 마을 */
  informants: readonly number[];
  /** 몇 번째 시즌, 시즌의 며칠째, 시즌 길이 (미리 돌린 세계 전에는 null) */
  seasonInfo: { number: number; day: number; length: number } | null;
  /** 길 사정 (신문에 실린 사실): 막힌 칸, 마을마다 통행세 */
  roads: { blocked: number[]; tolls: Record<number, number> };
  /** 지금 마을(길 위면 떠난 마을)에서 마을마다 걸리는 날. usual은 막힌 길이 없을 때 (말 걸음 포함) */
  travel: { days: number[]; usual: number[] };
  /** 내 말 */
  horses: HorseView[];
  /** 지금 마을 마구간에서 하는 일: 먹이 값, 쉬게 하기. 길 위면 null */
  horseCare: { feedPrice: number; restFee: number; rested: boolean } | null;
  /** 목장 마을 마구간 (남은 수는 여기 와야만 보인다). 마구간이 없는 마을이나 길 위면 null */
  stable: StableView | null;
  /** 수레방: 수레마다 바꾸는 값 (쓰던 수레를 쳐 준 뒤). 수레방이 없는 마을이나 길 위면 빈 목록 */
  carts: CartOffer[];
  /** 빌린 창고 (마을마다 하나) */
  warehouses: WarehouseView[];
  /** 고용한 일꾼 (짐꾼은 손수레를 끈다) */
  hires: HireView[];
  /** 지금 마을 여관 고용 게시판 (짐꾼, 채집꾼, 마부). 정보원은 informant */
  hireBoard: HireOffer[];
  /** 두 번째 행렬. 없으면 null */
  caravan: CaravanView | null;
  /** 가 본 마을 */
  visited: readonly number[];
  /** 가 본 마을에 있는 건물 (지도 마을 카드) */
  knownBuildings: Record<number, { id: BuildingId; name: string }[]>;
  /** 마을마다 들은 특색 (수첩의 특색 소문에서. 맞았다 도장이 찍혔으면 확인) */
  knownTraits: Record<number, { name: string; confirmed: boolean }[]>;
  /** 하루 유지비: 일당, 정보원, 말 먹이(지금 마을 값으로 어림), 창고 보관료 */
  upkeep: { total: number; parts: { what: string; perDay: number }[] };
  /** 길드: 이번 시즌 테마와 의뢰 진행 (테마는 보류 중이라 참고용) */
  /** 길드 의뢰: 테마(번호와 이름)와 의뢰들. goods는 납품 의뢰의 물품 (그림용, 0.1.6) */
  guild: {
    themeId: string | null;
    theme: string | null;
    quests: { id: string; name: string; scope: 'personal' | 'communal'; text: string; value: number; tiers: readonly number[]; tier: string | null; goods: GoodId[] }[];
  };
  /** 상인 증서 (순자산은 없다) */
  certificate: CertificateView;
  /** 내가 얻은 칭호 (대표 칭호로 고를 수 있다) */
  titles: string[];
  /** 내 인장첩: 모은 인장 전부 (숨김 업적은 얻은 것만 보인다) */
  badgeBook: { name: string; kind: string; tier: 'bronze' | 'silver' | 'gold' | null; season: number; day: number }[];
  /** 알림 설정. askNow: 견습 졸업이라 알림 허락을 물을 때 */
  notify: NotifySettings & { askNow: boolean };
  /** 은행 계좌 (도시에만 은행이 있다. 이번 버전은 보기만) */
  bank: { deposit: number; loan: number; depositRate: number; loanRate: number };
  /** 정보원 일당 (여관 게시판), 지금 마을에 이미 있나 */
  informant: { wage: number; here: boolean } | null;
  /** 지금 마을 건물 (화면 차례대로)과 할 일 도장(!). 길 위면 빈 목록 */
  buildings: { id: BuildingId; name: string; alert: string | null }[];
  /** 내 장비와 잡화점 (어느 마을이나). 길 위면 살 수 없다 */
  gear: GearView[];
  /** 수레에 실은 도구 수 (원정에서 나무 베기·광석 캐기에 쓰고, 장비를 고친다) */
  tools: number;
  /**
   * 길의 식량 (0.1.2): 내 수레·짐꾼 수레에 실린 식량, 내 행렬이 하루에 먹는 양,
   * 이 마을 잡화점 여행 식량 값(마을에 있을 때), 여행 식량을 더 실을 수 있는 수
   */
  food: { have: number; perDay: number; rationPrice: number | null; rationRoom: number };
  /** 지금 쓰는 도구가 원정 선택지를 몇 번 더 버티나 (도구가 없으면 0) */
  toolUsesLeft: number;
  /** 여관 안내인: 고용 값과 고용했는지. 원정을 못 나가는 마을이나 길 위면 null */
  guide: { fee: number; hired: boolean } | null;
  /** 견습 중이면 지금 장면 (기획서 "첫 5분의 흐름"). 아니면 null */
  apprentice: ApprenticeView | null;
  /** 졸업하고 가는 마을의 견습 손님 (내게 한 약속이라 나만 안다, 0.2.1). 화면은 그 마을 첫 장날의 추천 최소 가격을 이 값 이하로 */
  apprenticeGuest: ApprenticeGuest | null;
  /** 열린 것 (탭, 내가 아는 시세, 소문, 최소 가격 고치기, 말과 큰 수레 등) */
  unlocks: readonly UnlockId[];
  /** 마지막으로 신문을 읽은 날 */
  newsReadDay: number | null;
}

export interface HorseKindInfo {
  kind: HorseKind;
  name: string;
  pull: number;
  /** 이동 일수 배율 (1이 사람 걸음) */
  speed: number;
  feed: number;
}

export interface HorseView extends HorseKindInfo {
  id: number;
  fatigue: number;
  fatigueMax: number;
  /** 많이 지쳐 빨리 달리지 못한다 */
  tired: boolean;
  /** 연달아 굶은 날 */
  hungry: number;
  /** 지금 끄는 무게 (다 지치면 절반) */
  pulling: number;
  /** 이 마을 마구간에 되팔 값. 마구간이 없으면 null */
  sellPrice: number | null;
  /** 털색, 무늬, 이름 (0.1.7, 말마다 시드로) */
  coat: CoatId;
  marking: MarkingId;
  horseName: string;
  /** 플레이어가 지어 준 이름인가 */
  named: boolean;
}

export interface StableView {
  town: number;
  horses: (HorseKindInfo & { stock: number; price: number | null })[];
}

export interface CartOffer {
  type: CartType;
  name: string;
  rows: readonly string[];
  /** 말 없이 끌 수 있는 무게 (짐수레·마차는 0) */
  humanPull: number;
  horses: number;
  /** 지금 수레를 쳐 주고 내는 값. 지금 수레면 null */
  cost: number | null;
  /** 두 번째 행렬 수레로 빌리는 하루 값 (0.0.9). 빌릴 수 없으면 null */
  rentPerDay: number | null;
}

const kindInfo = (kind: HorseKind): HorseKindInfo => {
  const k = HORSES.kinds[kind];
  return { kind, name: k.name, pull: k.pull, speed: k.speed, feed: k.feed };
};

function horseView(state: EconomyState, h: Horse, stable: ReturnType<typeof stableAt>): HorseView {
  const looks = horseLooks(state, h);
  return {
    ...kindInfo(h.kind),
    coat: looks.coat,
    marking: looks.marking,
    horseName: looks.name,
    named: looks.named,
    id: h.id,
    fatigue: h.fatigue,
    fatigueMax: HORSES.fatigue.max,
    tired: h.fatigue >= HORSES.fatigue.tiredAt,
    hungry: h.hungry,
    pulling: horsePull(h),
    sellPrice: stable ? sellPrice(stable, h.kind) : null,
  };
}

export interface ApprenticeView {
  scene: SceneId;
  /** 몇 번째 장면 (1부터), 모두 몇 장면 */
  step: number;
  steps: number;
  title: string;
  /** 노상인 한두 줄 */
  hint: string;
  /** 졸업하고 갈 마을 */
  destination: number;
}

export interface GearView {
  kind: GearKind;
  name: string;
  price: number;
  /** 남은 쓰는 횟수. 안 가졌으면 null, 0이면 망가짐 */
  uses: number | null;
  maxUses: number;
}

export type NoteView = Omit<HeardRumor, 'claim' | 'rumor'> & {
  /** 징조 소문이면 문장이 말하는 사건과 마을 ("○○ 쪽에서 조선소에 목수가 모인다더군"). 플레이어가 읽는 그대로다 */
  omen: { event: ScheduledEventId; town: number } | null;
  /** 문장이 말하는 물품 (수첩 물품별 찾기, 0.1.2). 시세·신청 소문과, 물품을 고른 징조 */
  good: GoodId | null;
  /** 문장이 말하는 마을 (수첩 카드 제목, 0.1.6). 문장에 이미 나오는 마을이다. 확인할 주장이 없으면 null */
  about: number | null;
};

/** 수첩 한 줄을 화면용으로: 도장 판정용 주장과 세계 소문 번호는 뺀다 */
export function noteView({ claim, rumor: _rumor, ...rest }: HeardRumor): NoteView {
  const good = claim?.kind === 'price' || claim?.kind === 'orders' ? claim.good : claim?.kind === 'omen' ? (eventDef(claim.event).goods?.[0] ?? null) : null;
  return { ...rest, omen: claim?.kind === 'omen' ? { event: claim.event, town: claim.town } : null, good, about: claim?.town ?? null };
}

export interface ExpeditionChoiceView {
  /** 명령에 보낼 번호 (chooseExpeditionCard) */
  index: number;
  label: string;
  /** 결과는 대략만 보인다: "피로 +3 · 성공 가능성 높음 · 도구 1개" */
  hint: string;
  /** 고를 수 없는 까닭 (도구가 없음). 고를 수 있으면 null */
  disabled: string | null;
  /** 장비나 말이 연 선택지 */
  extra: boolean;
}

export interface ExpeditionView {
  town: number;
  card: {
    id: string;
    title: string;
    text: string;
    /** 장비나 말이 없어 열리지 않은 선택지는 빠진다. 앞의 둘이 왼쪽·오른쪽 */
    choices: ExpeditionChoiceView[];
  };
  /** 이번 원정에 붙은 상태 (무더위, 눈 덮인 길 등) */
  flags: string[];
  /** 안내인이 아직 따라오고 있나 */
  guide: boolean;
  /** 지금 카드 뒤에 남은 장 수 (연결 카드가 끼면 늘 수 있다) */
  left: number;
  haul: { good: GoodId; qty: number }[];
}

/** 수첩의 특색 소문 → 마을마다 들은 특색 */
function knownTraits(p: PlayerState): Record<number, { name: string; confirmed: boolean }[]> {
  const out: Record<number, { name: string; confirmed: boolean }[]> = {};
  for (const h of p.rumors) {
    const c = h.claim;
    if (!c || c.kind !== 'trait' || h.stamp === 'wrong') continue;
    const list = (out[c.town] ??= []);
    const name = regionTag(c.tag).name;
    const same = list.find((x) => x.name === name);
    if (same) same.confirmed ||= h.stamp === 'right';
    else list.push({ name, confirmed: h.stamp === 'right' });
  }
  return out;
}

/** 하루 유지비 (일당, 빌린 수레, 정보원, 말 먹이 어림, 창고 보관료) */
export function upkeepView(state: EconomyState, p: PlayerState): PlayerView['upkeep'] {
  const parts: { what: string; perDay: number }[] = [];
  // 마부는 쉬는 날 적게 받는다 (0.0.9): 오늘 밤 줄 일당으로 센다
  const wages = p.hires.reduce((s, h) => s + wageToday(state, p, h), 0);
  if (wages) parts.push({ what: '일꾼 일당', perDay: wages });
  if (p.caravan?.rent) parts.push({ what: '빌린 수레', perDay: p.caravan.rent.perDay });
  if (p.informants.length) parts.push({ what: '정보원', perDay: p.informants.length * GROWTH.hire.informant.wage });
  const horses = [...p.horses, ...(p.caravan?.horses ?? [])];
  const feedTown = p.travel ? p.travel.to : p.town;
  const feed = Math.round(horses.reduce((s, h) => s + HORSES.kinds[h.kind].feed, 0) * feedPrice(state, feedTown));
  if (feed) parts.push({ what: '말 먹이 (어림)', perDay: feed });
  const storage = p.warehouses.reduce((s, w) => s + boardFee(w.board), 0);
  if (storage) parts.push({ what: '창고 보관료', perDay: storage });
  return { total: parts.reduce((s, x) => s + x.perDay, 0), parts };
}

function guildView(state: EconomyState, p: PlayerState): PlayerView['guild'] {
  const theme = themeDef(state.season?.theme ?? '');
  return {
    themeId: theme?.id ?? null,
    theme: theme?.name ?? null,
    quests: (theme?.quests ?? []).map((q) => {
      const value = questProgress(state, p, q);
      const goods = q.measure.kind === 'sold' ? [...q.measure.goods] : [];
      return { id: q.id, name: q.name, scope: q.scope, text: q.text, value, tiers: q.tiers, tier: questTier(q, value), goods };
    }),
  };
}

function caravanView(state: EconomyState, p: PlayerState): CaravanView | null {
  const c = p.caravan;
  if (!c) return null;
  return {
    carter: p.hires.find((h) => h.id === c.carter)?.name ?? null,
    horses: c.horses.map((h) => horseView(state, h, null)),
    cart: {
      type: c.cart.type,
      name: CART.types[c.cart.type].name,
      rows: CART.types[c.cart.type].rows,
      pieces: piecesView(c.cart, state.orders),
      weight: cartWeight(c.cart),
      maxWeight: maxWeight(c.cart, c.horses),
    },
    town: c.town,
    travel: c.travel ? { from: c.travel.from, to: c.travel.to, daysLeft: c.travel.daysLeft } : null,
    plan: c.plan,
    stop: c.stop,
    recalled: c.recalled,
    here: !p.travel && !c.travel && c.town === p.town,
    rent: c.rent ? { perDay: c.rent.perDay, owed: c.rent.owed } : null,
  };
}

function apprenticeView(state: EconomyState, p: PlayerState, map: WorldMap): ApprenticeView | null {
  const ap = p.apprentice;
  if (!ap) return null;
  const def = sceneDef(ap.scene);
  // 졸업 장면: 견습 손님이 사 줄 값을 노상인이 한 번 말해 둔다 (답 140, 쪽지의 "약속대로")
  const guest = def.hint.includes('{offer}') ? apprenticeGuestOf(state, p, cartCount(p.cart, 'wood')) : null;
  const offer = guest ? ` {dest}에서는 ${GOOD_NAME[guest.good]} 하나에 ${guest.price}골드는 쳐 줄 걸세.` : '';
  return {
    scene: ap.scene,
    step: SCENES.indexOf(def) + 1,
    steps: SCENES.length,
    title: def.title,
    hint: def.hint
      .replaceAll('{offer}', offer)
      .replaceAll('{destTo}', euro(map.towns[ap.destination]!.name))
      .replaceAll('{dest}', map.towns[ap.destination]!.name),
    destination: ap.destination,
  };
}

const FLAG_TEXT: Record<ActiveExpedition['flags'][number], string> = {
  heat: '무더위: 생선과 고기가 빨리 상해요',
  snow: '눈 덮인 길: 카드마다 피로 +1',
  fatDeer: '살찐 사슴: 사슴 고기 +1',
  harvest: '수확철: 농부를 도우면 곡물 +1',
  packHorse: '말에 실은 바구니: 얻는 것마다 +1',
};

function expeditionView(state: EconomyState, p: PlayerState): ExpeditionView | null {
  const ex = p.expedition;
  if (!ex) return null;
  const card = cardById(ex.card);
  return {
    town: ex.town,
    card: {
      id: card.id,
      title: card.title,
      text: card.text,
      choices: card.choices.flatMap((c, index): ExpeditionChoiceView[] => {
        const unmet = needsMet(p, c.needs);
        // 장비나 말이 여는 덧붙은 선택지(셋째부터)는 없으면 보이지 않는다. 왼쪽·오른쪽은 보이되 고를 수 없다
        if ((unmet === 'needGear' || unmet === 'noHorse') && index >= 2) return [];
        const f = choiceFatigue(c, ex);
        const parts = [f > 0 ? `피로 +${f}` : f < 0 ? `피로 −${-f}` : '피로 그대로'];
        if (c.chance) {
          const odds = chanceOf(c.chance, state, p, ex.town);
          parts.push(odds >= 0.7 ? '성공 가능성 높음' : odds >= 0.45 ? '성공 가능성 반반' : '성공 가능성 낮음');
        }
        if (c.needs?.tool) parts.push(`도구 ${c.needs.tool}개`);
        if (c.needs?.gear) parts.push(ECONOMY.expedition.gear[c.needs.gear].name);
        if (c.needs?.horse) parts.push('말');
        return [
          {
            index,
            label: c.label,
            hint: parts.join(' · '),
            disabled: unmet === null ? null : unmet === 'needTool' ? '도구가 없어요' : unmet === 'noHorse' ? '말이 없어요' : `${iGa(ECONOMY.expedition.gear[c.needs!.gear!].name)} 없어요`,
            extra: index >= 2,
          },
        ];
      }),
    },
    flags: ex.flags.map((f) => FLAG_TEXT[f]),
    guide: ex.guide,
    left: Math.max(0, ex.left),
    haul: ex.haul.map((h) => ({ ...h })),
  };
}

export interface CartPieceView {
  id: number;
  /** 물품, 장비, 여행 식량 (0.1.2) */
  good: ItemId;
  x: number;
  y: number;
  rot: number;
  cells: (readonly [number, number])[];
  qty: number;
  stack: number;
  /** 장날 신청 때문에 잡아 둔 자리 */
  incoming: number;
  /** 사자 신청 자리면 'buy', 팔자 신청에서 돌아올 자리면 'sell' */
  pending: 'buy' | 'sell' | null;
  /** 가장 먼저 상할 묶음 */
  oldest: ItemLot | null;
  /** 장비면 남은 쓰는 횟수와 처음 횟수 */
  uses: { left: number; max: number } | null;
  /** 장날에 산 값 (하나당 평균). 원정·채집으로 얻은 것만 있으면 0, 모르면 null */
  cost: number | null;
}

export interface CartView {
  type: CartType;
  name: string;
  rows: readonly string[];
  pieces: CartPieceView[];
  weight: number;
  /** 지금 말로 끌 수 있는 무게. 말이 모자라면 0 */
  maxWeight: number;
  /** 움직이려면 있어야 하는 말 수 (짐수레 1, 마차 2) */
  horsesNeeded: number;
  /** 물건마다 지금 더 실을 수 있는 개수 */
  room: Record<GoodId, number>;
  /** 길 위 사건으로 망가진 칸 ([x, y], 0.1.2)과 모두 고치는 값 */
  broken: (readonly [number, number])[];
  repairCost: number;
}

/** 판(수레, 창고) 위 짐 조각 */
function piecesView(board: Board, orders: readonly Order[]): CartPieceView[] {
  const sideOf = new Map(orders.map((o) => [o.id, o.side]));
  return board.pieces.map((p) => ({
      id: p.id,
      good: p.good,
      x: p.x,
      y: p.y,
      rot: p.rot,
      cells: pieceCells(p),
      qty: p.lots.reduce((s, l) => s + l.qty, 0),
      stack: boardStack(board, p.good),
      incoming: p.incoming.reduce((s, i) => s + i.qty, 0),
      pending: p.incoming.length ? (sideOf.get(p.incoming[0]!.orderId) ?? null) : null,
      oldest: p.lots.length ? p.lots.reduce((a, l) => (l.age > a.age ? l : a)) : null,
      uses: p.uses !== undefined && isGear(p.good) ? { left: p.uses, max: ECONOMY.expedition.gear[p.good].durability } : null,
      cost: costOf(p.lots),
  }));
}

/** 묶음들의 산 값 평균 (하나당). 산 값을 아는 묶음이 없으면 null */
function costOf(lots: readonly ItemLot[]): number | null {
  const known = lots.filter((l) => l.cost !== undefined);
  const qty = known.reduce((s, l) => s + l.qty, 0);
  return qty ? Math.round(known.reduce((s, l) => s + l.qty * l.cost!, 0) / qty) : null;
}

function cartView(cart: Cart, orders: readonly Order[], horses: readonly Horse[], room: Record<GoodId, number>): CartView {
  return {
    type: cart.type,
    name: CART.types[cart.type].name,
    rows: CART.types[cart.type].rows,
    pieces: piecesView(cart, orders),
    weight: cartWeight(cart),
    maxWeight: maxWeight(cart, horses),
    horsesNeeded: horsesNeeded(cart),
    room,
    broken: (cart.broken ?? []).map((k) => k.split(',').map(Number) as [number, number]),
    repairCost: repairCost(cart),
  };
}

/** 이 계절이 오늘 뒤로 며칠 더 가나 */
function seasonDaysLeft(day: number, start: Season): number {
  const now = seasonOfDay(day, start);
  let n = 0;
  while (n < CYCLE_DAYS && seasonOfDay(day + n + 1, start) === now) n++;
  return n;
}

/** 장에서 사서 더 실을 수 있는 양: 내 수레(칸, 끄는 무게) + 짐꾼 수레 */
function buyRoomView(p: PlayerState, room: Record<GoodId, number>): Record<GoodId, number> {
  const free = maxWeight(p.cart, p.horses) - cartWeight(p.cart);
  return Object.fromEntries(
    GOODS.map((g) => [
      g,
      Math.max(0, Math.min(room[g], Math.floor(free / unitWeight(g)))) + porters(p).reduce((s, x) => s + porterBuyRoom(x.board, g), 0),
    ]),
  ) as Record<GoodId, number>;
}

/** 부문마다 시즌 전체 1~3위와 내 순위, 내 세계 순위 (남의 점수는 담지 않는다) */
function rankingView(state: EconomyState, p: PlayerState, season: RankTable, world: RankTable): RankingCategoryView[] {
  const here = (r: Standing) => r.worldId === undefined || r.worldId === state.world.worldId;
  const nameOf = (r: Standing) => (here(r) ? state.players[r.id]?.certificate.name : undefined) ?? r.name ?? r.id;
  return CATEGORIES.map((id) => {
    const rows = season[id] ?? [];
    const mine = rows.find((r) => r.id === p.id && here(r));
    const wrows = world[id] ?? [];
    const wmine = wrows.find((r) => r.id === p.id);
    return {
      id,
      name: categoryName(id),
      // 1~3위 (같은 점수가 많으면 앞의 세 상단만)
      top: rows
        .filter((r) => r.rank <= 3)
        .slice(0, 3)
        .map((r) => ({ id: r.id, name: nameOf(r), rank: r.rank, mine: here(r), bot: here(r) && state.players[r.id]?.bot === true })),
      worldTop: wrows
        .filter((r) => r.rank <= 3)
        .slice(0, 3)
        .map((r) => ({ id: r.id, name: nameOf(r), rank: r.rank, mine: true as const, bot: state.players[r.id]?.bot === true })),
      mine: mine ? { rank: mine.rank, topShare: mine.topShare, score: mine.score } : null,
      count: rows.length,
      world: { mine: wmine ? { rank: wmine.rank, topShare: wmine.topShare } : null, count: wrows.length },
    };
  });
}

function locationOf(p: PlayerState): PlayerLocation {
  return p.travel
    ? { kind: 'road', from: p.travel.from, to: p.travel.to, days: p.travel.days, daysLeft: p.travel.daysLeft }
    : { kind: 'town', town: p.town };
}

/** 플레이어 한 사람에게 보이는 것 */
export function playerView(state: EconomyState, map: WorldMap, playerId: PlayerId): PlayerView {
  const p = getPlayer(state, playerId);
  // 물건마다 내 수레에 더 실을 칸 (짐을 실어 보며 세어 무겁다: 한 번만)
  const room = Object.fromEntries(GOODS.map((g) => [g, roomFor(p.cart, g)])) as Record<GoodId, number>;
  const location = locationOf(p);
  const paper = visibleNews(state, p);

  let market: MarketView | null = null;
  if (!p.travel) {
    const t = state.towns[p.town]!;
    const price = {} as Record<GoodId, number>;
    for (const g of GOODS) price[g] = Math.round(t.refPrice[g]);
    market = {
      town: p.town,
      price,
      previous: p.memory[p.town]?.previous ?? null,
      yesterday: { ...t.lastMarket },
    };
  }

  // 내 신청만 (다른 플레이어 신청은 보이지 않는다)
  const mine = state.orders.filter((o) => ownedBy(o.owner, p.id));
  const orders: PendingOrder[] = mine.map((o) => ({
    id: o.id,
    good: o.good,
    side: o.side,
    qty: o.qty,
    limit: o.limit,
    town: o.town,
    from: o.owner.kind === 'store' ? 'store' : 'cart',
  }));
  // 마구간 남은 수는 그 마을에 있을 때만 보인다
  const stable = p.travel ? null : stableAt(state, p.town);
  const alerts = buildingAlerts(state, p, map);
  const reserved = mine.reduce((s, o) => s + o.reserved, 0) + drawsOf(state, p).reduce((s, d) => s + d.reserved, 0);
  // 수레 짐으로 낸 팔기만 (창고 짐 신청은 수레 밖이다)
  const sellingQty = mine.filter((o) => o.side === 'sell' && o.owner.kind === 'player').reduce((s, o) => s + o.qty, 0);

  return {
    day: state.day,
    season: seasonOfDay(state.day, state.startSeason),
    seasonDaysLeft: seasonDaysLeft(state.day, state.startSeason),
    gold: p.gold,
    reserved,
    cargo: cartLots(p.cart),
    haul: [...cartLots(p.cart), ...porters(p).flatMap((x) => cartLots(x.board))],
    buyRoom: buyRoomView(p, room),
    cargoCount: totalCount(cartLots(p.cart)) + sellingQty,
    cart: cartView(p.cart, state.orders, p.horses, room),
    location,
    market,
    bigOrders:
      location.kind === 'town'
        ? bigOrdersToday(state)
            .filter(({ event }) => event.town === location.town)
            .map(({ event, order }) => ({ event: eventDef(event.event).name, good: order.good, left: order.left, price: order.price, until: event.end }))
        : [],
    orders,
    memory: p.memory,
    ledger: p.ledger,
    news: paper,
    newspaper: {
      fee: paperFree(p) ? 0 : ECONOMY.newspaper.fee,
      free: paperFree(p),
      papers: [...p.newspapers]
        .sort((a, b) => b - a)
        .map((day) => ({ day, headline: paperHeadline(state.news, day), read: p.papersRead.includes(day) })),
      onSale: (() => {
        if (p.travel) return null;
        const day = paperOnSale(state, map, p.town, p);
        return day === null ? null : { day, bought: p.newspapers.includes(day) };
      })(),
      back: p.travel
        ? []
        : papersOnSale(state, map, p.town, p)
            .filter((x) => !x.latest)
            .map((x) => ({ day: x.day, fee: x.fee, bought: p.newspapers.includes(x.day) })),
      backFee: paperFree(p) ? 0 : ECONOMY.newspaper.backFee,
      late: !p.travel && paperDelay(map, p.town) > 0,
    },
    fatigue: p.fatigue,
    fatigueMax: ECONOMY.fatigue.max,
    tired: p.fatigue >= ECONOMY.fatigue.tiredAt,
    expeditionChances: p.expeditionChances,
    canExpedition: !p.travel && hasExpeditions(state.towns[p.town]!),
    mealsLeft: ECONOMY.fatigue.mealsPerDay - p.mealsToday,
    inn: p.travel ? null : { ...innOf(state.towns[p.town]!), rested: p.restedToday },
    expedition: expeditionView(state, p),
    lastExpedition: p.lastExpedition,
    // 수첩과 보고 (적은 것), 최근 들은 이야기 (적을지 고르는 중, 0.1.2)
    rumors: p.rumors.filter((h) => h.noted !== false).map(noteView),
    recentHeard: p.rumors.filter((h) => h.noted === false).map(noteView),
    gossip: p.travel ? null : { canListen: p.listenedDay !== state.day, fresh: freshGossip(state, p, map) },
    drink: p.travel ? null : { fee: drinkFee(state, p.town), drank: p.drankToday },
    pigeon: { fee: RUMORS.pigeonFee, pending: p.pigeons.map((pg) => pg.town) },
    informants: p.informants,
    seasonInfo: state.season
      ? { number: state.season.number, day: state.day - state.season.startDay + 1, length: state.season.length }
      : null,
    roads: {
      blocked: [...blockedTiles(state)].sort((a, b) => a - b),
      tolls: Object.fromEntries(
        state.towns.map((t) => [t.id, tollAt(state, t.id)] as const).filter(([, gold]) => gold > 0),
      ),
    },
    travel: {
      days: playerTravelDays(state, p, map),
      usual: townTravelDays(map, seasonOfDay(state.day, state.startSeason))[p.travel ? p.travel.from : p.town]!.map((d) =>
        horseDays(d, p.horses),
      ),
    },
    horses: p.horses.map((h) => horseView(state, h, stable)),
    horseCare: p.travel
      ? null
      : { feedPrice: feedPrice(state, p.town), restFee: HORSES.fatigue.rest.fee * p.horses.length, rested: p.horsesRested },
    stable: stable
      ? { town: stable.town, horses: HORSE_KINDS.map((k) => ({ ...kindInfo(k), stock: stable.stock[k], price: buyPrice(stable, k) })) }
      : null,
    gear: GEAR_KINDS.map((kind) => ({
      kind,
      name: ECONOMY.expedition.gear[kind].name,
      price: ECONOMY.expedition.gear[kind].price,
      uses: gearUses(p, kind),
      maxUses: ECONOMY.expedition.gear[kind].durability,
    })),
    tools: cartCount(p.cart, 'tools'),
    food: {
      have: myFood(p),
      perDay: foodPerDay(p),
      rationPrice: p.travel ? null : rationPrice(state, p.town),
      rationRoom: roomFor(p.cart, 'rations', 99),
    },
    toolUsesLeft: cartCount(p.cart, 'tools') > 0 ? ECONOMY.expedition.usesPerTool - p.toolUses : 0,
    apprentice: apprenticeView(state, p, map),
    apprenticeGuest: p.apprenticeGuest ? { ...p.apprenticeGuest } : null,
    newsReadDay: p.newsReadDay,
    unlocks: (Object.keys(p.unlocks) as UnlockId[]).filter((id) => p.unlocks[id] !== undefined),
    guide: p.travel || !hasExpeditions(state.towns[p.town]!) ? null : { fee: guideFee(state, p.town), hired: p.guide },
    warehouses: p.warehouses.map((w) => ({
      town: w.town,
      name: GROWTH.warehouse.name,
      rows: GROWTH.warehouse.rows,
      pieces: piecesView(w.board, state.orders),
      count: cartLots(w.board).reduce((s, l) => s + l.qty, 0),
      owed: w.owed,
      fee: boardFee(w.board),
      usedCells: usedCells(w.board),
      cells: WAREHOUSE_CELLS,
      room: Object.fromEntries(GOODS.map((g) => [g, roomFor(w.board, g)])) as Record<GoodId, number>,
      sellable: Object.fromEntries(GOODS.map((g) => [g, sellableCount(cartLots(w.board), g, ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)])])) as Record<GoodId, number>,
    })),
    hires: p.hires.map((h) => ({
      id: h.id,
      role: h.role,
      roleName: GROWTH.hire[h.role].name,
      name: h.name,
      jobName: JOB_NAME[h.job],
      town: h.town,
      wage: h.wage,
      restWage: h.role === 'carter' ? restWage(h) : null,
      wageToday: wageToday(state, p, h),
      board: h.board
        ? { rows: CART.types.handcart.rows, pieces: piecesView(h.board, state.orders), weight: cartWeight(h.board), maxWeight: CART.types.handcart.humanPull }
        : null,
    })),
    hireBoard: hireBoard(state, p, map),
    reservations: p.reservations.map((r) => ({ ...r })),
    ranking: { day: state.rankings?.day ?? null, categories: rankingView(state, p, state.rankings?.season ?? {}, state.rankings?.table ?? {}) },
    settlement: state.settlement
      ? {
          season: state.settlement.season,
          categories: rankingView(state, p, state.settlement.table, state.settlement.worldTable),
          report: state.settlement.reports[p.id] ?? null,
          badges: (state.settlement.awarded[p.id]?.badges ?? []).map((id) => badgeDef(id)?.name ?? id),
          titles: state.settlement.awarded[p.id]?.titles ?? [],
        }
      : null,
    certificates: Object.fromEntries(playerList(state).map((o) => [o.id, { ...certificateView(o.certificate), bot: o.bot }])),
    rivals: playerList(state)
      .filter((o) => o.id !== p.id)
      .map((o) => ({ id: o.id, name: o.certificate.name, bot: o.bot, location: locationOf(o) })),
    draws: drawsOf(state, p).map((d) => ({
      id: d.id,
      kind: d.kind,
      town: d.town,
      horse: d.kind === 'horse' ? d.horse : null,
      role: d.kind === 'hire' ? d.role : null,
      name: d.kind === 'horse' ? HORSES.kinds[d.horse].name : GROWTH.hire[d.role].name,
      reserved: d.reserved,
    })),
    caravan: caravanView(state, p),
    visited: p.visited,
    knownBuildings: Object.fromEntries(
      p.visited.map((t) => [t, townBuildings(state, map, t).map((id) => ({ id, name: buildingDef(id).name }))]),
    ),
    knownTraits: knownTraits(p),
    upkeep: upkeepView(state, p),
    guild: guildView(state, p),
    certificate: certificateView(p.certificate),
    titles: [...p.certificate.titles],
    badgeBook: p.certificate.badges.map((b) => {
      const def = badgeDef(b.badge);
      return { name: def?.name ?? b.badge, kind: def?.kind ?? 'achievement', tier: b.tier, season: b.season, day: b.day };
    }),
    notify: { ...p.notify, askNow: p.apprentice?.scene === 'graduation' && p.notify.askedDay === null },
    bank: { deposit: p.bank.deposit, loan: p.bank.loan, depositRate: GROWTH.bank.depositRate, loanRate: GROWTH.bank.loanRate },
    informant: p.travel ? null : { wage: GROWTH.hire.informant.wage, here: p.informants.includes(p.town) },
    buildings: p.travel
      ? []
      : townBuildings(state, map, p.town).map((id) => ({ id, name: buildingDef(id).name, alert: alerts[id] ?? null })),
    carts: (p.travel || !hasBuilding(state, map, p.town, 'cartShop') ? [] : CART_TYPES).map((type) => ({
      type,
      name: CART.types[type].name,
      rows: CART.types[type].rows,
      humanPull: CART.types[type].humanPull,
      horses: CART.types[type].horses,
      cost: type === p.cart.type ? null : cartCost(p.cart.type, type),
      rentPerDay: CART.rentPerDay[type] > 0 ? CART.rentPerDay[type] : null,
    })),
  };
}
