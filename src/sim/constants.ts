// 조정할 숫자는 모두 여기에 모은다. 기획서의 "초안" 값이며 시뮬레이션을 돌려 고친다.

export const WORLDGEN = {
  /** 맵 반지름 (칸). 반지름 7이면 169칸 */
  radius: 7,
  /** 테스트 버전: 생산 마을 3 + 도시 1 (기획서 "직업") */
  productionTowns: 3,
  cities: 1,
  /** 마을끼리 떨어져야 하는 최소 칸 수 */
  townMinDistance: 5,
  /** 도시는 생산 마을과 이만큼은 떨어진다 (칸) */
  cityMinDistance: 4,
  /** 도시 주변 두 칸 안 자원지 칸이 이보다 많으면 도시로 쓰지 않는다 ("자원지가 거의 없다") */
  cityMaxResourceTiles: 5,
  /** 지역 특색 태그: 덩어리마다 붙을 확률, 붙으려면 덩어리가 이만큼은 커야 한다 */
  regionTagChance: 0.45,
  regionMinTiles: 3,
  /** 마을 특색을 셀 때 보는 범위 (칸) */
  specialtyRange: 2,
  /** 목장 특색이 근처에 있는 생산 마을 수 = 마구간 마을 수 (0.0.7: 맵마다 꼭 2곳) */
  ranchTowns: 2,
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
  /** 봄엔 길이 진흙이라 조금 느리다 */
  springMudRoadCost: 0.65,
  /** 겨울에 눈 쌓인 산과 언덕 */
  winterSnowMultiplier: 2,
  winterSnowRoadCost: 1.2,
  costPerDay: 2,
} as const;

/**
 * 계절마다 게임 속 며칠인가 (봄, 여름, 가을, 겨울).
 * 기획서: 시즌(실제 13일 플레이, 0.0.9) 동안 사계절, 계절 하나는 실제 약 3.25일.
 * 게임 속 하루가 실제 2.5시간(src/ui/game.ts의 DAY_MS)이면 시즌은 13 × 9.6 = 게임 속 125일, 계절 하나는 31일쯤이다.
 */
export const CALENDAR = {
  seasonDays: [31, 31, 31, 32],
} as const;

export const ECONOMY = {
  /** 물품 기준 가격과 상하는 날. shelfLife가 null이면 상하지 않는다 */
  goods: {
    fish: { basePrice: 8, shelfLife: 4 },
    meat: { basePrice: 10, shelfLife: 5 },
    grain: { basePrice: 6, shelfLife: 52 },
    wood: { basePrice: 8, shelfLife: null },
    leather: { basePrice: 16, shelfLife: null },
    ore: { basePrice: 14, shelfLife: null },
    salt: { basePrice: 10, shelfLife: null },
    salted: { basePrice: 24, shelfLife: 35 },
    tools: { basePrice: 60, shelfLife: null },
  },
  /** 계절별로 하루에 상하는 정도 (봄, 여름, 가을, 겨울). 여름엔 빨리, 겨울엔 천천히 */
  spoilRate: [1, 1.5, 1, 0.5],
  /** 시세가 기준 가격의 몇 배 사이에서 움직이나 */
  priceFloor: 0.25,
  priceCeiling: 5,
  /** 정산 가격을 기준 시세에 얼마나 반영하나 (0~1). 작을수록 시세가 천천히 움직인다 */
  priceSmoothing: 0.5,
  /** 거래가 없을 때 시세를 신청 값 쪽으로 하루에 최대 몇 % 미나 */
  idleDrift: 0.05,
  /** 사자도 팔자도 없는 장에서는 시세가 하루에 이만큼씩 기준 가격 쪽으로 돌아간다 (빈 장의 시세가 바닥에 묶이지 않게) */
  emptyReversion: 0.02,

  /**
   * 채집: 하루 기본 생산량. 자원지 남은 양과 계절에 따라 줄어든다.
   * 0.0.6: 장사가 주 수입이 되도록 두 배로 늘리고 자원지 크기(node.capacityPerTile)도 두 배로 해 줄어드는 빠르기는 그대로 (원정 수확은 그대로)
   */
  gather: {
    fisher: { fish: 8 },
    hunter: { meat: 6, leather: 3 },
    farmer: { grain: 10 },
    woodcutter: { wood: 6 },
    miner: { ore: 4.8 },
    salter: { salt: 6 },
  },
  /** 가공: 재료 → 결과 (하루 최대 몇 번) */
  craft: {
    curer: { inputs: { salt: 1 }, rawFood: 2, output: { salted: 2 }, batches: 2 },
    smith: { inputs: { ore: 2, wood: 1 }, rawFood: 0, output: { tools: 1 }, batches: 2 },
  },
  /** 계절별 생산 배율 (봄, 여름, 가을, 겨울) */
  seasonYield: {
    // 여름엔 풍성, 겨울엔 항구가 얼어 멈춤
    fisher: [1, 1.4, 1, 0],
    // 봄엔 번식기라 적게, 가을에 가장 많이
    hunter: [0.6, 1, 1.4, 0.7],
    // 봄에 심고 가을에 한꺼번에 거둔다
    farmer: [0.4, 0.8, 2, 0],
    woodcutter: [1, 1, 1, 1],
    miner: [1, 1, 1, 1],
    // 여름엔 많고 겨울엔 거의 없다
    salter: [1, 1.5, 1, 0.1],
  },

  /** 자원지: 맵에서 마을 주변 두 칸 안의 자원지 칸 수로 크기를 정한다 */
  node: {
    capacityPerTile: 240,
    /** 하루 회복률 (로지스틱). null이면 일해도 줄지 않는 자원지 (들판, 염전은 땅이 줄지 않는다) */
    regrowth: { forest: 0.12, ore: 0.03, field: null, fish: 0.15, salt: null },
  },

  worker: {
    startGold: [30, 50],
    /** 하루에 먹는 음식 */
    foodPerDay: 1,
    /** 며칠 치 음식을 갖고 있으려 하나 */
    foodReserveDays: 2,
    /** 가을엔 겨울을 나려고 이만큼 쌓아 둔다 (곡물, 염장 식품처럼 오래가는 음식으로) */
    winterReserveDays: 40,
    toolLife: 32,
    /** 도구가 이만큼 남으면 새로 산다 */
    toolReplaceAt: 10,
    /** 도구가 이만큼 남으면 도구 값은 남겨 두고 음식을 쌓는다 (굶을 땐 예외) */
    toolSaveAt: 20,
    /** 가공 일꾼은 결과물 값을 기준 가격의 이 배율 아래로는 보지 않는다 (값이 잠깐 무너져도 만들기를 멈추지 않는다) */
    crafterValueFloor: 0.5,
    noToolEfficiency: 0.5,
    hungryEfficiency: 0.65,
    /** 살 때 기준 시세의 몇 배까지 내나 (굶으면 더 낸다) */
    bidMarkup: 1.3,
    hungryBidMarkup: 1.8,
    /** 팔 때 기준 시세의 몇 배 아래로는 안 파나 */
    askMarkdown: 0.8,
    /**
     * 안 팔리고 쌓인 물건은 더 싸게 내놓는다: 남는 양을 기준 가격으로 친 값이 이만큼이면 부르는 값이 최대로 내려간다.
     * (도구가 쌓였는데 시세만 높아 아무도 못 사는 일을 막는다)
     */
    glutValue: 400,
    glutMaxDiscount: 0.4,
    /** 물품 하나당 쌓아 둘 수 있는 양. 넘치면 버린다 */
    storagePerGood: 60,
    taxThreshold: 80,
    taxRate: 0.04,
    /** 전직: 굶고 가난하면 바꿀 확률, 남이 훨씬 잘 벌면 바꿀 확률 */
    switchWhenPoorChance: 0.3,
    switchEnvyChance: 0.1,
    /** 일을 바꾸면 이만큼은 그 일을 한다 (모두가 한꺼번에 같은 일로 몰렸다 빠지는 것을 막는다). 굶을 땐 예외 */
    switchCooldownDays: 15,
    switchEnvyFactor: 1.3,
    /** 지금 일의 벌이는 실제로 번 값의 평균으로 본다. 하루 벌이를 이만큼 반영한다 (0~1) */
    incomeMemory: 0.2,
    /** 이만큼 굶으면 다른 마을로 떠나고, 더 굶으면 세상을 떠난다 */
    migrateHunger: 3,
    leaveHunger: 6,
    /** 일꾼이 새로 찾아올 확률과 조건 (가장 좋은 일의 예상 하루 수입) */
    arriveChance: 0.05,
    arriveMinIncome: 20,
    /** 일꾼이 이보다 적은 마을은 빈자리를 보고 사람이 더 잘 찾아온다 (마을이 비지 않게) */
    refillBelow: 4,
    refillChance: 0.3,
  },
  /** 마을 직업별 인원 상한: 채집은 자원지 칸 수 × 이 값, 가공은 고정. 도시는 일꾼 대신 공방이 있다 */
  jobCap: { perResourceTile: 2, crafter: 3 },
  /** 처음 일꾼 수: 자원지 칸 하나당, 가공 직업마다 */
  startWorkers: { perResourceTile: 1, crafter: 1 },
  /**
   * 겨울 일 (handoff 0.0.4): 겨울에 일이 멈추는 직업(그 계절 생산 배율이 idleBelow보다 낮음)은
   * 겨울 동안 이 일들로 옮겼다가 봄에 원래 일로 돌아온다. 겨울엔 이 일들의 인원 상한이 capFactor배.
   */
  winterWork: {
    idleBelow: 0.3,
    jobs: ['woodcutter', 'hunter', 'curer', 'smith'],
    capFactor: 2,
    /** 겨울 동안 일꾼은 굶어서만 줄고, 겨울 첫날보다 이 비율 넘게는 줄지 않는다. 넘으면 굶은 채로 버틴다 */
    maxDecline: 0.2,
  },

  /** 마을 주민(일꾼 아닌 사람들)이 하루에 사는 양. 돈이 경제로 들어오는 곳 */
  citizens: {
    /** 물품마다 하루 양의 바탕. 실제로는 depth배를 값 단계에 나눠 신청한다 */
    demand: { fish: 1, meat: 1, grain: 2, wood: 3, leather: 1, ore: 0.5, salt: 1, salted: 1, tools: 0.03 },
    /**
     * 장의 깊이 (0.0.6 "벌이의 균형"): 주민 수요 배율. 한 장날에 20~30개를 팔아도 값이 무너지지 않을 만큼.
     * 싼 값일수록 많이 사서(priceSteps), 남는 곳은 값이 바닥까지 떨어지지 않고 모자란 곳은 값이 오른다
     */
    depth: 5,
    /** 겨울엔 땔감이 더 든다 */
    winterWoodFactor: 2,
    /** 겨울엔 털가죽과 음식이 더 든다, 가을엔 겨울 대비로 곡물을 더 산다 */
    winterLeatherFactor: 1.5,
    winterFoodFactor: 1.3,
    autumnGrainFactor: 1.5,
    /**
     * 주민은 비쌀수록 덜 산다: 하루 양을 나눠 기준 가격의 이 배율들로 신청한다.
     * 굶는 일꾼(시세의 1.8배까지 냄)보다 높게 부르지 않아야 일꾼이 먼저 먹는다.
     */
    priceSteps: [
      { factor: 1.3, share: 0.12 },
      { factor: 1.15, share: 0.15 },
      { factor: 1.0, share: 0.2 },
      { factor: 0.85, share: 0.23 },
      { factor: 0.7, share: 0.3 },
    ],
    /** 마을 금고에 날마다 들어오는 돈 (바깥 경제). 주민이 깊게 사는 만큼 많다 */
    stipend: 500,
    startTreasury: 3000,
    /** 금고가 이보다 많으면 넘는 만큼의 일부를 영주에게 바친다 (돈이 빠져나가는 곳) */
    treasuryCap: 6000,
    tributeRate: 0.25,
  },

  /** 도시: 자원지가 거의 없지만 사람과 돈이 많아 가공품과 고급품을 비싸게 산다 (기획서 "직업") */
  city: {
    /** 주민 수요 배율 (0.0.6: 도시는 물건이 모이는 큰 장) */
    demandFactor: 12,
    /** 금고에 들어오는 돈, 시작 금고, 금고 상한 배율 */
    treasuryFactor: 4,
    /** 이 물건들은 더 비싸게 산다 (가공품, 가죽) */
    premiumGoods: ['tools', 'salted', 'leather'],
    premiumFactor: 1.3,
    /**
     * 도시 공방 (대장간, 염장 공방): 도시 금고로 재료를 사들여 하루 batches번까지 만든다.
     * 재료 사는 데는 금고의 treasuryShare까지만 쓴다
     */
    workshop: { batches: { smith: 3, curer: 3 }, treasuryShare: 0.3, maxBidOfBase: 1.4 },
  },

  /** NPC 상단 */
  traders: {
    count: 5,
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
    /** 이만큼 못 팔면 다른 마을로 옮긴다 */
    moveOnAfterDays: 3,
    /** 도착할 마을이 며칠 치 사려는 양까지 받아 줄 것으로 보나 */
    absorbDays: 4,
  },

  /** 새 세계를 플레이어가 오기 전에 미리 돌리는 날. 첫날부터 장에 물건이 돌게 한다 */
  warmupDays: 20,

  /** 랭킹 (기획서 "랭킹과 보상"). 숫자는 초안 */
  ranking: {
    /** 수완가 부문: 이만큼(게임 속 날) 넘게 해야 기록한다. 기획서 "최소 5일"을 게임 속 날로 옮겼다 (실제 하루 = 게임 속 9.6일) */
    multiplierMinDays: 48,
    /** Buy the Rumor: 징조를 듣고 이 날 안에 신문에 난 사건만, 신문 뒤 이 날 안에 판 것만 센다 */
    rumorWindowDays: 15,
    /** 오뚝이: 순자산이 시작의 이 비율 아래로 떨어졌다가 시작보다 위로 돌아오면 */
    comebackBelow: 0.5,
    /** 신문의 큰 거래에 이름이 실리는 상위권: 큰손 부문 이 순위까지 (기본은 "어느 상단") */
    namedInNews: 3,
  },

  /** 신문값 (0.1.0, 기획서 "소식을 얻는 방법"). 돈이 세계 밖으로 나가는 곳. 숫자는 초안 */
  newspaper: {
    fee: 2,
    /** 지난 신문은 이 날 수 안의 것만 산다 */
    backDays: 7,
  },

  /** 예약 주문 (0.1.0). 숫자는 초안 */
  reservation: {
    /** 한 사람이 걸어 둘 수 있는 예약 주문 수 */
    max: 5,
  },

  /** 견습 (기획서 "처음 하는 플레이어"). 숫자는 초안 */
  apprentice: {
    /** 견습은 빈 등짐과 금화 50으로 시작한다 */
    startGold: 50,
    /** 견습 마을 손님: 플레이어가 팔면 시세의 이 배로 사 주고, 사면 이 배로 팔아 준다 */
    buyMarkup: 1.1,
    sellMarkdown: 0.95,
    /** 견습 뒤 열리는 조건: 예약 주문은 금화 이만큼 */
    reservationGold: 300,
  },

  player: {
    /** 시작 조건: 모두 같은 돈 (기획서 "시작 조건") */
    startGold: 200,
    travelFeePerDay: 3,
    /** 이보다 큰 거래(금액)는 신문에 실린다 */
    bigTradeNews: 400,
    /** 로컬 게임에 함께 앉는 봇 상인 수 (질문 87 답). 개발용으로 0~maxLocalBots */
    localBots: 10,
    maxLocalBots: 20,
  },

  /** 피로와 원정 기회 (기획서 "퍼즐 기회와 피로도"). 숫자는 초안 */
  fatigue: {
    max: 10,
    /** 하룻밤 자면 저절로 줄어드는 양 */
    nightlyRecovery: 3,
    /** 음식 한 개를 먹으면 줄어드는 양 (신선할수록 많이) */
    meal: { fresh: 3, days: 2, keeps: 2, soon: 1 },
    mealsPerDay: 3,
    /** 여관: 하루 한 번. 여관비는 경제에서 빠져나가는 돈 */
    inn: {
      town: { fee: 8, recovery: 5 },
      city: { fee: 16, recovery: 8 },
    },
    /** 이만큼 지치면 원정 결과가 나빠진다 */
    tiredAt: 7,
  },
  expedition: {
    /** 자원지가 있는 마을에 머무는 동안 하루 1개씩, 최대 이만큼 */
    maxChances: 6,
    /**
     * 원정 한 번의 덱 (기획서 "원정 카드 목록"): 지형 6 + 지역 특색 2 + 계절 1~2 + 사건 0~2 + 내 카드 0~2.
     * 여기서 3~4장을 뽑는다
     */
    deck: { terrain: 6, tag: 2, season: [1, 2], event: [0, 2], mine: [0, 2] },
    /** 도구는 소모품: 나무 베기·광석 캐기 몇 번에 도구 하나를 다 쓰나 (0.0.6: 4번) */
    usesPerTool: 4,
    /** 다침: 피로가 크게 오른다 */
    hurtFatigue: 4,
    /** 놓아 둔 덫: 이 날까지는 잡혀 있고, 그 뒤로는 반반, 이 날이 지나면 다른 짐승이 먹어 버린다 */
    trapFreshDays: 3,
    trapGoneDays: 8,
    /** 무더위: 이번 원정에서 얻은 생선과 고기는 이만큼 묵은 채로 싣는다 */
    heatAge: 1,
    /** 말과 함께 갔을 때 위험한 일 뒤에 말이 놀랄 확률 (목장 화재가 있었던 마을은 더) */
    spookChance: 0.4,
    spookChanceAfterFire: 0.7,
    /** 장비 (기획서 "장비"): 잡화점 값, 쓸 수 있는 횟수. 다 쓰면 망가지고, 도구 하나로 고친다 */
    gear: {
      bow: { name: '활', price: 45, durability: 8 },
      torch: { name: '횃불', price: 12, durability: 4 },
      trap: { name: '덫', price: 20, durability: 5 },
      net: { name: '그물', price: 30, durability: 6 },
    },
    /** 안내인: 여관에서 고용하면 다음 원정 한 번 동안 나쁜 카드 1장을 건너뛴다 */
    guideFee: { town: 12, city: 18 },
  },

  /** 사건 일정 (기획서 "사건"). 사건마다의 효과와 기간은 src/sim/events/defs.ts */
  events: {
    /** 시즌에 큰 사건 몇 개 (최소, 최대). 하루에 새 사건은 최대 1개 */
    perSeason: [6, 10],
    /** 큰 사건 중 징조 소문이 도는 비율, 며칠 전에 (최소, 최대) */
    omenShare: 0.5,
    omenLead: [1, 3],
    /** 일어나지 않는 헛징조 몇 개 (최소, 최대) */
    fakeOmens: [1, 3],
    /** 시즌 첫날과 마지막 며칠에는 큰 사건을 새로 넣지 않는다 */
    quietFirstDays: 1,
    quietLastDays: 2,
    /** "인근 마을": 이 날수 안에 닿는 마을 */
    nearbyDays: 3,
    /** 길을 막을 때 마을에서 몇 칸 안의 길 */
    blockRange: 3,
    /** 대상단이 부르는 값: 살 때 기준 시세의 이 배, 팔 때 이 배 */
    bulkBuyMarkup: 1.4,
    bulkSellMarkdown: 0.7,
    /**
     * 큰 주문 양은 플레이어 수에 비례한다 (0.1.0): 사건 표의 양(한 사람 세계의 양) 중 이 몫은 한 사람당,
     * 나머지는 기본량. 양 = 표의 양 × ((1 − 몫) + 몫 × 플레이어 수). 사람이 많아도 늦게 온 사람이 빈손이 되지 않게
     */
    bigOrderPerPlayer: 0.5,
    /** 반응 사건 */
    reactive: {
      /** 기준 가격의 이 배율보다 낮은 날이 이어지면 일꾼이 일을 줄인다 */
      lowBelow: 0.3,
      /** 기준 가격의 이 배율보다 높은 날이 이어지면 일꾼이 몰려든다 */
      highAbove: 2.2,
      streakDays: 10,
      /** 같은 마을에 같은 반응 사건을 다시 내지 않는 날 (계절 하나) */
      cooldownDays: 31,
      /** 반응 사건은 하루에 하나, 시즌에 이만큼까지 (신문이 반응 사건으로 덮이지 않게) */
      perSeason: 6,
      /** 일꾼 중 이 비율 넘게 굶고 장에 음식이 없으면 굶주린 마을 */
      famineHungryShare: 0.3,
      /** 플레이어가 그날 장에서 이 비율 넘게, 이만큼 넘게 사 가면 품귀 기사 */
      selloutShare: 0.6,
      selloutMinQty: 10,
    },
  },
} as const;

/**
 * 소문 (기획서 "소문"). 숫자는 모두 초안이다.
 * 소문은 진짜 상태에서 만들어져 길을 따라 하루에 한 마을씩 퍼지고, 건널 때마다 흐려진다.
 */
export const RUMORS = {
  /** 소문이 사라지기까지 날 (생긴 날부터). 징조는 사건 날 다음 날까지 */
  life: { omen: 1, node: 6, price: 5, orders: 3, trait: 12, false: 5 },
  /** 중요한 소문이 먼저 나온다 (높을수록 먼저) */
  importance: { omen: 5, horse: 4, orders: 3, price: 3, node: 2, trait: 1 },
  /** 한 마을 건널 때마다: 숫자가 뭉개질 확률, 부풀려질 확률과 배율 */
  hop: { blurChance: 0.5, exaggerateChance: 0.25, exaggerate: 1.3 },

  /** 숨은 숫자: 자원지 남은 양이 이 비율 아래/위면 소문이 날 수 있다 */
  node: { low: 0.3, high: 0.85, chance: 0.25 },
  /**
   * 다른 마을 시세: 기준 가격의 이 배율 위/아래면.
   * 같은 물품은 지난번 소문 낸 값에서 이 비율 넘게 바뀌어야 다시 소문 난다
   */
  price: { high: 1.6, low: 0.5, chance: 0.3, changeToRetell: 0.3 },
  /**
   * 장날 신청 현황: 사려는 양과 팔려는 양 차이가 이만큼 넘고, 그 차이가 전체의 이 비율 넘으면.
   * 같은 물품은 모자람/남음이 뒤집히거나 차이가 이 배 넘게 커져야 다시 소문 난다
   */
  orders: { minGap: 6, minShare: 0.4, chance: 0.3, growToRetell: 1.5 },
  /** 마을 특색: 하루에 마을마다 이 확률. 시즌 내내 그대로라 같은 특색은 오래 쉬었다가 다시 돈다 */
  trait: { chance: 0.05, retellDays: 48 },
  /** 헛소문: 하루에 세계 전체에서 이 확률 */
  false: { chance: 0.2 },
  /** 같은 이야기(마을·물품·종류)를 다시 소문 내지 않는 날 */
  cooldownDays: 6,

  /** 소문꾼: 마을마다 몇 명 (최소, 최대) */
  gossipsPerTown: [2, 3],
  /**
   * 성격 (기획서 "소문꾼의 성격"). 성격은 화면에 보이지 않는다.
   * lag: 소문이 마을에 닿은 뒤 며칠 지나야 아는지 (−1이면 이웃 마을에 있을 때 미리 안다).
   * talk: 하루에 많아야 몇 개 말하나. trust: 헛소문을 걸러 내는 비율.
   * calm: 건너오며 부푼 숫자를 덜어 내는 비율. inflate: 자기가 숫자를 부풀리는 배율
   */
  personality: {
    elder: { lag: 1, talk: 1, trust: 0.7, calm: 0.5, inflate: 1 },
    braggart: { lag: -1, talk: 2, trust: 0, calm: 0, inflate: 1.35 },
    merchant: { lag: 0, talk: 1, trust: 0.3, calm: 0, inflate: 1 },
    coward: { lag: 0, talk: 1, trust: 0, calm: 0, inflate: 1 },
  },
  /** 장사꾼이 자기 물품 값을 부풀리는 배율. 할 말이 없으면 이 확률로 자기 물품 자랑을 한다 */
  merchantInflate: 1.4,
  merchantPitchChance: 0.35,
  /** 겁쟁이가 나쁜 소식에 더하는 중요도 */
  cowardBadBonus: 2,

  /** 마을에 있으면 하루에 공짜로 듣는 소문 수 (최소, 최대) */
  freePerDay: [2, 3],
  /** 여관에서 술 한 잔을 사면 소문 1개 더 (하루 한 번). 여관비처럼 경제에서 빠져나간다 */
  innDrink: { town: 4, city: 6 },
  /** 화면: 한 번 접속에 새 소문은 많아야 이만큼 보여 준다 (나머지는 수첩에) */
  perVisit: 4,
  /** 수첩에 남기는 줄 수 (오래된 것부터 지운다) */
  notebookMax: 150,

  /** 수첩 도장: 들은 뒤 며칠 안에 확인할 수 있으면 찍는다 */
  verify: {
    /** 징조: 이 날까지 사건이 신문에 안 나오면 틀렸다 (소문이 생긴 날부터) */
    omenDays: 5,
    /**
     * 확인 기한 (들은 날부터). 이 안에 확인하지 못하면 도장 없이 "확인 못 함" (0.0.6).
     * 시세·신청 현황은 그 마을에 가서, 자원지는 그 마을 원정에서, 말 입고는 그 마구간에서 확인한다
     */
    priceDays: 6,
    ordersDays: 3,
    nodeDays: 10,
    /** 말 입고: 날을 못 들었으면 소문이 생기고 이 날까지 입고가 있었는지 본다 */
    horseDays: 5,
    /** 숫자를 들은 시세: 실제 값과 이 비율 안이면 맞았다 */
    priceTolerance: 0.25,
    /** 마을 장 기록을 며칠 남기나 (소문이 퍼지는 날 + 확인 기한보다 길게) */
    logDays: 30,
    /** 숫자 없이 "금값"/"헐값"이면 기준 가격의 이 배율 위/아래여야 맞았다 */
    dearAbove: 1.3,
    cheapBelow: 0.75,
  },

  /** 전서구: 먼 마을 하나의 오늘 시세, 다음 날 도착 */
  pigeonFee: 10,
  /** 정보원: 매일 그 마을 시세와 장날 신청 현황 (여관 고용 게시판, 0.0.5). 일당은 GROWTH.hire.informant */
  informant: { hireFee: 0 },
} as const;

/**
 * 말 (기획서 "말"). 숫자는 모두 초안 (questions.md 24·25번).
 * 수레는 칸을, 말은 끄는 무게와 속도를 정한다. 말은 시즌마다 정해진 수만 목장 마을 마구간에 풀린다.
 */
export const HORSES = {
  /**
   * pull: 끄는 무게. speed: 이동 일수 배율 (사람 걸음 1). feed: 하루 곡물 (쉬는 날에도, 0.0.6에서 줄임).
   * 곡물은 한 개씩이라 0.5는 이틀에 한 개를 먹는다 (src/sim/horses/pull.ts grainToday).
   * price: 마구간 기준 값. travelFatigue: 길에서 하루에 쌓이는 피로 (조랑말은 잘 지친다)
   */
  kinds: {
    pony: { name: '늙은 조랑말', pull: 60, speed: 0.85, feed: 0.5, price: 90, travelFatigue: 3 },
    draft: { name: '짐말', pull: 150, speed: 1, feed: 1, price: 220, travelFatigue: 2 },
    swift: { name: '빠른 말', pull: 90, speed: 0.65, feed: 1, price: 260, travelFatigue: 2 },
  },
  /** 한 사람이 가질 수 있는 말 (마차용 두 필) */
  maxPerOwner: 2,

  /**
   * 시즌 공급: 플레이어 한 사람당 말 수 (최소, 최대). 시즌 말 총수 = 이 값 × 플레이어 수 (0.0.7).
   * 혼자 할 때도 구할 길이 있게 한 사람당 8~10마리 (NPC 상단도 같은 재고에서 산다)
   */
  perPlayer: [8, 10],
  /** 한 번에 풀리는 수 (최소, 최대), 다음 입고까지 날 (최소, 최대) */
  batch: [1, 2],
  gapDays: [5, 12],
  /** 첫 입고는 시즌 시작 뒤 며칠 안에 */
  firstWithin: 3,
  /** 시즌 마지막 며칠에는 풀지 않는다 */
  quietLastDays: 5,
  /** 종류를 뽑는 무게 */
  kindWeight: { pony: 0.4, draft: 0.35, swift: 0.25 },
  /** 봄 입고에는 망아지(조랑말)가 이만큼 더 */
  springExtra: 1,
  /** 입고 며칠 전에 소문이 난다 */
  rumorLead: 3,

  /** 마구간 값: 그 마구간 남은 수가 [3+, 2, 1]일 때 기준 값의 배율 */
  scarcity: [1, 1.15, 1.35],
  /** 되팔 때 지금 사는 값의 이 비율 */
  resale: 0.6,

  /** 체력 (플레이어 피로와 같은 규칙) */
  fatigue: {
    max: 10,
    /** 이만큼 지치면 빨리 달리지 못한다 (속도 배율 1) */
    tiredAt: 7,
    /** 마을에서 하룻밤 쉬면 줄어드는 양 */
    nightlyRecovery: 3,
    /** 마구간에서 쉬게 하기: 하루 한 번, 말 한 필마다 값 */
    rest: { fee: 5, recovery: 5 },
    /** 굶은 밤에 쌓이는 피로 */
    hunger: 2,
  },
  /** 마을 마구간에서 먹이면 곡물 시세의 이 배를 받는다 (그만큼 주민이 곡물을 사 온다) */
  stableFeedMarkup: 1.25,
  /** 이만큼 연달아 굶으면 말이 마구간으로 돌아가 버린다 */
  runAwayAfterHungryDays: 3,

  /**
   * NPC 상단: 이만큼 돈이 있으면 마구간에서 말을 사고, 이보다 적어지면 마구간에 되판다
   * (먹이값에 밑천이 바닥나 말이 굶다 도망치는 일이 되풀이되지 않게). 말이 있으면 싣는 양이 늘어난다
   */
  /**
   * NPC 상단은 마구간에 말이 이보다 많이 남았을 때만 산다 (0.0.7: 시즌 말 수를 플레이어 몫으로 늘렸다.
   * 상단이 말을 다 사 가면 광석을 더 실어 날라 광맥이 적은 맵에서 대장장이 재료가 마른다)
   */
  traderLeaveStock: 6,
  traderBuyGold: 1000,
  traderSellGold: 400,
  traderCapacity: { pony: 1.3, draft: 2, swift: 1.5 },
} as const;

/**
 * 성장은 단계가 아니라 가진 것이다 (기획서 "성장", 0.0.5). 숫자는 모두 초안이며 플레이어 봇으로 맞춘다.
 * 수레(CART), 말(HORSES), 장비(ECONOMY.expedition.gear)는 각자의 자리에 있고, 새로 사는 것은 여기에 둔다.
 */
export const GROWTH = {
  /**
   * 여관 고용 게시판 (시안 prototypes/screens-0.0.5.html). wage는 일당 기준값.
   * 일꾼은 그 마을 NPC 일꾼 중에서 데려오고, 일손이 모자랄수록 일당이 오른다
   */
  hire: {
    porter: { name: '짐꾼', wage: 6 },
    gatherer: { name: '채집꾼', wage: 9 },
    /** 마부 (0.0.9): 행렬이 길에 있거나 장날 신청을 낸 날은 wage, 쉬는 날(지시 없이 서 있거나 행렬을 맡지 않은 날)은 restWage */
    carter: { name: '마부', wage: 12, restWage: 4 },
    informant: { name: '정보원', wage: 20 },
    /** 일당 배율의 아래·위 한도 (일손 사정) */
    wageFactor: [0.7, 2],
    /** 그 일을 하는 마을 일꾼이 이만큼보다 적으면 일당이 오른다 (한 명 모자랄 때마다 이만큼) */
    scarceBelow: 3,
    scarceStep: 0.2,
    /** 고용할 때 하루치 일당을 미리 준다 (먼저 받는 돈) */
    advanceDays: 1,
    /** 마을 일꾼이 이만큼 이하로 남으면 게시판에 사람이 나오지 않는다 */
    minLeft: 2,
  },
  /** 채집꾼: 카드 선택 없이 평균 결과로 매일 원정. 직접 하는 것보다 이만큼만 (맡긴 일은 효율이 낮다) */
  gathererShare: 0.7,
  /** 창고: 마을마다 빌리는 칸 판 */
  warehouse: {
    name: '창고',
    rows: ['#####', '#####', '#####'],
    /** 하루 보관료: 짐이 차지한 칸 이만큼마다 1냥 (올림). 빈 창고는 0, 꽉 찬 15칸은 3 (0.0.8: 칸 수만큼) */
    cellsPerCoin: 5,
    deposit: 10,
    maxOwedDays: 10,
    /** 창고는 수레보다 높이 쌓는다: 한 조각에 쌓는 양이 수레의 이 배 (0.0.7 시간차 장사: 철 지나 팔 만큼 모아 둔다) */
    stackFactor: 4,
  },
  /** 두 번째 행렬: 마부가 지시서대로 움직인다. 짐은 알아서 싣기(칸의 이 비율까지) */
  caravan: { autoLoadShare: 0.8, maxStops: 5 },
  /** 은행은 도시에만 (구조만, 0.0.5) */
  bank: { depositRate: 0.04, loanRate: 0.1 },
} as const;

/**
 * 수레 인벤토리 (기획서 "수레 인벤토리"). 모양과 쌓기 수는 기획서 초안, 무게는 개발 초안.
 * 모양 칸 좌표는 [x, y], 수레 그림은 '#'가 실을 수 있는 칸.
 */
export const CART = {
  /** 시작은 등짐 하나 (기획서 "시작 조건") */
  start: 'pack',
  /**
   * 수레는 칸만 정한다. 끄는 무게는 말이 정한다 (기획서 "말", 0.0.4).
   * humanPull: 말 없이 사람이 끌 때 무게 (등짐, 손수레만). horses: 움직이려면 있어야 하는 말 수.
   * price: 수레방 값 (개발 초안). 바꿀 때 쓰던 수레는 tradeIn 비율로 쳐 준다
   */
  types: {
    pack: { name: '등짐', rows: ['###', '###', '###'], humanPull: 30, horses: 0, price: 0 },
    handcart: { name: '손수레', rows: ['.####.', '######', '######'], humanPull: 70, horses: 0, price: 60 },
    wagon: { name: '짐수레', rows: ['#######', '#######', '#######', '.#####.'], humanPull: 0, horses: 1, price: 180 },
    carriage: { name: '마차', rows: ['.######.', '########', '########', '########', '########'], humanPull: 0, horses: 2, price: 420 },
  },
  tradeIn: 0.5,
  /**
   * 행렬 수레 빌리기 (0.0.9): 두 번째 행렬을 꾸릴 때 수레방에서 하루 값을 내고 빌린다. 행렬을 풀면 돌려준다(돌려받는 돈 없음).
   * 큰 주문 한 번 다녀오는 데 수레를 사고 반값에 되팔면 안 맞아서 (questions.md 77번). 초안
   */
  rentPerDay: { pack: 0, handcart: 2, wagon: 5, carriage: 10 },
  goods: {
    // 가죽·생선 2칸 가로, 고기 2칸 세로, 곡물 2×2, 목재 1×3, 광석·소금 1칸, 도구·염장 통 ㄱ자 3칸
    fish: { shape: [[0, 0], [1, 0]], stack: 2, weight: 1 },
    meat: { shape: [[0, 0], [0, 1]], stack: 2, weight: 2 },
    grain: { shape: [[0, 0], [1, 0], [0, 1], [1, 1]], stack: 1, weight: 3 },
    wood: { shape: [[0, 0], [1, 0], [2, 0]], stack: 2, weight: 3 },
    leather: { shape: [[0, 0], [1, 0]], stack: 4, weight: 1 },
    ore: { shape: [[0, 0]], stack: 3, weight: 3 },
    salt: { shape: [[0, 0]], stack: 3, weight: 2 },
    salted: { shape: [[0, 0], [0, 1], [1, 1]], stack: 1, weight: 3 },
    tools: { shape: [[0, 0], [0, 1], [1, 1]], stack: 1, weight: 2 },
  },
} as const;
