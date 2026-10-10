import './ui/theme.css';
import './ui/base.css';
import './ui/shell.css';
import './ui/screens.css';
import { clearSave, Game } from './ui/game';
import { mountShell } from './ui/shell';
import { watchPortraits } from './ui/portrait/portrait';
import { WORLD_TOWN_COUNTS } from './sim/worldgen';

// 시험용: 주소에 ?new 를 붙이면 저장을 지우고 새 판으로 시작한다.
// &bots=0~20: 봇 상인 수, &skip: 견습 건너뛰기(모든 것이 열린 채로), &days=10: 시즌을 그 날 수로 줄이기(결산 시험),
// &towns=4|6|8|12: 마을 수 (없으면 사람 수로 정한다)
const params = new URLSearchParams(location.search);
let game: Game;
if (params.has('new')) {
  clearSave();
  history.replaceState(null, '', location.pathname);
  const bots = params.get('bots');
  const days = params.get('days');
  const towns = params.get('towns');
  game = Game.fresh(Date.now(), Date.now() % 1_000_000_007, {
    ...(bots === null ? {} : { bots: Number(bots) }),
    ...(params.has('skip') ? { apprentice: false } : {}),
    ...(days === null ? {} : { seasonDays: Number(days) }),
    ...(towns !== null && WORLD_TOWN_COUNTS.includes(Number(towns)) ? { towns: Number(towns) } : {}),
  });
} else game = Game.start(Date.now());
watchPortraits();
mountShell(document.getElementById('app')!, game, () => Date.now());
document.documentElement.dataset.version = __APP_VERSION__;
