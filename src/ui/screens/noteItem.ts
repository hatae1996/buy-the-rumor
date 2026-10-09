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

/**
 * 최근 들은 이야기 한 장 (0.1.2): 누구에게, 어디서, 무엇을 들었는지와 "수첩에 적기 / 흘려듣기".
 * 흘려들은 것은 흐리게, 며칠 남는 동안은 다시 적을 수 있다
 */
export function heardCard(n: NoteView, today: number, townName: (id: number) => string): string {
  return `<li class="note heard${n.dismissed ? ' dismissed' : ''}">
    <div class="note-meta"><span class="day">${agoText(today, n.day)} · ${townName(n.town)} · ${n.from}</span>${n.dismissed ? '<span class="unchecked">흘려들음</span>' : ''}</div>
    <p class="note-text">${n.text}</p>
    <div class="btn-row">
      <button type="button" class="secondary-btn" data-note-rumor="${n.id}">수첩에 적기</button>
      ${n.dismissed ? '' : `<button type="button" class="link-btn" data-dismiss-rumor="${n.id}">흘려듣기</button>`}
    </div>
  </li>`;
}

/** 적기 / 흘려듣기 단추를 명령에 잇는다 */
export function wireHeard(el: HTMLElement, send: (cmd: { type: 'noteRumor' | 'dismissRumor'; id: number }) => unknown): void {
  el.querySelectorAll<HTMLButtonElement>('[data-note-rumor]').forEach((b) =>
    b.addEventListener('click', () => send({ type: 'noteRumor', id: Number(b.dataset.noteRumor) })),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-dismiss-rumor]').forEach((b) =>
    b.addEventListener('click', () => send({ type: 'dismissRumor', id: Number(b.dataset.dismissRumor) })),
  );
}
