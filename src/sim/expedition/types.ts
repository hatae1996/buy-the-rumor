// 원정 카드 데이터 모양 (기획서 "채집: 원정 카드"). 카드는 코드가 아니라 데이터로 둔다.
import type { GoodId } from '../economy/goods';
import type { Season } from '../season';
import type { RegionTagId, ResourceKind } from '../worldgen';

/** 신문에 실린 마을 사건 (사건 카드를 부른다) */
export type TownEventKind = 'storm' | 'wolves' | 'newVein' | 'boost';

/** 카드가 덱에 들어오는 조건 */
export type CardSource =
  | { kind: 'terrain'; resource: ResourceKind }
  | { kind: 'tag'; tag: RegionTagId }
  | { kind: 'season'; season: Season; resource: ResourceKind }
  | { kind: 'event'; event: TownEventKind }
  /** 다른 카드가 넣어 줄 때만 (연결 카드) */
  | { kind: 'linked' }
  /** 내가 지난 원정에 남긴 것 (놓아 둔 덫 등) */
  | { kind: 'mine' };

/** 소문 종류. 내용은 실제 세계 상태를 보고 만든다 (가끔 틀린다) */
export type RumorTopic = 'deer' | 'fish' | 'ore' | 'harvest' | 'market';

export type Effect =
  /** 물건을 얻는다. 줄어드는 자원지에서 나는 것이면 그 자원지 남은 양에 따라 줄고, 얻은 만큼 자원지가 준다 */
  | { kind: 'goods'; good: GoodId; min: number; max: number; from?: ResourceKind }
  /** 지금까지 모은 짐 중 일부를 잃는다 */
  | { kind: 'loseHaul'; good?: GoodId; fraction: number }
  | { kind: 'rumor'; topic: RumorTopic }
  /** 다음에 뽑을 카드로 넣는다 */
  | { kind: 'link'; card: string }
  /** 다음 원정 덱에 넣을 카드를 이 마을에 남긴다 */
  | { kind: 'leave'; card: string }
  /** 원정을 여기서 끝낸다 */
  | { kind: 'end' }
  /** 남은 카드를 줄인다 (쉬느라 시간을 썼다) */
  | { kind: 'skip'; cards: number }
  /** 돈을 낸다 (통행세 등). 경제에서 빠져나간다 */
  | { kind: 'pay'; gold: number };

export interface Chance {
  base: number;
  /** 이 자원지 남은 양이 많을수록 잘 된다 (줄어드는 자원지만) */
  node?: ResourceKind;
  nodeWeight?: number;
}

export interface Choice {
  label: string;
  /** 쌓이는 피로 (음수면 쉰다) */
  fatigue: number;
  /** 없으면 늘 성공 */
  chance?: Chance;
  success: Effect[];
  failure?: Effect[];
}

export interface CardDef {
  id: string;
  title: string;
  text: string;
  sources: CardSource[];
  /** 덱에 몇 장 넣나 (기본 1) */
  copies?: number;
  choices: [Choice, Choice];
}
