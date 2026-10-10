// 게임 상태가 바뀌면 다시 그리는 페이지 (여관처럼 안에서 명령을 여러 번 보내는 화면). liveSheet의 페이지판.
import type { PlayerView } from '../sim/economy';
import { ERROR_TEXT } from './format';
import type { Game } from './game';
import { openPage, type Page } from './page';

export interface LivePage extends Page {
  /** 명령을 보내고, 실패하면 페이지 아래에 까닭을 띄운다 */
  send: (cmd: Parameters<Game['dispatch']>[0]) => boolean;
  /** 지금 상태로 다시 그린다 (페이지 안의 작은 탭을 바꿀 때) */
  redraw: () => void;
}

export function openLivePage(
  game: Game,
  opts: { back: string; title: string; sub?: string; icon?: string },
  render: (body: HTMLElement, v: PlayerView, page: LivePage) => void,
): LivePage {
  let error = '';
  const base = openPage(opts);
  const draw = () => {
    render(base.body, game.view(), page);
    if (error) base.body.insertAdjacentHTML('beforeend', `<p class="error">${error}</p>`);
  };
  const page: LivePage = {
    ...base,
    send(cmd) {
      const r = game.dispatch(cmd);
      error = r.ok ? '' : ERROR_TEXT[r.error];
      if (!r.ok) draw();
      return r.ok;
    },
    redraw: () => draw(),
  };
  const unsub = game.subscribe(() => {
    error = '';
    draw();
  });
  base.onClose(unsub);
  draw();
  return page;
}
