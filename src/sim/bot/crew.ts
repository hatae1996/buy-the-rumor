// 로컬 게임의 봇 상인 (질문 87 답, 0.1.0): 서버 없이도 같은 시장에 경쟁 상인이 있다.
// 봇은 사람과 같은 명령으로 움직이고(화면 데이터만 보고), 밤 차례도 시드로 섞인다.
// 봇의 머릿속(BotBrain)은 세계 상태 밖에 두고 함께 저장한다 (서버에서는 봇이 따로 접속하는 손님이다).
import type { EconomyState, PlayerId, PlayerSpec } from '../economy';
import { playerOrder } from '../economy';
import { createRng, mixSeed, shuffle } from '../rng';
import type { WorldMap } from '../worldgen';
import type { BotMind } from './bot';
import { createMind } from './bot';
import { MARKET_MIX } from './market';
import { botProfile, type BotProfileId } from './profiles';
import { botTurn, createSeat } from './run';

/** 봇 상단 이름 (그럴듯한 이름 목록). 세계마다 시드로 섞어 겹치지 않게 나눠 준다 */
export const BOT_COMPANY_NAMES: readonly string[] = [
  '잿빛 까마귀 상단',
  '붉은 여우 상단',
  '은빛 송어 상단',
  '늙은 떡갈나무 상단',
  '푸른 돛 상단',
  '검은 모루 상단',
  '황금 보리 상단',
  '하얀 사슴 상단',
  '녹슨 닻 상단',
  '졸린 부엉이 상단',
  '세 등불 상단',
  '바람개비 상단',
  '소금 바람 상단',
  '구리 저울 상단',
  '떠돌이 곰 상단',
  '이끼 낀 다리 상단',
  '새벽 종 상단',
  '두 염소 상단',
  '북쪽 별 상단',
  '빨간 지붕 상단',
  '느린 거북 상단',
  '굽은 못 상단',
  '젖은 장화 상단',
  '꿀벌 상단',
];

/** 봇의 머릿속 (저장할 수 있는 데이터) */
export interface BotBrain {
  pid: PlayerId;
  profile: BotProfileId;
  mind: BotMind;
  /** 판단 난수 상태 */
  rng: number;
}

/** 봇 상인 n명의 자리 (id, 상단 이름). 많아야 이름 목록 수만큼 */
export function botSpecs(seed: number, n: number): PlayerSpec[] {
  const names = shuffle([...BOT_COMPANY_NAMES], createRng(mixSeed(seed, 0xc0a1)));
  return Array.from({ length: Math.min(n, names.length) }, (_, i) => ({ id: `bot${i + 1}`, name: names[i]! }));
}

/** 세계의 봇 자리마다 머릿속을 만든다. 성향은 봇 여럿 시험과 같은 섞기 */
export function createCrew(state: EconomyState, pids: readonly PlayerId[]): BotBrain[] {
  return pids.map((pid, i) => {
    const profile = MARKET_MIX[i % MARKET_MIX.length]!;
    const seat = createSeat(state, pid, profile);
    return { pid, profile: profile.id, mind: createMind(), rng: seat.rng.state() };
  });
}

/** 장날 전에: 봇마다 오늘 차례대로 명령을 낸다 */
export function crewDay(state: EconomyState, map: WorldMap, crew: readonly BotBrain[], max = 40): void {
  const byId = new Map(crew.map((b) => [b.pid, b]));
  for (const p of playerOrder(state)) {
    const brain = byId.get(p.id);
    if (!brain) continue;
    const rng = createRng(brain.rng);
    botTurn(state, map, brain.pid, botProfile(brain.profile), brain.mind, rng, max);
    brain.rng = rng.state();
  }
}
