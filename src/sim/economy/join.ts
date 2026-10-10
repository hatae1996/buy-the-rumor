// 시즌 중간에 세계에 한 사람을 더 앉힌다 (0.2.0 작업목록 7·8번): 견습을 마친 사람, 1일 장날 직전에 채우는 봇.
// createEconomy는 세계를 만들 때만 플레이어를 받으므로, 들어온 차례(seq)를 이어서 매기고 같은 모양의 플레이어를 만든다.
import type { Cart, CartType } from '../cart';
import { ALL_UNLOCKS } from '../apprentice/progress';
import type { UnlockId } from '../apprentice/types';
import type { NotifySettings } from '../notify/types';
import { ensurePlayerRecord } from '../ranking/record';
import { cleanCompanyName, setEmblem, setFace } from '../ranking/certificate';
import { newPlayer, seededStartTown, type PlayerSpec } from './create';
import { playerList } from './players';
import type { EconomyState, PlayerState } from './state';

/** 견습 세계에서 들고 나오는 것 (답 111: 돈, 짐, 손수레, 여행 식량. 시세 기억·소문·신문·장부는 두고 온다) */
export interface JoinKit {
  gold: number;
  /** 짐과 여행 식량이 실린 수레 (신선도는 날 수가 아니라 상한 정도라 다른 세계로 옮겨도 그대로) */
  cart: Cart<CartType>;
  /** 견습 동안 열린 화면 (탭이 다시 닫히지 않게). 없으면 모두 열린 채로 (봇) */
  unlocks?: readonly UnlockId[];
  /** 견습 동안 고친 알림 설정 */
  notify?: NotifySettings;
}

/**
 * 오늘의 세계에 한 사람을 앉힌다. town: 처음 서 있을 마을 (견습을 마친 사람은 견습 마을, 없으면 들어온 차례로 랜덤).
 * 시즌 기록은 들어온 날부터 연다 (수완가 부문의 시작 자금은 들고 온 것의 값)
 */
export function joinPlayer(state: EconomyState, spec: PlayerSpec, town: number | null, kit?: JoinKit): PlayerState {
  if (state.players[spec.id]) throw new Error(`이미 있는 플레이어: ${spec.id}`);
  const seq = Math.max(-1, ...playerList(state).map((p) => p.seq)) + 1;
  town ??= seededStartTown(state.seed, seq, state.towns.length);
  const p = newPlayer(spec.id, seq, town, state.seed, spec.merchantNo === undefined ? seq + 1 : spec.merchantNo);
  p.homeTown = town;
  p.visited = [town];
  if (spec.name) p.certificate.name = cleanCompanyName(spec.name) ?? p.certificate.name;
  if (spec.emblem) setEmblem(p.certificate, spec.emblem);
  if (spec.face) setFace(p.certificate, spec.face);
  for (const id of kit?.unlocks ?? ALL_UNLOCKS) p.unlocks[id] = state.day;
  if (kit) {
    p.gold = kit.gold;
    // 견습 세계의 장 신청 자리는 두고 온다
    p.cart = { ...copy(kit.cart), pieces: kit.cart.pieces.map((q) => ({ ...copy(q), incoming: [] })) };
    if (kit.notify) p.notify = copy(kit.notify);
  }
  state.players[spec.id] = p;
  ensurePlayerRecord(state, p);
  return p;
}

/** 시뮬 상태는 JSON으로 저장하는 모양이라 JSON으로 복사한다 (시뮬은 호스트 API를 쓰지 않는다) */
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
