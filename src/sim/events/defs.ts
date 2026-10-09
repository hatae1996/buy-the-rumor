// 사건 목록 (기획서 "사건 목록 (초안)"과 "반응 사건"). 숫자는 모두 초안이며 여기 한곳에서 맞춘다.
// 신문 문장은 사실만 싣는다: "산사태가 났다"까지만, "그러니 목재가 비싸질 것"은 쓰지 않는다.
import { GOOD_NAME, type GoodId } from '../economy/goods';
import type { JobId } from '../economy/jobs';
import { eulReul } from '../josa';
import { AUTUMN, SPRING, SUMMER, WINTER } from '../season';
import type { EventDef, EventId } from './types';

const NOT_WINTER = [SPRING, SUMMER, AUTUMN] as const;

const name = (good: GoodId | null) => (good ? GOOD_NAME[good] : '물건');

/** 일을 줄인 일꾼들 (기획서 예: "어부들이 그물을 거뒀다") */
const QUIT_TEXT: Record<JobId, string> = {
  fisher: '어부들이 그물을 거뒀습니다.',
  hunter: '사냥꾼들이 사냥을 줄였습니다.',
  farmer: '농부들이 밭일을 줄였습니다.',
  woodcutter: '나무꾼들이 도끼질을 줄였습니다.',
  miner: '광부들이 갱도 몇 곳을 닫았습니다.',
  salter: '염전 일꾼들이 소금밭 몇 곳을 쉬게 했습니다.',
  curer: '염장꾼들이 일을 줄였습니다.',
  smith: '대장장이들이 화덕 몇 곳을 껐습니다.',
};

/** 일꾼이 몰려가는 곳 (기획서 예: "모두 광산으로 간다") */
const RUSH_PLACE: Record<JobId, string> = {
  fisher: '바다로',
  hunter: '사냥터로',
  farmer: '들판으로',
  woodcutter: '숲으로',
  miner: '광산으로',
  salter: '염전으로',
  curer: '염장 공방으로',
  smith: '대장간으로',
};

/**
 * 큰 주문 사건이 일정에 뽑히는 무게 (다른 사건은 1). 계절별 [봄, 여름, 가을, 겨울].
 * 겨울은 장이 얇아 노릴 거리가 적으니 큰 주문이 더 잘 뽑힌다 (0.0.8). 시즌 전체로는 2~4번.
 * 봄에는 봄 구휼이 큰 주문 몫을 나눠 가지므로 다른 큰 주문은 덜 뽑힌다 (0.0.9: 겨울이 여전히 가장 많게)
 */
const BIG_ORDER_WEIGHT = [0.6, 1, 1, 2.6] as const;
/** 군대 보급은 겨울에 몰린다 */
const ARMY_WEIGHT = [0.5, 0.8, 0.8, 4] as const;
/** 도시 하나에서만 나는 축제는 생산 마을 셋에서 나는 사건과 비슷하게 뽑히도록 무게를 키운다 (큰 맵은 schedule.ts의 weightOf가 도시 하나가 맡는 생산 마을 수로 다시 맞춘다) */
const CITY_FESTIVAL_WEIGHT = 2.5;
const WINTER_FESTIVAL_WEIGHT = 8;
/** 봄 구휼 (0.0.9): 마을 하나 몫의 무게. 시즌 절반쯤에 한 번 (시드 40개 × 시작 계절 4개에서 시즌 0.53번) */
const RELIEF_WEIGHT = 3;

export const EVENT_DEFS: readonly EventDef[] = [
  // ───── 공급 ↓ ─────
  {
    id: 'landslide',
    name: '산사태',
    category: 'supplyDown',
    scope: 'town',
    needs: { resource: 'ore', highlandRoad: true },
    seasons: [SPRING, SUMMER, AUTUMN],
    effects: [
      { kind: 'produce', good: 'ore', factor: 0.5 },
      { kind: 'blockRoads', terrain: 'highland', count: 'all' },
    ],
    days: 2,
    omen: '산에 비가 열흘째 온다더군.',
    news: ({ town: t }) => `${t} 가는 산길에 산사태가 났습니다. 산길이 막혔습니다.`,
    deck: 'landslide',
  },
  {
    id: 'mineCollapse',
    name: '광산 붕괴',
    category: 'supplyDown',
    scope: 'town',
    needs: { resource: 'ore' },
    effects: [
      { kind: 'produce', good: 'ore', factor: 0.5 },
      { kind: 'jobIncome', job: 'miner', factor: 0.5 },
    ],
    days: 3,
    omen: '갱도에서 이상한 소리가 난다더라.',
    news: ({ town: t }) => `${t} 광산 갱도 하나가 무너졌습니다.`,
    deck: 'mineCollapse',
  },
  {
    id: 'wolves',
    name: '늑대 출몰',
    category: 'supplyDown',
    scope: 'town',
    needs: { resource: 'forest' },
    // 겨울에 잦다
    weight: [1, 0.6, 1, 2.5],
    effects: [
      { kind: 'produce', good: 'meat', factor: 0.5 },
      { kind: 'produce', good: 'leather', factor: 0.5 },
      { kind: 'node', resource: 'forest', amountFactor: 0.8 },
    ],
    days: 3,
    omen: '밤마다 늑대 울음소리가 들린다더군.',
    news: ({ town: t }) => `늑대 무리가 ${t} 숲에 나타났습니다.`,
    deck: 'wolves',
  },
  {
    id: 'animalSickness',
    name: '짐승 병',
    category: 'supplyDown',
    scope: 'town',
    needs: { resource: 'forest' },
    effects: [{ kind: 'saleBan', good: 'meat' }],
    days: 2,
    omen: null,
    news: ({ town: t }) => `${t} 숲 짐승 사이에 병이 돕니다. 이틀 동안 그 마을 장에서 고기를 팔 수 없습니다.`,
    deck: 'animalSickness',
  },
  {
    id: 'drought',
    name: '가뭄',
    category: 'supplyDown',
    scope: 'nearby',
    needs: { resource: 'field' },
    seasons: [SUMMER],
    effects: [{ kind: 'produce', good: 'grain', factor: 0.75 }],
    days: 'season',
    omen: '비가 통 안 온다더라.',
    news: ({ town: t }) => `${t} 일대에 가뭄이 들었습니다.`,
    deck: 'drought',
  },
  {
    id: 'storm',
    name: '폭풍',
    category: 'supplyDown',
    scope: 'town',
    needs: { resource: 'fish' },
    seasons: NOT_WINTER,
    effects: [
      { kind: 'produce', good: 'fish', factor: 0 },
      // 배를 고치느라 목재를 찾는다
      { kind: 'demand', good: 'wood', extra: 3 },
    ],
    days: 2,
    omen: '하늘이 수상하다더군.',
    news: ({ town: t }) => `${t} 앞바다에 폭풍이 몰아칩니다. 고기잡이배가 모두 묶였습니다.`,
    deck: 'storm',
  },
  {
    id: 'ranchFire',
    name: '목장 화재',
    category: 'supplyDown',
    scope: 'town',
    needs: { tag: 'ranch' },
    effects: [{ kind: 'horseDelay', days: 4 }],
    days: 4,
    omen: null,
    news: ({ town: t }) => `${t} 목장에 불이 났습니다.`,
    deck: 'ranchFire',
  },

  // ───── 공급 ↑ ─────
  {
    id: 'bigCatch',
    name: '풍어',
    category: 'supplyUp',
    scope: 'town',
    needs: { resource: 'fish' },
    seasons: NOT_WINTER,
    effects: [{ kind: 'produce', good: 'fish', factor: 2 }],
    days: 2,
    omen: '갈매기가 엄청 많이 몰려왔다더라.',
    news: ({ town: t }) => `${t} 앞바다에 물고기 떼가 몰려왔습니다.`,
    deck: 'bigCatch',
  },
  {
    id: 'bumperHarvest',
    name: '풍년',
    category: 'supplyUp',
    scope: 'town',
    needs: { resource: 'field' },
    seasons: [AUTUMN],
    effects: [{ kind: 'produce', good: 'grain', factor: 1.5 }],
    days: 3,
    omen: '올해 이삭이 무겁다더군.',
    news: ({ town: t }) => `${t} 들판에 풍년이 들었습니다.`,
    deck: 'bumperHarvest',
  },
  {
    id: 'newVein',
    name: '새 광맥 발견',
    category: 'supplyUp',
    scope: 'town',
    needs: { resource: 'ore' },
    effects: [
      { kind: 'node', resource: 'ore', addTiles: 1 },
      { kind: 'produce', good: 'ore', factor: 1.3 },
    ],
    days: 'season',
    omen: '누가 노천 광맥을 봤다더라.',
    // 헛소문이 많다
    fakeOmenWeight: 3,
    news: ({ town: t }) => `${t}에서 새 광맥이 발견됐습니다.`,
    deck: 'newVein',
  },

  // ───── 수요 ↑ ─────
  // 큰 주문 (0.0.7 "큰 벌이는 사건에서 온다"): 정해진 기간 동안 한 물품을 많이, 기준 가격보다 비싸게 사들인다.
  // 시즌에 2~4번 나오도록 다른 사건보다 조금 더 잘 뽑히고, 겨울에 더 잘 뽑힌다 (BIG_ORDER_WEIGHT, 0.0.8).
  // 징조가 늘 일찍(8~12일 전) 돌아서, 듣고 미리 쌓아 둔 사람이 크게 번다. 숫자는 초안
  {
    id: 'shipyard',
    name: '조선소 대형 상선',
    category: 'demandUp',
    scope: 'town',
    needs: { resource: 'fish' },
    effects: [
      { kind: 'bigOrder', good: 'wood', qty: 200, factor: 1.6 },
      { kind: 'demand', good: 'tools', extra: 1 },
    ],
    days: 8,
    omen: '조선소에 목수가 모인다더군.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: BIG_ORDER_WEIGHT,
    news: ({ town: t }) => `${t} 조선소가 큰 상선을 짓기 시작했습니다. 목재 200개를 비싸게 사들입니다.`,
    deck: 'boost',
  },
  {
    id: 'castleRepair',
    name: '영주의 성 보수',
    category: 'demandUp',
    scope: 'town',
    effects: [
      // 광석을 많이 사들이면 대장장이 도구 재료가 바닥나서 목재를 크게, 광석은 조금만
      { kind: 'bigOrder', good: 'wood', qty: 150, factor: 1.6 },
      { kind: 'bigOrder', good: 'ore', qty: 40, factor: 1.5 },
    ],
    days: 8,
    omen: '영주가 일꾼을 모은다더라.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: BIG_ORDER_WEIGHT,
    news: ({ town: t }) => `영주가 ${t} 성벽 보수를 시작했습니다. 광석과 목재를 비싸게 사들입니다.`,
    deck: 'boost',
  },
  {
    id: 'festival',
    name: '축제',
    category: 'demandUp',
    scope: 'town',
    needs: { tier: 'city' },
    effects: [
      { kind: 'bigOrder', good: 'meat', qty: 100, factor: 1.6 },
      { kind: 'bigOrder', good: 'grain', qty: 150, factor: 1.6 },
    ],
    days: 5,
    // 겨울에는 겨울 축제가 대신 열린다
    seasons: NOT_WINTER,
    omen: '영주 딸이 곧 혼인한다더군.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: CITY_FESTIVAL_WEIGHT,
    news: ({ town: t }) => `${t}에서 영주 딸의 혼례 잔치가 열립니다. 고기와 곡물을 비싸게 사들입니다.`,
    deck: 'boost',
  },
  {
    id: 'army',
    name: '군대 보급',
    category: 'demandUp',
    scope: 'town',
    effects: [
      { kind: 'bigOrder', good: 'salted', qty: 100, factor: 1.7 },
      { kind: 'bigOrder', good: 'leather', qty: 80, factor: 1.6 },
      { kind: 'demand', good: 'tools', extra: 1 },
    ],
    days: 6,
    omen: '동쪽에 군대가 오간다더라.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: ARMY_WEIGHT,
    news: ({ town: t }) => `군대가 ${t}에 머물며 염장 식품과 가죽을 비싸게 사들입니다.`,
    deck: 'boost',
  },
  {
    // 겨울 축제 (0.0.8): 겨울에만. 모닥불 장작과 겨울 음식을 사들인다. 둘 다 오래 두어도 되는 물품이라 가을부터 모아 둘 수 있다
    id: 'winterFestival',
    name: '겨울 축제',
    category: 'demandUp',
    scope: 'town',
    needs: { tier: 'city' },
    effects: [
      { kind: 'bigOrder', good: 'wood', qty: 150, factor: 1.6 },
      { kind: 'bigOrder', good: 'salted', qty: 100, factor: 1.6 },
    ],
    days: 5,
    seasons: [WINTER],
    omen: '도시에서 겨울 축제를 크게 연다더군.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: WINTER_FESTIVAL_WEIGHT,
    news: ({ town: t }) => `${t}에서 겨울 축제가 열립니다. 모닥불 장작과 염장 식품을 비싸게 사들입니다.`,
    deck: 'boost',
  },
  {
    // 봄 구휼 (0.0.9): 보릿고개(봄)에 영주가 곡물을 사들여 나눠 준다. 가을에 곡물을 쌓아 둔 사람의 보람이고,
    // 여름에 시작한 시즌의 후반(겨울·봄)에도 노릴 거리가 된다 (questions.md 78번)
    id: 'relief',
    name: '봄 구휼',
    category: 'demandUp',
    scope: 'town',
    // 사들인 곡물은 그 마을 일꾼에게 나눠 준다 (사라지면 보릿고개에 먹을 것이 더 모자라 장이 무너졌다)
    effects: [{ kind: 'bigOrder', good: 'grain', qty: 200, factor: 1.5, giveOut: true }],
    days: 8,
    seasons: [SPRING],
    omen: '영주가 보릿고개를 앞두고 곡식을 모은다더군.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: RELIEF_WEIGHT,
    news: ({ town: t }) => `영주가 보릿고개를 넘기려 ${t}에서 곡물을 사들여 나눠 줍니다. 곡물 200개를 비싸게 사들입니다.`,
    deck: 'boost',
  },

  // ───── 수요 ↓ ─────
  {
    id: 'plagueRumor',
    name: '역병 소문',
    category: 'demandDown',
    scope: 'town',
    needs: { tier: 'city' },
    effects: [{ kind: 'demand', factor: 0.5 }],
    days: 3,
    // 소문이 곧 사건이다
    omen: null,
    news: ({ town: t }) => `${t}에 역병이 돈다는 말이 퍼져 사람들이 주변 마을로 나가고 있습니다.`,
    deck: null,
  },

  // ───── 길 ─────
  {
    id: 'bandits',
    name: '산적 출몰',
    category: 'road',
    scope: 'town',
    effects: [{ kind: 'toll', gold: 10 }],
    days: 3,
    omen: '길에서 상인이 털렸다더군.',
    news: ({ town: t }) => `${t} 길목에 산적이 나타났습니다. 오가는 수레에 통행세를 뜯습니다.`,
    deck: 'bandits',
  },
  {
    id: 'bridgeCollapse',
    name: '다리 붕괴',
    category: 'road',
    scope: 'town',
    effects: [{ kind: 'blockRoads', terrain: 'any', count: 1 }],
    days: 4,
    omen: null,
    news: ({ town: t }) => `${t} 근처 길의 다리가 무너졌습니다. 돌아가야 합니다.`,
    deck: null,
  },

  // ───── 제도와 시장 ─────
  {
    id: 'taxHike',
    name: '세금 인상',
    category: 'rule',
    scope: 'town',
    effects: [{ kind: 'salesTax', rate: 0.1 }],
    days: 3,
    omen: '영주 금고가 비었다더라.',
    news: ({ town: t }) => `${t} 장날 거래세가 올랐습니다. 판 값의 10분의 1을 냅니다.`,
    deck: null,
  },
  {
    id: 'grandCaravan',
    name: '대상단 도착',
    category: 'market',
    scope: 'town',
    effects: [{ kind: 'bigOrder', qty: 150, factor: 1.5 }],
    goods: ['wood', 'leather', 'ore', 'salt', 'salted', 'grain'],
    days: 4,
    omen: '서쪽에서 수레 행렬이 온다더군.',
    omenShare: 1,
    omenLead: [8, 12],
    weight: BIG_ORDER_WEIGHT,
    news: ({ town: t, good }) => `서쪽 대상단이 ${t}에 와서 ${eulReul(name(good))} 한꺼번에 사들입니다.`,
    deck: 'caravan',
  },

  // ───── 반응 사건 (시장 상태에서 생김) ─────
  {
    id: 'workersQuit',
    name: '일을 줄임',
    category: 'reactive',
    scope: 'town',
    effects: [
      // 덜 내놓고, 다른 일도 조금 기웃거린다
      { kind: 'produce', factor: 0.7 },
      { kind: 'jobIncome', factor: 0.8 },
    ],
    days: 5,
    omen: null,
    news: ({ town: t, job }) => `${t} ${QUIT_TEXT[job ?? 'fisher']}`,
    deck: null,
  },
  {
    id: 'rush',
    name: '일꾼이 몰림',
    category: 'reactive',
    scope: 'town',
    effects: [{ kind: 'jobIncome', factor: 1.6 }],
    days: 6,
    omen: null,
    news: ({ town: t, job }) => `${t} 일꾼들이 ${RUSH_PLACE[job ?? 'miner']} 몰려갑니다.`,
    deck: null,
  },
  {
    id: 'famine',
    name: '굶주린 마을',
    category: 'reactive',
    scope: 'town',
    effects: [{ kind: 'citizenBid', goods: 'food', factor: 1.5 }],
    days: 4,
    omen: null,
    news: ({ town: t }) => `${t}에 먹을 것이 바닥났습니다. 음식이라면 비싸게라도 사려 합니다.`,
    deck: null,
  },
  {
    id: 'sellout',
    name: '품귀',
    category: 'reactive',
    scope: 'town',
    effects: [],
    days: 1,
    omen: null,
    news: ({ town: t, good }) => `어느 상단이 ${t} 장의 ${eulReul(name(good))} 거의 다 사 갔습니다.`,
    deck: null,
  },
];

export const eventDef = (id: EventId): EventDef => EVENT_DEFS.find((d) => d.id === id)!;

/** 일정표로 짜는 사건 (반응 사건 빼고) */
export const SCHEDULED_DEFS = EVENT_DEFS.filter((d) => d.category !== 'reactive');

/** 이 사건이 줄이는 물품 (같은 물품 악재 연속 금지에 쓴다) */
export function badGoods(def: EventDef): string[] {
  const out: string[] = [];
  for (const e of def.effects) {
    if (e.kind === 'produce' && e.factor < 1 && e.good) out.push(e.good);
    if (e.kind === 'saleBan') out.push(e.good);
  }
  return out;
}

