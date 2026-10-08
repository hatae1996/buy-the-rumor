// 길드 의뢰 (기획서 "길드 의뢰 (확정)", 시안 prototypes/id-card.html): 시즌마다 테마 하나, 테마마다 의뢰 3~5개.
// 개인 의뢰는 평소처럼 장사하면 깨는 정도로, 공동 의뢰는 서버 전체가 함께 채운다. 같은 의뢰도 동·은·금이 있다.
// 숫자는 모두 초안. 납품은 그 물품을 장에 파는 것으로 센다 (납품이 실제 수요가 되어 가격을 움직인다).
import { createRng, mixSeed } from '../rng';
import { AUTUMN, SPRING, SUMMER, WINTER, type Season } from '../season';
import type { QuestDef, ThemeDef } from './types';

export const THEMES: readonly ThemeDef[] = [
  {
    id: 'frost',
    name: '혹한의 시즌',
    seasons: [AUTUMN, WINTER],
    quests: [
      { id: 'winterFood', name: '겨울 식량', scope: 'personal', text: '겨울 동안 염장 식품 납품', measure: { kind: 'sold', goods: ['salted'], seasons: [WINTER] }, tiers: [10, 25, 50] },
      { id: 'wolfRoad', name: '늑대 길', scope: 'personal', text: '늑대 무리를 짐을 잃지 않고 지나기', measure: { kind: 'moment', moment: 'wolfSafe' }, tiers: [1, 2, 3] },
      { id: 'iceFisher', name: '얼음 낚시꾼', scope: 'personal', text: '얼어붙은 물에서 생선 얻기', measure: { kind: 'moment', moment: 'iceFishing' }, tiers: [1, 3, 6] },
      { id: 'towerFire', name: '성탑의 불', scope: 'communal', text: '모두 함께 도시에 목재 납품', measure: { kind: 'sold', goods: ['wood'], tier: 'city' }, tiers: [1000, 2000, 3000] },
    ],
  },
  {
    id: 'bountySea',
    name: '풍어의 시즌',
    seasons: [SPRING, SUMMER],
    needs: 'fish',
    quests: [
      { id: 'silverRun', name: '은빛 떼', scope: 'personal', text: '은빛 떼를 그물에 담기', measure: { kind: 'moment', moment: 'silverRun' }, tiers: [1, 2, 4] },
      { id: 'curingMaster', name: '염장 장인', scope: 'personal', text: '염장 식품 납품', measure: { kind: 'sold', goods: ['salted'] }, tiers: [15, 40, 80] },
      { id: 'saltMagnate', name: '소금 거상', scope: 'personal', text: '소금 납품', measure: { kind: 'sold', goods: ['salt'] }, tiers: [30, 80, 150] },
      { id: 'newShip', name: '새 상선', scope: 'communal', text: '모두 함께 목재와 도구 납품', measure: { kind: 'sold', goods: ['wood', 'tools'] }, tiers: [1500, 3000, 5000] },
    ],
  },
  {
    id: 'drought',
    name: '대가뭄의 시즌',
    seasons: [SPRING, SUMMER],
    needs: 'field',
    quests: [
      { id: 'dryBread', name: '마른 땅의 빵', scope: 'personal', text: '여름 동안 곡물 납품', measure: { kind: 'sold', goods: ['grain'], seasons: [SUMMER] }, tiers: [20, 50, 100] },
      { id: 'deepWell', name: '깊은 우물', scope: 'communal', text: '모두 함께 도시에 도구 납품', measure: { kind: 'sold', goods: ['tools'], tier: 'city' }, tiers: [200, 400, 800] },
      { id: 'thriftyCook', name: '아끼는 부엌', scope: 'personal', text: '염장 식품 납품', measure: { kind: 'sold', goods: ['salted'] }, tiers: [10, 25, 50] },
    ],
  },
  {
    id: 'war',
    name: '전쟁의 시즌',
    seasons: [AUTUMN, WINTER, SPRING, SUMMER],
    needs: 'ore',
    quests: [
      { id: 'armySupply', name: '군대 보급', scope: 'personal', text: '염장 식품과 가죽 납품', measure: { kind: 'sold', goods: ['salted', 'leather'] }, tiers: [20, 50, 100] },
      { id: 'smithFriend', name: '대장장이의 벗', scope: 'personal', text: '광석 납품', measure: { kind: 'sold', goods: ['ore'] }, tiers: [20, 60, 120] },
      { id: 'cityWall', name: '성벽 보수', scope: 'communal', text: '모두 함께 도시에 광석과 목재 납품', measure: { kind: 'sold', goods: ['ore', 'wood'], tier: 'city' }, tiers: [1500, 3000, 5000] },
    ],
  },
];

export const themeDef = (id: string): ThemeDef | null => THEMES.find((t) => t.id === id) ?? null;

export function questDef(id: string): { theme: ThemeDef; quest: QuestDef } | null {
  for (const theme of THEMES) {
    const quest = theme.quests.find((q) => q.id === id);
    if (quest) return { theme, quest };
  }
  return null;
}

/**
 * 시즌 테마: 시작 계절과 맵(자원지)에 어울리는 것 중 시드로 하나.
 * 사건 일정과 다른 난수를 써서 일정이 바뀌지 않는다
 */
export function pickTheme(seed: number, season: number, startSeason: Season, resources: ReadonlySet<string>): string {
  // 맵에 없는 자원지를 쓰는 테마는 빼고, 그중 시작 계절에 어울리는 것. 계절이 안 맞으면 맵만 맞는 것
  const mapOk = THEMES.filter((t) => !t.needs || resources.has(t.needs));
  const fits = mapOk.filter((t) => !t.seasons || t.seasons.includes(startSeason));
  const pool = fits.length ? fits : mapOk.length ? mapOk : THEMES;
  return createRng(mixSeed(seed, 0x7e3e, season)).pick(pool).id;
}
