// 원정에서 듣는 소문. 실제 세계 상태를 보고 만들지만 가끔 틀린다 (기획서 "정보 시스템": 부정확하게 안다).
import { GOOD_NAME, GOODS, basePrice, type GoodId } from '../economy/goods';
import { findNode } from '../economy/nodes';
import type { EconomyState } from '../economy/state';
import { eulReul, iGa } from '../josa';
import type { Rng } from '../rng';
import { seasonOfDay } from '../season';
import type { WorldMap } from '../worldgen';
import type { RumorTopic } from './types';

/** 소문이 틀릴 확률 */
export const RUMOR_WRONG_CHANCE = 0.2;

export function makeRumor(topic: RumorTopic, state: EconomyState, map: WorldMap, townId: number, rng: Rng): string {
  const town = state.towns[townId]!;
  const name = map.towns[townId]!.name;
  const wrong = rng.next() < RUMOR_WRONG_CHANCE;
  const plenty = (kind: 'forest' | 'fish' | 'ore') => {
    const node = findNode(town, kind);
    const rich = node ? node.amount / node.capacity > 0.6 : false;
    return wrong ? !rich : rich;
  };
  switch (topic) {
    case 'deer':
      return plenty('forest')
        ? `"${name} 숲에 사냥감이 넉넉하다더군."`
        : `"요즘 ${name} 사냥꾼들이 빈손으로 돌아온다더라."`;
    case 'fish':
      return plenty('fish') ? `"올해 ${name} 앞바다엔 고기가 많다더군."` : `"${name} 앞바다 고기가 예전 같지 않다더라."`;
    case 'ore':
      return plenty('ore') ? `"${name} 광맥이 아직 실하다더군."` : `"${name} 광맥이 바닥을 보인다더라."`;
    case 'harvest': {
      const season = seasonOfDay(state.day, state.startSeason);
      const lines = [
        '"씨 뿌리는 철이라 가을까지 곡물이 귀할 거라더군."',
        '"올여름 밀이 잘 자란다더라."',
        '"가을걷이가 한창이라 곡물이 넘쳐 난다더군."',
        '"겨울이라 곡물 창고가 비어 간다더라."',
      ];
      return lines[wrong ? (season + 2) % 4 : season]!;
    }
    case 'market': {
      // 다른 마을 하나를 골라, 기준 가격보다 가장 비싼 물건을 말한다 (틀리면 아무 물건)
      const others = state.towns.filter((t) => t.id !== townId);
      const there = others[rng.int(0, others.length - 1)]!;
      const dear = (g: GoodId) => there.refPrice[g] / basePrice(g);
      const good = wrong ? GOODS[rng.int(0, GOODS.length - 1)]! : [...GOODS].sort((a, b) => dear(b) - dear(a))[0]!;
      return `"${iGa(map.towns[there.id]!.name)} ${eulReul(GOOD_NAME[good])} 비싸게 산다더군."`;
    }
  }
}
