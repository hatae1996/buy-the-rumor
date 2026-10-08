// 큰 사건: 폭풍, 늑대, 새 광맥, 수요 급증. 신문에 사실만 싣는다.
import { ECONOMY } from '../constants';
import type { Rng } from '../rng';
import type { WorldMap } from '../worldgen';
import { eulReul } from '../josa';
import { GOOD_NAME, type GoodId } from './goods';
import { findNode } from './nodes';
import type { EconomyState, TownEconomy } from './state';

const E = ECONOMY.events;
const BOOST_GOODS: readonly GoodId[] = ['wood', 'tools', 'leather', 'salted'];

type Happening = (town: TownEconomy, name: string) => string | null;

const HAPPENINGS: Happening[] = [
  (town, name) => {
    if (!findNode(town, 'fish')) return null;
    town.storm = E.stormDays;
    return `${name} 앞바다에 폭풍이 몰아칩니다. ${E.stormDays}일 동안 고기잡이를 못 합니다.`;
  },
  (town, name) => {
    const forest = findNode(town, 'forest');
    if (!forest) return null;
    forest.amount *= E.wolvesFactor;
    return `늑대 무리가 ${name} 숲을 덮쳤습니다. 사냥감이 크게 줄었습니다.`;
  },
  (town, name) => {
    const ore = findNode(town, 'ore');
    if (!ore) return null;
    const more = E.newVeinTiles * ECONOMY.node.capacityPerTile;
    ore.capacity += more;
    ore.amount += more;
    ore.tiles += E.newVeinTiles;
    return `${name}에서 새 광맥이 발견됐습니다.`;
  },
];

export function rollEvents(state: EconomyState, map: WorldMap, rng: Rng): string[] {
  if (rng.next() >= E.dailyChance) return [];
  const town = state.towns[rng.int(0, state.towns.length - 1)]!;
  const name = map.towns[town.id]!.name;
  // 넷 중 하나는 수요 급증, 나머지는 자원 사건 (그 마을에 맞는 자원지가 없으면 수요 급증)
  const pick = rng.int(0, HAPPENINGS.length);
  const text = pick < HAPPENINGS.length ? HAPPENINGS[pick]!(town, name) : null;
  if (text) return [text];
  const good = BOOST_GOODS[rng.int(0, BOOST_GOODS.length - 1)]!;
  town.boosts.push({ good, factor: E.boostFactor, daysLeft: E.boostDays });
  return [`${name}에서 ${eulReul(GOOD_NAME[good])} 찾는 사람이 크게 늘었습니다. ${E.boostDays}일쯤 이어질 것 같습니다.`];
}
