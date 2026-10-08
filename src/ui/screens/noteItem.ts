// 수첩 한 줄: 언제·어디서·누구에게 들었는지와 맞았다/틀렸다 도장.
import type { NoteView } from '../../sim/economy';
import { agoText } from '../format';

const STAMP_TEXT = { right: '맞았다', wrong: '틀렸다', unchecked: '확인 못 함' } as const;

/** 도장. "확인 못 함"은 도장이 아니라 흐린 글씨다 (기한 안에 확인하지 못함, 0.0.6) */
export function stampHtml(n: NoteView): string {
  if (!n.stamp) return '';
  if (n.stamp === 'unchecked') return `<span class="unchecked">${STAMP_TEXT.unchecked}</span>`;
  return `<span class="stamp ${n.stamp}">${STAMP_TEXT[n.stamp]}</span>`;
}

export function noteItem(n: NoteView, today: number, townName: (id: number) => string): string {
  return `<li class="note">
    <div class="note-meta"><span class="day">${agoText(today, n.day)} · ${townName(n.town)} · ${n.from}</span>${stampHtml(n)}</div>
    <p class="note-text">${n.text}</p>
  </li>`;
}

/** 중요한 것부터 많아야 n개 (한 번 접속에 새 소문은 3~4개만 보여 준다) */
export function topNotes(notes: readonly NoteView[], n: number): NoteView[] {
  return [...notes].sort((a, b) => b.importance - a.importance || b.day - a.day).slice(0, n);
}
