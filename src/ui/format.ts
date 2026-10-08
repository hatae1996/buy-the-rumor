// 화면 문구. 처음 하는 사람에게 전문 용어를 보이지 않는다 ("동시호가" 대신 "장날").
import { shelfLife, GOOD_NAME, type CommandError, type GoodId, type LedgerEntry, type Lot } from '../sim/economy';
import { SEASON_NAME, type Season } from '../sim/season';

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
};

/** 장부 한 줄: 글과 돈 변화 */
export function ledgerLine(e: LedgerEntry, townName: (id: number) => string): { text: string; amount: number | null } {
  switch (e.kind) {
    case 'buy':
      return { text: `${townName(e.town)}에서 ${GOOD_NAME[e.good]} ${e.qty}개 샀어요 (개당 ${e.price})`, amount: -e.qty * e.price };
    case 'sell':
      return { text: `${townName(e.town)}에서 ${GOOD_NAME[e.good]} ${e.qty}개 팔았어요 (개당 ${e.price})`, amount: e.qty * e.price };
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
