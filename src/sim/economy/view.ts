// 플레이어에게 보이는 것만 골라 낸다. 화면은 실제 상태(EconomyState) 대신 이것만 그린다.
// 지금 있는 마을 시세만 정확히 알고, 다른 마을은 날짜가 붙은 기억으로만 안다.
import { CART_TYPES, cartCount, cartLots, cartWeight, pieceCells, roomFor, stackLimit, unitWeight, type Board, type Cart, type CartType } from '../cart';
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
} from '../horses';
import { townTravelDays, type WorldMap } from '../worldgen';
import { playerTravelDays } from './travel';
import { buildingAlerts, buildingDef, hasBuilding, townBuildings, type BuildingId } from '../growth/buildings';
import { hireBoard, porterBuyRoom, porters, type HireOffer, type HireRole } from '../hire';
import type { CaravanPlan } from '../caravan';
import type { NotifySettings } from '../notify';
import { badgeDef, certificateView, questProgress, questTier, themeDef, type CertificateView } from '../ranking';
import { regionTag } from '../worldgen';
import { JOB_NAME } from './jobs';
import { SCENES, sceneDef, type SceneId, type UnlockId } from '../apprentice';
import { CART, ECONOMY, GROWTH, HORSES, RUMORS } from '../constants';
import { seasonOfDay, type Season } from '../season';
import { hasExpeditions, innOf } from './player';
import { GOODS, type GoodId } from './goods';
import { totalCount, type Lot } from './inventory';
import { euro, iGa } from '../josa';
import { cardById, chanceOf, choiceFatigue, GEAR_KINDS, guideFee, needsMet, type GearKind } from '../expedition';
import { bigOrdersToday, blockedTiles, eventDef, tollAt } from '../events';
import type {
  ActiveExpedition,
  EconomyState,
  ExpeditionResult,
  LedgerEntry,
  MarketResult,
  NewsItem,
  Order,
  PriceMemory,
} from './state';
import { drinkFee, type HeardRumor } from '../rumors';

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

export interface HireView {
  id: number;
  role: HireRole;
  roleName: string;
  name: string;
  jobName: string;
  town: number;
  wage: number;
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
  rentPerDay: number;
}

export interface PlayerView {
  /** 오늘 (이날 장날에 신청이 정산된다) */
  day: number;
  season: Season;
  gold: number;
  /** 사자 신청에 맡겨 둔 돈 */
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
  memory: Readonly<Record<number, PriceMemory>>;
  ledger: readonly LedgerEntry[];
  news: readonly NewsItem[];
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
  guild: { theme: string | null; quests: { name: string; scope: 'personal' | 'communal'; text: string; value: number; tiers: readonly number[]; tier: string | null }[] };
  /** 상인 증서 (순자산은 없다) */
  certificate: CertificateView;
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
  /** 지금 쓰는 도구가 원정 선택지를 몇 번 더 버티나 (도구가 없으면 0) */
  toolUsesLeft: number;
  /** 여관 안내인: 고용 값과 고용했는지. 원정을 못 나가는 마을이나 길 위면 null */
  guide: { fee: number; hired: boolean } | null;
  /** 견습 중이면 지금 장면 (기획서 "첫 5분의 흐름"). 아니면 null */
  apprentice: ApprenticeView | null;
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
}

const kindInfo = (kind: HorseKind): HorseKindInfo => {
  const k = HORSES.kinds[kind];
  return { kind, name: k.name, pull: k.pull, speed: k.speed, feed: k.feed };
};

function horseView(h: Horse, stable: ReturnType<typeof stableAt>): HorseView {
  return {
    ...kindInfo(h.kind),
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

export type NoteView = Omit<HeardRumor, 'claim' | 'rumor'>;

/** 수첩 한 줄을 화면용으로: 도장 판정용 주장과 세계 소문 번호는 뺀다 */
export function noteView({ claim: _claim, rumor: _rumor, ...rest }: HeardRumor): NoteView {
  return rest;
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
function knownTraits(state: EconomyState): Record<number, { name: string; confirmed: boolean }[]> {
  const out: Record<number, { name: string; confirmed: boolean }[]> = {};
  for (const h of state.player.rumors) {
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

function upkeepView(state: EconomyState): PlayerView['upkeep'] {
  const p = state.player;
  const parts: { what: string; perDay: number }[] = [];
  const wages = p.hires.reduce((s, h) => s + h.wage, 0);
  if (wages) parts.push({ what: '일꾼 일당', perDay: wages });
  if (p.informants.length) parts.push({ what: '정보원', perDay: p.informants.length * GROWTH.hire.informant.wage });
  const horses = [...p.horses, ...(p.caravan?.horses ?? [])];
  const feedTown = p.travel ? p.travel.to : p.town;
  const feed = Math.round(horses.reduce((s, h) => s + HORSES.kinds[h.kind].feed, 0) * feedPrice(state, feedTown));
  if (feed) parts.push({ what: '말 먹이 (어림)', perDay: feed });
  if (p.warehouses.length) parts.push({ what: '창고 보관료', perDay: p.warehouses.length * GROWTH.warehouse.rentPerDay });
  return { total: parts.reduce((s, x) => s + x.perDay, 0), parts };
}

function guildView(state: EconomyState): PlayerView['guild'] {
  const theme = themeDef(state.season?.theme ?? '');
  return {
    theme: theme?.name ?? null,
    quests: (theme?.quests ?? []).map((q) => {
      const value = questProgress(state, q);
      return { name: q.name, scope: q.scope, text: q.text, value, tiers: q.tiers, tier: questTier(q, value) };
    }),
  };
}

function caravanView(state: EconomyState): CaravanView | null {
  const p = state.player;
  const c = p.caravan;
  if (!c) return null;
  return {
    carter: p.hires.find((h) => h.id === c.carter)?.name ?? null,
    horses: c.horses.map((h) => horseView(h, null)),
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
  };
}

function apprenticeView(state: EconomyState, map: WorldMap): ApprenticeView | null {
  const ap = state.player.apprentice;
  if (!ap) return null;
  const def = sceneDef(ap.scene);
  return {
    scene: ap.scene,
    step: SCENES.indexOf(def) + 1,
    steps: SCENES.length,
    title: def.title,
    hint: def.hint.replaceAll('{destTo}', euro(map.towns[ap.destination]!.name)).replaceAll('{dest}', map.towns[ap.destination]!.name),
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

function expeditionView(state: EconomyState): ExpeditionView | null {
  const ex = state.player.expedition;
  if (!ex) return null;
  const card = cardById(ex.card);
  return {
    town: ex.town,
    card: {
      id: card.id,
      title: card.title,
      text: card.text,
      choices: card.choices.flatMap((c, index): ExpeditionChoiceView[] => {
        const unmet = needsMet(state, c.needs);
        // 장비나 말이 여는 덧붙은 선택지(셋째부터)는 없으면 보이지 않는다. 왼쪽·오른쪽은 보이되 고를 수 없다
        if ((unmet === 'needGear' || unmet === 'noHorse') && index >= 2) return [];
        const f = choiceFatigue(c, ex);
        const parts = [f > 0 ? `피로 +${f}` : f < 0 ? `피로 −${-f}` : '피로 그대로'];
        if (c.chance) {
          const p = chanceOf(c.chance, state, ex.town);
          parts.push(p >= 0.7 ? '성공 가능성 높음' : p >= 0.45 ? '성공 가능성 반반' : '성공 가능성 낮음');
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
  good: GoodId;
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
  oldest: Lot | null;
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
      stack: stackLimit(p.good),
      incoming: p.incoming.reduce((s, i) => s + i.qty, 0),
      pending: p.incoming.length ? (sideOf.get(p.incoming[0]!.orderId) ?? null) : null,
      oldest: p.lots.length ? p.lots.reduce((a, l) => (l.age > a.age ? l : a)) : null,
  }));
}

function cartView(cart: Cart, orders: readonly Order[], horses: readonly Horse[]): CartView {
  return {
    type: cart.type,
    name: CART.types[cart.type].name,
    rows: CART.types[cart.type].rows,
    pieces: piecesView(cart, orders),
    weight: cartWeight(cart),
    maxWeight: maxWeight(cart, horses),
    horsesNeeded: horsesNeeded(cart),
    room: Object.fromEntries(GOODS.map((g) => [g, roomFor(cart, g)])) as Record<GoodId, number>,
  };
}

/** 장에서 사서 더 실을 수 있는 양: 내 수레(칸, 끄는 무게) + 짐꾼 수레 */
function buyRoomView(p: EconomyState['player']): Record<GoodId, number> {
  const free = maxWeight(p.cart, p.horses) - cartWeight(p.cart);
  return Object.fromEntries(
    GOODS.map((g) => [
      g,
      Math.max(0, Math.min(roomFor(p.cart, g), Math.floor(free / unitWeight(g)))) + porters(p).reduce((s, x) => s + porterBuyRoom(x.board, g), 0),
    ]),
  ) as Record<GoodId, number>;
}

export function playerView(state: EconomyState, map: WorldMap): PlayerView {
  const p = state.player;
  const location: PlayerLocation = p.travel
    ? { kind: 'road', from: p.travel.from, to: p.travel.to, days: p.travel.days, daysLeft: p.travel.daysLeft }
    : { kind: 'town', town: p.town };

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

  const orders: PendingOrder[] = state.orders.map((o) => ({
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
  const alerts = buildingAlerts(state, map);
  const reserved = state.orders.reduce((s, o) => s + o.reserved, 0);
  // 수레 짐으로 낸 팔기만 (창고 짐 신청은 수레 밖이다)
  const sellingQty = state.orders.filter((o) => o.side === 'sell' && o.owner.kind === 'player').reduce((s, o) => s + o.qty, 0);

  return {
    day: state.day,
    season: seasonOfDay(state.day, state.startSeason),
    gold: p.gold,
    reserved,
    cargo: cartLots(p.cart),
    haul: [...cartLots(p.cart), ...porters(p).flatMap((x) => cartLots(x.board))],
    buyRoom: buyRoomView(p),
    cargoCount: totalCount(cartLots(p.cart)) + sellingQty,
    cart: cartView(p.cart, state.orders, p.horses),
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
    news: state.news,
    fatigue: p.fatigue,
    fatigueMax: ECONOMY.fatigue.max,
    tired: p.fatigue >= ECONOMY.fatigue.tiredAt,
    expeditionChances: p.expeditionChances,
    canExpedition: !p.travel && hasExpeditions(state.towns[p.town]!),
    mealsLeft: ECONOMY.fatigue.mealsPerDay - p.mealsToday,
    inn: p.travel ? null : { ...innOf(state.towns[p.town]!), rested: p.restedToday },
    expedition: expeditionView(state),
    lastExpedition: p.lastExpedition,
    rumors: p.rumors.map(noteView),
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
      days: playerTravelDays(state, map),
      usual: townTravelDays(map, seasonOfDay(state.day, state.startSeason))[p.travel ? p.travel.from : p.town]!.map((d) =>
        horseDays(d, p.horses),
      ),
    },
    horses: p.horses.map((h) => horseView(h, stable)),
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
      uses: p.gear[kind] ?? null,
      maxUses: ECONOMY.expedition.gear[kind].durability,
    })),
    tools: cartCount(p.cart, 'tools'),
    toolUsesLeft: cartCount(p.cart, 'tools') > 0 ? ECONOMY.expedition.usesPerTool - p.toolUses : 0,
    apprentice: apprenticeView(state, map),
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
      rentPerDay: GROWTH.warehouse.rentPerDay,
    })),
    hires: p.hires.map((h) => ({
      id: h.id,
      role: h.role,
      roleName: GROWTH.hire[h.role].name,
      name: h.name,
      jobName: JOB_NAME[h.job],
      town: h.town,
      wage: h.wage,
      board: h.board
        ? { rows: CART.types.handcart.rows, pieces: piecesView(h.board, state.orders), weight: cartWeight(h.board), maxWeight: CART.types.handcart.humanPull }
        : null,
    })),
    hireBoard: hireBoard(state, map),
    caravan: caravanView(state),
    visited: p.visited,
    knownBuildings: Object.fromEntries(
      p.visited.map((t) => [t, townBuildings(state, map, t).map((id) => ({ id, name: buildingDef(id).name }))]),
    ),
    knownTraits: knownTraits(state),
    upkeep: upkeepView(state),
    guild: guildView(state),
    certificate: certificateView(p.certificate),
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
    })),
  };
}
