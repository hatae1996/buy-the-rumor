// 들은 이야기 수첩: 누구에게, 언제, 어디서 들었는지와 함께 적는다.
import { RUMORS } from '../constants';
import type { EconomyState, PlayerState } from '../economy/state';
import type { HeardRumor } from './types';
import { noteOmenHeard } from '../ranking/record';

export type NoteInput = Omit<HeardRumor, 'id' | 'day' | 'stamp' | 'stampDay'>;

/**
 * 수첩에 한 줄 적는다. 너무 길어지면 오래된 줄부터 지운다.
 * pending이면 아직 적지 않은 "최근 들은 이야기"로 둔다 (0.1.2: 여관에서 들은 뒤 적기 / 흘려듣기를 고른다)
 */
export function addNote(state: EconomyState, p: PlayerState, note: NoteInput, opt: { pending?: boolean } = {}): HeardRumor {
  const entry: HeardRumor = { id: state.rumorMill.nextId++, day: state.day, ...note, stamp: null, stampDay: null };
  if (opt.pending) entry.noted = false;
  p.rumors.push(entry);
  // 랭킹 Buy the Rumor: 사건 징조를 언제 들었나 (적은 것만, 질문 95 기본안)
  if (!opt.pending && note.claim?.kind === 'omen') noteOmenHeard(state, p, note.claim.event, note.claim.town);
  if (p.rumors.length > RUMORS.notebookMax) p.rumors.splice(0, p.rumors.length - RUMORS.notebookMax);
  return entry;
}

export type NoteError = 'noNote';

/** 들은 이야기를 수첩에 적는다. 도장은 적은 것에만 찍히고, Buy the Rumor도 적은 날부터 센다 */
export function noteRumor(state: EconomyState, p: PlayerState, id: number): NoteError | null {
  const h = p.rumors.find((x) => x.id === id && x.noted === false);
  if (!h) return 'noNote';
  h.noted = true;
  delete h.dismissed;
  if (h.claim?.kind === 'omen') noteOmenHeard(state, p, h.claim.event, h.claim.town);
  return null;
}

/** 흘려듣는다: 수첩에 적지 않는다 (최근 들은 이야기에 며칠 남았다가 사라진다. 그동안은 다시 적을 수 있다) */
export function dismissRumor(p: PlayerState, id: number): NoteError | null {
  const h = p.rumors.find((x) => x.id === id && x.noted === false);
  if (!h) return 'noNote';
  h.dismissed = true;
  return null;
}

/** 밤에: 적지 않은 이야기 중 오래된 것을 지운다 (들은 날부터 recentDays일 동안 보이고, 그 마지막 날 밤에 사라진다) */
export function pruneHeard(state: EconomyState, p: PlayerState): void {
  p.rumors = p.rumors.filter((h) => h.noted !== false || state.day - h.day < RUMORS.recentDays - 1);
}

/** 원정에서 직접 본 것 (항상 맞는다) */
export function noteSeen(state: EconomyState, p: PlayerState, town: number, text: string): HeardRumor {
  return addNote(state, p, { town, text, via: 'seen', from: '원정에서 직접 봄', gossip: null, rumor: null, importance: 2, claim: null });
}
