// 인장(뱃지) 목록 (기획서 "뱃지 (인장)", 시안 prototypes/id-card.html).
// 의뢰 인장은 길드 의뢰마다(quests.ts), 랭킹 인장은 부문마다, 업적은 이야기가 되는 순간에, 기념은 시즌 완주에.
// 업적은 반복만 하면 얻는 것(원정 100번)을 두지 않는다. 판단이나 운이 만든 이야기에만 준다.
import { GOOD_NAME, GOODS } from '../economy/goods';
import { THEMES } from './quests';
import type { BadgeDef, CategoryId, MomentId } from './types';

const CATEGORY_NAME: Record<string, string> = {
  bigShot: '큰손',
  multiplier: '수완가',
  oneShot: '한 방',
  buyTheRumor: 'Buy the Rumor',
};

export function categoryName(id: CategoryId): string {
  if (id.startsWith('goodsKing:')) return `${GOOD_NAME[id.slice('goodsKing:'.length) as keyof typeof GOOD_NAME]}왕`;
  return CATEGORY_NAME[id]!;
}

export const CATEGORIES: readonly CategoryId[] = ['bigShot', 'multiplier', 'oneShot', 'buyTheRumor', ...GOODS.map((g) => `goodsKing:${g}` as const)];

/** 랭킹 인장: 부문마다 1위, 상위 3명, 상위 10% (그 시즌만) */
export const RANKING_PLACES = [
  { id: 'first', name: '1위', top: 1 },
  { id: 'top3', name: '상위 3명', top: 3 },
  { id: 'top10', name: '상위 10%', topShare: 0.1 },
] as const;

/**
 * 업적 인장: 언제나 얻을 수 있다. 일부는 숨김.
 * 조건은 시즌 기록의 순간(MomentId)이나 순자산 흐름으로 잰다 (record.ts의 checkAchievements)
 */
export interface AchievementDef extends BadgeDef {
  kind: 'achievement';
  /** 이 순간이 이만큼이면 */
  moment?: { id: MomentId; count: number };
  /** 순자산이 시작의 절반 아래로 떨어졌다가 시작보다 위로 돌아오면 (오뚝이) */
  comeback?: true;
  /** Buy the Rumor 이익이 난 적이 있으면 */
  rumorProfit?: true;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'comeback', name: '오뚝이', kind: 'achievement', how: '순자산이 시작의 절반 아래로 떨어졌다가 시즌 안에 시작보다 위로 돌아오기', comeback: true },
  { id: 'bearChaser', name: '곰 쫓는 상인', kind: 'achievement', how: '원정에서 횃불로 곰을 쫓아내기', moment: { id: 'bearTorch', count: 1 } },
  { id: 'firstHorse', name: '첫 말', kind: 'achievement', how: '처음으로 말을 사기', moment: { id: 'firstHorse', count: 1 } },
  { id: 'keenEar', name: '귀가 밝은 상인', kind: 'achievement', how: '한 시즌에 수첩에 "맞았다" 도장 10개', moment: { id: 'rumorRight', count: 10 } },
  { id: 'stormSailor', name: '폭풍 속 어부', kind: 'achievement', how: '거센 파도에 배를 띄워 고기를 잡기', hidden: true, moment: { id: 'stormSail', count: 1 } },
  { id: 'wolfRider', name: '말 덕분에', kind: 'achievement', how: '곰이나 늑대 앞에서 말을 타고 빠져나오기', hidden: true, moment: { id: 'horseEscape', count: 1 } },
  { id: 'trapLuck', name: '덫의 행운', kind: 'achievement', how: '놓아 둔 덫에 걸린 것을 거두기', hidden: true, moment: { id: 'trapLuck', count: 1 } },
  { id: 'earlyBird', name: '소문보다 빠른 발', kind: 'achievement', how: '소문을 듣고 신문 전에 사서 신문 뒤에 팔아 이익 내기', hidden: true, rumorProfit: true },
];

/** 기념 인장: 시즌 완주 (시즌마다 다른 모양) */
export const memorialBadge = (season: number): BadgeDef => ({ id: `season-${season}`, name: `${season}시즌`, kind: 'memorial', how: `${season}시즌 완주` });

/** 테스터 전용 인장 (handoff 0.2.0 6번): 비공개 테스트 시즌에 하루라도 들어온 사람. 정식 출시 때 초기화하지 않는다 */
export const PIONEER_BADGE: BadgeDef = { id: 'pioneer', name: '개척 상인', kind: 'memorial', how: '비공개 테스트 시즌을 함께한 상인' };

/** 랭킹 인장 하나 */
export const rankingBadge = (category: CategoryId, place: (typeof RANKING_PLACES)[number]['id']): BadgeDef => ({
  id: `rank-${category}-${place}`,
  name: `${categoryName(category)} ${RANKING_PLACES.find((p) => p.id === place)!.name}`,
  kind: 'ranking',
  how: `시즌 결과 ${categoryName(category)} 부문 ${RANKING_PLACES.find((p) => p.id === place)!.name}`,
});

/** 의뢰 인장 (테마의 의뢰마다 하나, 동·은·금은 단계) */
export const QUEST_BADGES: readonly BadgeDef[] = THEMES.flatMap((t) =>
  t.quests.map((q) => ({ id: `quest-${q.id}`, name: q.name, kind: 'quest' as const, how: `${t.name} 길드 의뢰: ${q.text}` })),
);

/** 인장 하나 찾기 (의뢰, 업적, 랭킹, 기념) */
export function badgeDef(id: string): BadgeDef | null {
  const found = [...QUEST_BADGES, ...ACHIEVEMENTS, PIONEER_BADGE].find((b) => b.id === id);
  if (found) return found;
  const season = /^season-(\d+)$/.exec(id);
  if (season) return memorialBadge(Number(season[1]));
  const rank = /^rank-(.+)-(first|top3|top10)$/.exec(id);
  if (rank && CATEGORIES.includes(rank[1] as CategoryId)) return rankingBadge(rank[1] as CategoryId, rank[2] as 'first');
  return null;
}
