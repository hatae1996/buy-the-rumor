import './ui/theme.css';
import './ui/base.css';
import './ui/shell.css';
import './ui/screens.css';
import { clearSave, Game } from './ui/game';
import { mountShell } from './ui/shell';
import { watchPortraits } from './ui/portrait/portrait';
import { openFounding } from './ui/screens/founding';
import { WORLD_TOWN_COUNTS } from './sim/worldgen';

// 시험용: 주소에 ?new 를 붙이면 저장을 지우고 새 판으로 시작한다.
// &bots=0~20: 봇 상인 수, &skip: 견습 건너뛰기(모든 것이 열린 채로), &days=10: 시즌을 그 날 수로 줄이기(결산 시험),
// &towns=4|6|8|12: 마을 수 (없으면 사람 수로 정한다)
const params = new URLSearchParams(location.search);
const app = document.getElementById('app')!;
watchPortraits();
const boot = (game: Game) => {
  mountShell(app, game, () => Date.now());
};

if (params.has('new')) {
  clearSave();
  history.replaceState(null, '', location.pathname);
}
const saved = Game.load();
if (saved) boot(saved);
else {
  // 처음 하는 사람: 시작 화면(상단 이름 → 얼굴 → 문장)을 지나 견습으로 (0.1.7). 다음 시즌에는 묻지 않는다
  const bots = params.get('bots');
  const days = params.get('days');
  const towns = params.get('towns');
  const seed = Date.now() % 1_000_000_007;
  openFounding(app, seed, (company) =>
    boot(
      Game.fresh(Date.now(), seed, {
        company,
        ...(bots === null ? {} : { bots: Number(bots) }),
        ...(params.has('skip') ? { apprentice: false } : {}),
        ...(days === null ? {} : { seasonDays: Number(days) }),
        ...(towns !== null && WORLD_TOWN_COUNTS.includes(Number(towns)) ? { towns: Number(towns) } : {}),
      }),
    ),
  );
}
document.documentElement.dataset.version = __APP_VERSION__;
