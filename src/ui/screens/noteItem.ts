// 수첩 한 줄: 언제·어디서·누구에게 들었는지와 맞았다/틀렸다 도장.
import type { NoteView } from '../../sim/economy';
import { agoText } from '../format';

export function stampHtml(n: NoteView): string {
  if (!n.stamp) return '';
  return `<span class="stamp ${n.stamp}">${n.stamp === 'right' ? '맞았다' : '틀렸다'}</span>`;
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
