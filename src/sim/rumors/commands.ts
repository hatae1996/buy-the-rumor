// 소문 명령: 여관에서 술 한 잔, 전서구 보내기, 정보원 심기와 거두기.
// 돈은 모두 경제에서 빠져나간다 (여관비와 같다).
import { RUMORS } from '../constants';
import type { EconomyState } from '../economy/state';
import type { WorldMap } from '../worldgen';
import { innRumor } from './hear';
import { addNote } from './notebook';

export type RumorError = 'alreadyDrank' | 'noRumor' | 'alreadyInformant' | 'noInformant';
type Err = RumorError | 'traveling' | 'notEnoughGold' | 'noTown' | 'sameTown';

export function drinkFee(state: EconomyState, town: number): number {
  return state.towns[town]!.tier === 'city' ? RUMORS.innDrink.city : RUMORS.innDrink.town;
}

/** 여관에서 술 한 잔을 사고 여행자에게 소문 하나를 더 듣는다 (하루 한 번) */
export function buyDrink(state: EconomyState, map: WorldMap): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  if (p.drankToday) return 'alreadyDrank';
  const fee = drinkFee(state, p.town);
  if (p.gold < fee) return 'notEnoughGold';
  const found = innRumor(state, map);
  // 들려줄 이야기가 없으면 돈을 받지 않는다
  if (!found) return 'noRumor';
  p.gold -= fee;
  p.drankToday = true;
  p.ledger.push({ day: state.day, kind: 'info', what: 'drink', town: p.town, fee });
  addNote(state, {
    town: p.town,
    text: found.told.text,
    via: 'inn',
    from: '여관 손님',
    gossip: null,
    rumor: found.rumor.id,
    importance: found.told.importance,
    claim: found.told.claim,
  });
  return null;
}

/** 먼 마을로 전서구를 보낸다. 장날이 끝나면 그 마을 오늘 시세를 갖고 온다 */
export function sendPigeon(state: EconomyState, to: number): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  if (!state.towns[to]) return 'noTown';
  if (to === p.town) return 'sameTown';
  if (p.gold < RUMORS.pigeonFee) return 'notEnoughGold';
  p.gold -= RUMORS.pigeonFee;
  p.pigeons.push({ town: to, day: state.day });
  p.ledger.push({ day: state.day, kind: 'info', what: 'pigeon', town: to, fee: RUMORS.pigeonFee });
  return null;
}

/** 지금 마을에 정보원을 심는다 */
export function hireInformant(state: EconomyState): Err | null {
  const p = state.player;
  if (p.travel) return 'traveling';
  if (p.informants.includes(p.town)) return 'alreadyInformant';
  if (p.gold < RUMORS.informant.hireFee) return 'notEnoughGold';
  p.gold -= RUMORS.informant.hireFee;
  p.informants.push(p.town);
  p.ledger.push({ day: state.day, kind: 'info', what: 'informant', town: p.town, fee: RUMORS.informant.hireFee });
  return null;
}

export function dismissInformant(state: EconomyState, town: number): Err | null {
  const p = state.player;
  if (!p.informants.includes(town)) return 'noInformant';
  p.informants = p.informants.filter((t) => t !== town);
  return null;
}
