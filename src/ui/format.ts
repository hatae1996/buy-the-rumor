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
  noRoom: '짐칸이 모자라요.',
  noOrder: '이미 없는 신청이에요.',
  sameTown: '이미 이 마을에 있어요.',
  noTown: '없는 마을이에요.',
  noRoute: '그 마을로 가는 길이 없어요.',
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
  }
}

/** 짐 한 묶음의 상태: "2일 뒤 상해요" / "오래가요" */
export function freshness(lot: Lot): { text: string; urgent: boolean } {
  const life = shelfLife(lot.good);
  if (life === null) return { text: '안 상해요', urgent: false };
  const left = life - lot.age;
  if (left <= 1) return { text: '내일 상해요', urgent: true };
  return { text: `${left}일 뒤 상해요`, urgent: left <= 2 };
}

export function goodName(g: GoodId): string {
  return GOOD_NAME[g];
}
