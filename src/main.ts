import './ui/theme.css';
import './ui/base.css';
import './ui/shell.css';
import './ui/screens.css';
import { clearSave, Game } from './ui/game';
import { mountShell } from './ui/shell';

// 시험용: 주소에 ?new 를 붙이면 저장을 지우고 새 판으로 시작한다
if (new URLSearchParams(location.search).has('new')) {
  clearSave();
  history.replaceState(null, '', location.pathname);
}

const game = Game.start(Date.now());
mountShell(document.getElementById('app')!, game, () => Date.now());
document.documentElement.dataset.version = __APP_VERSION__;
