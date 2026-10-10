// 매일 나오는 신문 (0.1.3, 답 96): 큰 소식이 없는 날도 도시 시세 몇 줄과 날씨를 싣는다.
// 기사 줄에 구역을 붙인다: 구역이 없으면 큰 소식, 'prices'는 도시 시세, 'weather'는 날씨.
// 날씨는 시뮬에 따로 없어 계절과 지금 일어난 사건(가뭄, 폭풍)으로 고른다. 세계 난수를 쓰지 않아 다른 결과를 바꾸지 않는다.
import { ECONOMY } from '../constants';
import { GOOD_NAME, GOODS } from '../economy/goods';
import type { EconomyState, NewsItem } from '../economy/state';
import { createRng, mixSeed } from '../rng';
import type { Season } from '../season';
import type { WorldMap } from '../worldgen';

const N = ECONOMY.newspaper;

/** 계절마다 날씨 한 줄 (그날 시드로 하나). 0 봄, 1 여름, 2 가을, 3 겨울 */
const WEATHER: Record<Season, readonly string[]> = {
  0: ['봄볕이 따스합니다. 길이 질척이지만 다닐 만합니다.', '꽃샘추위가 아침저녁으로 매섭습니다.', '봄비가 촉촉이 내렸습니다.'],
  1: ['무더위가 이어집니다. 생선과 고기는 서둘러 파는 것이 좋겠습니다.', '소나기가 지나가고 하늘이 맑게 갰습니다.', '후텁지근한 바람이 붑니다.'],
  2: ['하늘이 높고 맑습니다. 길 떠나기 좋은 날씨입니다.', '아침 안개가 짙게 끼었습니다.', '선선한 바람에 낙엽이 날립니다.'],
  3: ['눈발이 날립니다. 길이 미끄러우니 조심하십시오.', '매서운 추위가 이어집니다.', '밤새 눈이 쌓였습니다. 길이 더딥니다.'],
};

/** 지금 일어난 사건이 날씨를 바꾼다 (사건 소식은 이미 신문에 났던 것이다) */
const EVENT_WEATHER: Partial<Record<string, string>> = {
  drought: '비 소식이 없습니다. 가뭄이 이어집니다.',
  storm: '바다에 거센 바람이 붑니다. 뱃길이 험합니다.',
};

/** 오늘 날씨 한 줄 */
export function weatherLine(state: EconomyState, season: Season): string {
  for (const e of state.events) {
    if (e.start > state.day || state.day > e.end) continue;
    const line = EVENT_WEATHER[e.event];
    if (line) return line;
  }
  return createRng(mixSeed(state.seed, 0x3ea7, state.day)).pick(WEATHER[season]);
}

/** 도시마다 시세 한 줄: 그날 장에서 많이 거래된 물품 몇 개와 맞춰진 값 (실린 값도 함께, 0.1.6) */
export function cityPriceLines(state: EconomyState, map: WorldMap): Pick<NewsItem, 'text' | 'town' | 'prices'>[] {
  const out: Pick<NewsItem, 'text' | 'town' | 'prices'>[] = [];
  for (const town of map.towns) {
    if (town.tier !== 'city') continue;
    const market = state.towns[town.id]!.lastMarket;
    const traded = GOODS.filter((g) => market[g].price !== null && market[g].volume > 0)
      .sort((a, b) => market[b].volume - market[a].volume || a.localeCompare(b))
      .slice(0, N.cityPriceGoods);
    out.push({
      text: traded.length
        ? `${town.name} 장 시세: ${traded.map((g) => `${GOOD_NAME[g]} ${market[g].price}골드`).join(', ')}`
        : `${town.name} 장은 한산했습니다.`,
      town: town.id,
      prices: Object.fromEntries(traded.map((g) => [g, market[g].price!])),
    });
  }
  return out;
}

/** 장날 뒤에: 오늘 신문의 날씨와 도시 시세 줄 (큰 소식 다음에 싣는다) */
export function dailyPaperLines(state: EconomyState, map: WorldMap, season: Season): NewsItem[] {
  return [
    { day: state.day, text: weatherLine(state, season), section: 'weather' },
    ...cityPriceLines(state, map).map((line): NewsItem => ({ day: state.day, section: 'prices', ...line })),
  ];
}

/** 신문 한 부의 머리기사: 큰 소식이 있으면 첫 큰 소식, 없으면 날씨 */
export function paperHeadline(items: readonly NewsItem[], day: number): string {
  const today = items.filter((n) => n.day === day);
  return (today.find((n) => !n.section) ?? today.find((n) => n.section === 'weather') ?? today[0])?.text ?? '';
}

/** 큰 소식만 (자리를 비운 사이와 알림은 큰 소식만 본다) */
export const bigNews = (n: NewsItem): boolean => !n.section;
