// 화면 문구. 처음 하는 사람에게 전문 용어를 보이지 않는다 ("동시호가" 대신 "장날").
import { shelfLife, GOOD_NAME, type CommandError, type GoodId, type LedgerEntry, type Lot } from '../sim/economy';
import { SEASON_NAME, type Season } from '../sim/season';
import { CART, ECONOMY, GROWTH, HORSES } from '../sim/constants';
import { eulReul, euro, iGa } from '../sim/josa';

export const money = (n: number): string => Math.round(n).toLocaleString('ko-KR');

export const dayText = (day: number, season: Season): string => `${day}일째 · ${SEASON_NAME[season]}`;

/** 1시간 23분, 7분 */
export function durationText(ms: number): string {
  const min = Math.ceil(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 위쪽 줄용 짧은 시간: "1:42" (시:분) */
export function clockText(ms: number): string {
  const min = Math.ceil(ms / 60000);
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

/** 오늘 본 날 기준으로 "오늘", "어제", "3일 전" */
export function agoText(today: number, day: number): string {
  const d = today - day;
  if (d <= 0) return '오늘';
  if (d === 1) return '어제';
  return `${d}일 전`;
}

export const ERROR_TEXT: Record<CommandError, string> = {
  traveling: '길 위에서는 장에 신청할 수 없어요.',
  badGood: '없는 물건이에요.',
  badQty: '개수를 확인해 주세요.',
  badPrice: '값을 확인해 주세요.',
  notEnoughGold: '돈이 모자라요.',
  notEnoughGoods: '짐에 그만큼 없어요.',
  spoiling: '곧 상할 물건은 장에 낼 수 없어요.',
  noRoom: '수레에 자리가 모자라요. 짐을 정리하거나 팔아서 자리를 만드세요.',
  noOrder: '이미 없는 신청이에요.',
  sameTown: '이미 이 마을에 있어요.',
  noTown: '없는 마을이에요.',
  noRoute: '그 마을로 가는 길이 없어요.',
  notFood: '먹을 수 없는 물건이에요.',
  tooManyMeals: '오늘은 더 못 먹겠어요. 내일 다시 먹어요.',
  alreadyRested: '오늘은 이미 여관에서 쉬었어요.',
  notTired: '지치지 않았어요.',
  overweight: '짐이 너무 무거워 떠날 수 없어요. 팔거나 버려서 무게를 줄이세요.',
  noPiece: '없는 짐이에요.',
  cantPlace: '거기에는 놓을 수 없어요.',
  pieceBusy: '장날 신청이 걸린 짐은 버릴 수 없어요.',
  noExpedition: '이 마을 주변에는 원정을 나갈 곳이 없어요.',
  noChances: '원정 기회가 없어요. 이 마을에 머물면 하루에 하나씩 생겨요.',
  tooTired: '너무 지쳤어요. 쉬고 나서 나가세요.',
  inExpedition: '원정 중이에요. 원정을 마치고 하세요.',
  notInExpedition: '원정 중이 아니에요.',
  badChoice: '고를 수 없는 선택이에요.',
  alreadyDrank: '오늘은 이미 한 잔 했어요. 내일 다시 와요.',
  noRumor: '여관 손님들도 오늘은 새로 들려줄 이야기가 없대요.',
  alreadyInformant: '이 마을에는 이미 정보원이 있어요.',
  noInformant: '그 마을에는 정보원이 없어요.',
  noStable: '이 마을에는 말을 파는 마구간이 없어요. 목장이 있는 마을로 가 보세요.',
  noHorseLeft: '마구간에 그 말이 남아 있지 않아요.',
  tooManyHorses: '말은 두 필까지만 가질 수 있어요.',
  noHorse: '그 말이 없어요.',
  stableNoGold: '마구간 주인이 지금 말값을 치를 돈이 없대요.',
  alreadyRestedHorses: '오늘은 이미 말을 쉬게 했어요.',
  horsesNotTired: '말이 지치지 않았어요.',
  sameCart: '지금 그 수레를 쓰고 있어요.',
  ordersPending: '장날에 낸 신청이 있으면 수레를 바꿀 수 없어요. 신청을 거두거나 장날이 지나고 바꾸세요.',
  needHorse: '이 수레는 말이 있어야 움직여요. 짐수레는 한 필, 마차는 두 필이 필요해요.',
  noCartShop: '이 마을에는 수레방이 없어요. 목재 마을이나 도시로 가 보세요.',
  noWarehouse: '이 마을에 빌린 창고가 없어요.',
  haveWarehouse: '이 마을 창고는 이미 빌렸어요.',
  warehouseNotEmpty: '창고를 비우고 돌려주세요. 창고 짐으로 낸 신청도 거둬야 해요.',
  warehouseOwed: '밀린 보관료를 먼저 내야 해요. 돈이 생기면 밤에 저절로 내요.',
  noInn: '이 마을에는 여관이 없어요.',
  noWorker: '이 마을에는 지금 데려올 일손이 없어요.',
  noHire: '그 일꾼은 이미 없어요.',
  boardNotEmpty: '짐꾼 수레의 짐을 먼저 옮기세요.',
  noBoard: '그 짐칸이 없어요.',
  noCarter: '마부가 없어요. 여관 고용 게시판에서 마부를 고용하세요.',
  haveCaravan: '두 번째 행렬이 이미 있어요.',
  noCaravan: '두 번째 행렬이 없어요.',
  caravanAway: '행렬이 이 마을에 와 있어야 해요. 불러들이세요.',
  badPlan: '지시서를 확인해 주세요. 마을은 다섯 곳까지예요.',
  badArrangement: '짐 배치가 맞지 않아요. 다시 놓아 주세요.',
  needTool: '도구가 있어야 해요. 수레에 도구를 실어 오세요.',
  needGear: '그 장비가 없거나 망가졌어요.',
  haveGear: '이미 쓸 만한 장비가 있어요.',
  gearFine: '닳은 데가 없어요.',
  alreadyGuide: '안내인을 이미 고용했어요. 다음 원정에 따라가요.',
};

/** 누가 한 거래인지: 창고 짐, 두 번째 행렬 */
const byText = (by: 'store' | 'caravan' | undefined): string => (by === 'caravan' ? '[행렬] ' : by === 'store' ? '[창고] ' : '');

/** 장부 한 줄: 글과 돈 변화 */
export function ledgerLine(e: LedgerEntry, townName: (id: number) => string): { text: string; amount: number | null } {
  switch (e.kind) {
    case 'buy':
      return { text: `${byText(e.by)}${townName(e.town)}에서 ${GOOD_NAME[e.good]} ${e.qty}개 샀어요 (개당 ${e.price})`, amount: -e.qty * e.price };
    case 'sell':
      return { text: `${byText(e.by)}${townName(e.town)}에서 ${GOOD_NAME[e.good]} ${e.qty}개 팔았어요 (개당 ${e.price})`, amount: e.qty * e.price };
    case 'travel':
      return { text: `${townName(e.from)} → ${townName(e.to)} 출발 (${e.days}일)`, amount: -e.fee };
    case 'spoil':
      return { text: `${GOOD_NAME[e.good]} ${e.qty}개가 상해서 버렸어요`, amount: null };
    case 'eat':
      return { text: `${GOOD_NAME[e.good]} 하나를 먹었어요 (피로 −${e.recovered})`, amount: null };
    case 'inn':
      return { text: `${townName(e.town)} 여관에서 쉬었어요 (피로 −${e.recovered})`, amount: -e.fee };
    case 'discard':
      return { text: `${GOOD_NAME[e.good]} ${e.qty}개를 버렸어요`, amount: null };
    case 'expedition': {
      const got = e.goods.map((g) => `${GOOD_NAME[g.good]} ${g.qty}`).join(', ');
      const left = e.leftBehind ? ` (${e.leftBehind}개는 두고 옴)` : '';
      return { text: `${townName(e.town)} 원정: ${got || '빈손'}${left}`, amount: null };
    }
    case 'toll':
      return { text: `${townName(e.town)} 근처 길에서 통행세를 냈어요`, amount: -e.gold };
    case 'horse': {
      const name = HORSES.kinds[e.horse].name;
      if (e.what === 'lost') return { text: `굶주린 ${iGa(name)} ${townName(e.town)} 마구간으로 돌아가 버렸어요`, amount: null };
      return {
        text: `${townName(e.town)} 마구간에서 ${name} ${e.what === 'buy' ? '샀어요' : '팔았어요'}`,
        amount: e.what === 'buy' ? -e.price : e.price,
      };
    }
    case 'horseFeed':
      return e.fee
        ? { text: `${e.town === null ? '' : `${townName(e.town)} `}마구간에서 말을 먹였어요 (곡물 ${e.qty})`, amount: -e.fee }
        : { text: `수레에 실은 곡물 ${e.qty}개를 말에게 먹였어요`, amount: null };
    case 'horseRest':
      return { text: `${townName(e.town)} 마구간에서 말을 쉬게 했어요`, amount: -e.fee };
    case 'gear': {
      const name = ECONOMY.expedition.gear[e.gear].name;
      return e.what === 'buy'
        ? { text: `${townName(e.town)} 잡화점에서 ${eulReul(name)} 샀어요`, amount: -e.price }
        : { text: `도구 하나로 ${eulReul(name)} 고쳤어요`, amount: null };
    }
    case 'guide':
      return { text: `${townName(e.town)} 여관에서 안내인을 고용했어요`, amount: -e.fee };
    case 'earn':
      return { text: `${townName(e.town)} 목장에서 일하고 품삯을 받았어요`, amount: e.gold };
    case 'hire': {
      const role = e.role ? GROWTH.hire[e.role].name : '';
      if (e.what === 'wage') return { text: '일꾼 일당', amount: -e.fee };
      const who = `${role} ${e.name ?? ''}`;
      if (e.what === 'hire') return { text: `${townName(e.town)}에서 ${eulReul(who)} 고용했어요 (하루치 미리)`, amount: -e.fee };
      if (e.what === 'quit') return { text: `일당을 못 받은 ${iGa(who)} ${euro(townName(e.town))} 돌아갔어요`, amount: null };
      return { text: `${eulReul(who)} 내보냈어요`, amount: null };
    }
    case 'gathered': {
      const got = e.goods.map((g) => `${GOOD_NAME[g.good]} ${g.qty}`).join(', ');
      return { text: `채집꾼 ${e.name}: ${townName(e.town)} 창고에 ${got || '넣은 것 없음'}${e.lost ? ` (${e.lost}개는 둘 곳이 없어 버림)` : ''}`, amount: null };
    }
    case 'caravan':
      if (e.what === 'form') return { text: `${townName(e.town)}에서 두 번째 행렬을 꾸렸어요 (수레값)`, amount: -e.fee };
      if (e.what === 'disband') return { text: `두 번째 행렬을 풀고 수레를 팔았어요`, amount: -e.fee };
      if (e.what === 'travel') return { text: `두 번째 행렬이 ${townName(e.town)}에서 ${euro(townName(e.to ?? e.town))} 떠났어요`, amount: -e.fee };
      return { text: `두 번째 행렬이 ${townName(e.town)}에 도착했어요`, amount: null };
    case 'warehouse':
      return e.what === 'rent'
        ? { text: `${townName(e.town)} 창고 보관료`, amount: -e.fee }
        : { text: `보관료가 오래 밀려 ${townName(e.town)} 창고지기가 짐 ${e.lost ?? 0}개를 거둬 갔어요`, amount: null };
    case 'cart':
      return { text: `${townName(e.town)} 수레방에서 ${eulReul(CART.types[e.from].name)} ${euro(CART.types[e.to].name)} 바꿨어요`, amount: -e.price };
    case 'info': {
      const what = { drink: `${townName(e.town)} 여관에서 술 한 잔 (소문 하나)`, pigeon: `${townName(e.town)}에 전서구를 보냈어요`, informant: `${townName(e.town)} 정보원 품삯` }[e.what];
      return { text: what, amount: -e.fee };
    }
  }
}

/**
 * 짐 한 묶음의 신선도. 숫자 대신 상태로 보여 준다 (기획서 "물품").
 * rate는 오늘 계절의 상하는 배율 (여름 1.5, 겨울 0.5)
 */
export function freshness(lot: Lot, rate = 1): { text: string; level: 'fresh' | 'days' | 'soon' | 'keeps' } {
  const life = shelfLife(lot.good);
  if (life === null) return { text: '안 상해요', level: 'keeps' };
  if (lot.age + rate >= life) return { text: '곧 상함', level: 'soon' };
  if (lot.age < life * 0.4) return { text: '신선함', level: 'fresh' };
  return { text: '며칠 남음', level: 'days' };
}

/**
 * 어제 장날 분위기. 정확한 양은 숨기고 말로만 알린다 (기획서 "시장: 신청 현황 힌트").
 */
export function marketMood(demand: number, supply: number): string {
  if (demand === 0 && supply === 0) return '어제는 이 물건을 찾는 사람도 파는 사람도 없었어요.';
  if (supply === 0) return '어제는 사려는 사람만 있고 파는 사람이 없었어요.';
  if (demand === 0) return '어제는 팔려는 사람만 있고 사는 사람이 없었어요.';
  const r = demand / supply;
  if (r >= 2) return '어제는 사려는 사람이 팔려는 사람보다 훨씬 많았어요.';
  if (r >= 1.25) return '어제는 사려는 사람이 조금 더 많았어요.';
  if (r <= 0.5) return '어제는 팔려는 사람이 훨씬 많았어요.';
  if (r <= 0.8) return '어제는 팔려는 사람이 조금 더 많았어요.';
  return '어제는 사려는 사람과 팔려는 사람이 비슷했어요.';
}

export function goodName(g: GoodId): string {
  return GOOD_NAME[g];
}
