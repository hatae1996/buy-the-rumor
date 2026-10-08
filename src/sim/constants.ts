// 조정할 숫자는 모두 여기에 모은다. 기획서의 "초안" 값이며 시뮬레이션을 돌려 고친다.

export const WORLDGEN = {
  /** 맵 반지름 (칸). 반지름 7이면 169칸 */
  radius: 7,
  townCount: 4,
  /** 마을끼리 떨어져야 하는 최소 칸 수 */
  townMinDistance: 5,
  /** 마을 특색을 셀 때 보는 범위 (칸) */
  specialtyRange: 2,
  /** 특색이 되려면 범위 안에 같은 자원지가 몇 칸 있어야 하나 */
  specialtyMinCount: 2,
  maxSpecialties: 2,
  /** 가장 가까운 마을까지 걸리는 날 (기본 계절 기준) */
  nearestTownDays: { min: 1, max: 4 },
  /** 지형 하나에서 마을 배치를 몇 번 시도하나 */
  townAttempts: 120,
  /** 규칙을 못 맞추면 시드를 1씩 올려 다시 만든다. 그 최대 횟수 */
  terrainAttempts: 60,
  /** 최소 신장 트리 밖의 추가 길: 트리에서 가장 긴 길의 몇 배까지 허용하나 */
  extraRoadFactor: 1.6,

  noise: {
    heightScale: 0.16,
    moistureScale: 0.13,
    /** 높이에 더하는 값과 가장자리로 갈수록 빼는 값 (섬 모양) */
    heightBias: 0.48,
    edgeFalloff: 0.8,
  },
  /** 지형 문턱값 */
  terrain: {
    sea: 0.5,
    hills: 0.87,
    mountain: 0.98,
    forestMoisture: 0.5,
    /** 이보다 낮은 평원과 숲이 바다에 닿으면 해안 */
    coastHeight: 0.62,
  },
  /** 자원지가 생길 확률 */
  resource: {
    saltMoisture: 0.47,
    saltChance: 0.55,
    hillsOreChance: 0.4,
    mountainOreChance: 0.3,
    fieldChance: 0.5,
  },
} as const;

export const TRAVEL = {
  /** 칸을 지나는 데 드는 비용. 비용 2가 하루 */
  terrainCost: { plain: 1, coast: 1, forest: 2, hills: 3, mountain: 5, sea: Infinity },
  roadCost: 0.5,
  /** 겨울에 눈 쌓인 산과 언덕 */
  winterSnowMultiplier: 2,
  winterSnowRoadCost: 1.2,
  costPerDay: 2,
} as const;

/** 15일 시즌 안에서 계절마다 며칠씩인가 (봄, 여름, 가을, 겨울) */
export const CALENDAR = {
  seasonDays: [4, 4, 4, 3],
} as const;

export const ECONOMY = {
  /** 물품 기준 가격과 상하는 날. shelfLife가 null이면 상하지 않는다 */
  goods: {
    fish: { basePrice: 8, shelfLife: 3 },
    meat: { basePrice: 10, shelfLife: 4 },
    grain: { basePrice: 6, shelfLife: 40 },
    wood: { basePrice: 8, shelfLife: null },
    leather: { basePrice: 16, shelfLife: null },
    ore: { basePrice: 14, shelfLife: null },
    salt: { basePrice: 10, shelfLife: null },
    salted: { basePrice: 24, shelfLife: null },
    tools: { basePrice: 60, shelfLife: null },
  },
  /** 시세가 기준 가격의 몇 배 사이에서 움직이나 */
  priceFloor: 0.25,
  priceCeiling: 5,
  /** 정산 가격을 기준 시세에 얼마나 반영하나 (0~1). 작을수록 시세가 천천히 움직인다 */
  priceSmoothing: 0.5,
  /** 거래가 없을 때 시세를 신청 값 쪽으로 하루에 최대 몇 % 미나 */
  idleDrift: 0.05,

  /** 채집: 하루 기본 생산량. 자원지 남은 양과 계절에 따라 줄어든다 */
  gather: {
    fisher: { fish: 4 },
    hunter: { meat: 3, leather: 1.5 },
    farmer: { grain: 5 },
    woodcutter: { wood: 3 },
    miner: { ore: 2.4 },
    salter: { salt: 3 },
  },
  /** 가공: 재료 → 결과 (하루 최대 몇 번) */
  craft: {
    curer: { inputs: { salt: 1 }, rawFood: 2, output: { salted: 2 }, batches: 2 },
    smith: { inputs: { ore: 2, wood: 1 }, rawFood: 0, output: { tools: 1 }, batches: 1 },
  },
  /** 계절별 생산 배율 (봄, 여름, 가을, 겨울) */
  seasonYield: {
    fisher: [1, 1, 1, 0.6],
    hunter: [1, 1, 1, 0.7],
    farmer: [0.6, 1, 1.6, 0],
    woodcutter: [1, 1, 1, 1],
    miner: [1, 1, 1, 1],
    salter: [1, 1.4, 1, 0.3],
  },

  /** 자원지: 맵에서 마을 주변 두 칸 안의 자원지 칸 수로 크기를 정한다 */
  node: {
    capacityPerTile: 120,
    /** 하루 회복률 (로지스틱). null이면 일해도 줄지 않는 자원지 (들판, 염전은 땅이 줄지 않는다) */
    regrowth: { forest: 0.12, ore: 0.03, field: null, fish: 0.15, salt: null },
  },

  worker: {
    startGold: [30, 50],
    /** 하루에 먹는 음식 */
    foodPerDay: 1,
    /** 며칠 치 음식을 갖고 있으려 하나 */
    foodReserveDays: 2,
    toolLife: 20,
    /** 도구가 이만큼 남으면 새로 산다 */
    toolReplaceAt: 3,
    noToolEfficiency: 0.5,
    hungryEfficiency: 0.65,
    /** 살 때 기준 시세의 몇 배까지 내나 (굶으면 더 낸다) */
    bidMarkup: 1.3,
    hungryBidMarkup: 1.8,
    /** 팔 때 기준 시세의 몇 배 아래로는 안 파나 (곧 상하면 더 싸게) */
    askMarkdown: 0.8,
    spoilingAskMarkdown: 0.5,
    /** 물품 하나당 쌓아 둘 수 있는 양. 넘치면 버린다 */
    storagePerGood: 30,
    taxThreshold: 80,
    taxRate: 0.04,
    /** 전직: 굶고 가난하면 바꿀 확률, 남이 훨씬 잘 벌면 바꿀 확률 */
    switchWhenPoorChance: 0.3,
    switchEnvyChance: 0.1,
    switchEnvyFactor: 1.3,
    /** 이만큼 굶으면 다른 마을로 떠나고, 더 굶으면 세상을 떠난다 */
    migrateHunger: 3,
    leaveHunger: 6,
    /** 일꾼이 새로 찾아올 확률과 조건 (가장 좋은 일의 예상 하루 수입) */
    arriveChance: 0.05,
    arriveMinIncome: 20,
  },
  /** 마을 직업별 인원 상한: 채집은 자원지 칸 수 × 이 값, 가공은 고정 */
  jobCap: { perResourceTile: 2, crafter: 3 },
  /** 처음 일꾼 수: 자원지 칸 하나당, 가공 직업마다 */
  startWorkers: { perResourceTile: 1, crafter: 1 },

  /** 마을 주민(일꾼 아닌 사람들)이 하루에 사는 양. 돈이 경제로 들어오는 곳 */
  citizens: {
    demand: { fish: 1, meat: 1, grain: 2, wood: 3, leather: 1, ore: 0, salt: 1, salted: 1, tools: 0.5 },
    /** 겨울엔 땔감이 더 든다 */
    winterWoodFactor: 2,
    /**
     * 주민은 비쌀수록 덜 산다: 하루 양을 나눠 기준 가격의 이 배율들로 신청한다.
     * 굶는 일꾼(시세의 1.8배까지 냄)보다 높게 부르지 않아야 일꾼이 먼저 먹는다.
     */
    priceSteps: [
      { factor: 0.7, share: 0.35 },
      { factor: 1.0, share: 0.35 },
      { factor: 1.3, share: 0.3 },
    ],
    /** 마을 금고에 날마다 들어오는 돈 (바깥 경제) */
    stipend: 120,
    startTreasury: 600,
    /** 금고가 이보다 많으면 넘는 만큼의 일부를 영주에게 바친다 (돈이 빠져나가는 곳) */
    treasuryCap: 1500,
    tributeRate: 0.25,
  },

  /** NPC 상단 */
  traders: {
    count: 3,
    startGold: 300,
    capacity: 40,
    /** 하루 이동에 드는 비용 (차익 계산에 넣는다) */
    costPerDay: 3,
    minMargin: 3,
    bidMarkup: 1.15,
    askMarkdown: 0.85,
    taxThreshold: 600,
    /** 짐을 못 팔고 머문 날마다 부르는 값을 이만큼 내린다 */
    stuckMarkdown: 0.15,
  },

  /** 새 세계를 플레이어가 오기 전에 미리 돌리는 날. 첫날부터 장에 물건이 돌게 한다 */
  warmupDays: 20,

  player: {
    startGold: 200,
    capacity: 40,
    travelFeePerDay: 3,
    /** 이보다 큰 거래(금액)는 신문에 실린다 */
    bigTradeNews: 400,
  },

  events: {
    dailyChance: 0.045,
    stormDays: 3,
    wolvesFactor: 0.6,
    newVeinTiles: 1,
    boostFactor: 2.2,
    boostDays: 6,
  },
} as const;
