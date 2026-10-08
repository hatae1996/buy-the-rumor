// 들은 이야기 수첩: 누구에게, 언제, 어디서 들었는지와 함께 적는다.
import { RUMORS } from '../constants';
import type { EconomyState } from '../economy/state';
import type { HeardRumor } from './types';
import { noteOmenHeard } from '../ranking/record';

export type NoteInput = Omit<HeardRumor, 'id' | 'day' | 'stamp' | 'stampDay'>;

/** 수첩에 한 줄 적는다. 너무 길어지면 오래된 줄부터 지운다 */
export function addNote(state: EconomyState, note: NoteInput): HeardRumor {
  const p = state.player;
  const entry: HeardRumor = { id: state.rumorMill.nextId++, day: state.day, ...note, stamp: null, stampDay: null };
  p.rumors.push(entry);
  // 랭킹 Buy the Rumor: 사건 징조를 언제 들었나
  if (note.claim?.kind === 'omen') noteOmenHeard(state, note.claim.event, note.claim.town);
  if (p.rumors.length > RUMORS.notebookMax) p.rumors.splice(0, p.rumors.length - RUMORS.notebookMax);
  return entry;
}

/** 원정에서 직접 본 것 (항상 맞는다) */
export function noteSeen(state: EconomyState, town: number, text: string): HeardRumor {
  return addNote(state, { town, text, via: 'seen', from: '원정에서 직접 봄', gossip: null, rumor: null, importance: 2, claim: null });
}
