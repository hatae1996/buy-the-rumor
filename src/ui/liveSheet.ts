// 게임 상태가 바뀌면 다시 그리는 쪽지 (건물 쪽지처럼 안에서 명령을 여러 번 보내는 화면).
import type { PlayerView } from '../sim/economy';
import { ERROR_TEXT } from './format';
import type { Game } from './game';
import { openSheet, type Sheet } from './sheet';

export interface LiveSheet extends Sheet {
  /** 명령을 보내고, 실패하면 쪽지 아래에 까닭을 띄운다. 답이 올 때까지 쪽지의 단추를 잠근다(서버 게임) */
  send: (cmd: Parameters<Game['dispatch']>[0]) => Promise<boolean>;
}

export function openLiveSheet(game: Game, title: string, render: (body: HTMLElement, v: PlayerView, sheet: LiveSheet) => void): LiveSheet {
  let unsub = () => {};
  let error = '';
  const base = openSheet(title, () => unsub());
  const sheet: LiveSheet = {
    ...base,
    async send(cmd) {
      if (base.body.getAttribute('aria-busy') === 'true') return false;
      base.body.setAttribute('aria-busy', 'true');
      try {
        const r = await game.dispatch(cmd);
        error = r.ok ? '' : ERROR_TEXT[r.error];
        if (!r.ok) draw();
        return r.ok;
      } finally {
        base.body.removeAttribute('aria-busy');
      }
    },
  };
  const draw = () => {
    render(base.body, game.view(), sheet);
    if (error) base.body.insertAdjacentHTML('beforeend', `<p class="error">${error}</p>`);
  };
  unsub = game.subscribe(() => {
    error = '';
    draw();
  });
  draw();
  return sheet;
}
