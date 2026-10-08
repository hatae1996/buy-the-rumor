// 원정 카드 데이터 모양 (기획서 "채집: 원정 카드"). 카드는 코드가 아니라 데이터로 둔다.
import type { GoodId } from '../economy/goods';
import type { Season } from '../season';
import type { RegionTagId, ResourceKind } from '../worldgen';

/** 신문에 실린 마을 사건 (사건 카드를 부른다). boost는 조선소·성 보수·군대·축제처럼 사람이 몰리는 일 */
export type TownEventKind =
  | 'storm'
  | 'wolves'
  | 'newVein'
  | 'boost'
  | 'landslide'
  | 'mineCollapse'
  | 'animalSickness'
  | 'drought'
  | 'bigCatch'
  | 'bumperHarvest'
  | 'bandits'
  | 'ranchFire'
  | 'caravan';

/** 장비 (기획서 "장비"): 잡화점에서 사고, 쓰다 보면 망가지고, 도구로 고친다 */
export type GearKind = 'bow' | 'torch' | 'trap' | 'net';

/** 카드가 덱에 들어오는 조건 */
export type CardSource =
  | { kind: 'terrain'; resource: ResourceKind }
  | { kind: 'tag'; tag: RegionTagId }
  | { kind: 'season'; season: Season; resource: ResourceKind }
  | { kind: 'event'; event: TownEventKind }
  /** 다른 카드가 넣어 줄 때만 (연결 카드) */
  | { kind: 'linked' }
  /** 내가 지난 원정에 남긴 것 (놓아 둔 덫 등) */
  | { kind: 'mine' }
  /** 말과 함께 갔을 때 (내 카드) */
  | { kind: 'horse' };

/** 소문 종류. 직접 본 것이라 늘 맞다. horse는 다음 말 입고 (풀린 망아지를 돌려줄 때) */
export type RumorTopic = 'deer' | 'fish' | 'ore' | 'harvest' | 'market' | 'horse';

/** 이번 원정에만 붙는 상태 (계절 카드 등) */
export type ExpeditionFlag =
  /** 무더위: 생선과 고기가 빨리 상한다 */
  | 'heat'
  /** 눈 덮인 길: 모든 카드의 피로 +1 */
  | 'snow'
  /** 살찐 사슴: 사슴 카드의 고기 +1 */
  | 'fatDeer'
  /** 수확철: 농부를 도우면 곡물 +1 */
  | 'harvest'
  /** 말에 싣는다: 얻는 물품마다 +1 */
  | 'packHorse';

/** 얻는 양이 늘어나는 조건 */
export type GoodsBoost = 'net' | 'deer' | 'farm';

export type Effect =
  /**
   * 물건을 얻는다. 줄어드는 자원지에서 나는 것이면 그 자원지 남은 양에 따라 줄고, 얻은 만큼 자원지가 준다.
   * boost: net이면 그물이 있을 때 +1, deer면 살찐 사슴일 때 +1, farm이면 수확철에 +1
   */
  | { kind: 'goods'; good: GoodId; min: number; max: number; from?: ResourceKind; boost?: GoodsBoost }
  /** 지금까지 모은 짐 중 일부를 잃는다 (위험) */
  | { kind: 'loseHaul'; good?: GoodId; fraction: number }
  /** 다친다: 피로가 크게 오른다 (위험) */
  | { kind: 'hurt' }
  /** 장비가 망가진다 (위험): 남은 횟수가 준다 */
  | { kind: 'breakGear'; gear: GearKind; uses: number }
  /** 이 확률로만 일어난다 */
  | { kind: 'maybe'; chance: number; effects: Effect[] }
  /** 여러 결과 중 하나 */
  | { kind: 'oneOf'; options: Effect[][] }
  | { kind: 'rumor'; topic: RumorTopic }
  /** 다음에 뽑을 카드로 넣는다 */
  | { kind: 'link'; card: string }
  /** 다음 원정 덱에 넣을 카드를 이 마을에 남긴다 */
  | { kind: 'leave'; card: string }
  /** 원정을 여기서 끝낸다 */
  | { kind: 'end' }
  /** 남은 카드를 줄인다 (쉬느라 시간을 썼다) */
  | { kind: 'skip'; cards: number }
  /** 카드를 더 본다 (깊이 들어간다) */
  | { kind: 'more'; cards: number }
  /** 이번 원정에 상태를 붙인다 */
  | { kind: 'flag'; flag: ExpeditionFlag }
  /** 돈을 낸다 (통행세 등). 경제에서 빠져나간다 */
  | { kind: 'pay'; gold: number }
  /** 일해서 돈을 받는다 (목장 일손). 그 마을 금고에서 나온다 */
  | { kind: 'earn'; gold: number }
  /** 놓아 둔 덫을 확인한다: 오래 비우면 다른 짐승이 먹어 버린다 */
  | { kind: 'trapCatch' };

export interface Chance {
  base: number;
  /** 이 자원지 남은 양이 많을수록 잘 된다 (줄어드는 자원지만) */
  node?: ResourceKind;
  nodeWeight?: number;
}

/**
 * 고를 수 있는 조건: tool은 도구를 쓰고, gear·horse는 그 장비나 말이 있어야 한다.
 * 왼쪽·오른쪽 선택지는 조건이 안 맞아도 보이되 고를 수 없고,
 * 셋째부터 덧붙은 선택지는 조건이 맞을 때만 보인다 (기획서 "장비가 선택지를 연다")
 */
export interface ChoiceNeeds {
  tool?: number;
  gear?: GearKind;
  horse?: boolean;
}

export interface Choice {
  label: string;
  needs?: ChoiceNeeds;
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
  /** 왼쪽·오른쪽 두 개. 장비나 말이 있어야 보이는 선택지가 뒤에 더 붙을 수 있다 */
  choices: [Choice, Choice, ...Choice[]];
  /** 위험한 카드: 안내인이 있으면 한 장 건너뛴다 */
  danger?: boolean;
  /** 이 카드가 덱에 들어오면 다른 카드도 바뀐다 (막힌 갱도: 광맥 줄기 −1, 무너진 갱도 +1) */
  deckChange?: { add?: Record<string, number>; remove?: Record<string, number> };
  /** 말과 함께 갔을 때만 덱에 들어온다 */
  needsHorse?: boolean;
}
