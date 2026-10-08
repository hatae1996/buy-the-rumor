// 봇 돌리기: 플레이어 봇을 성향별로 한 시즌 돌려 순자산이 어떻게 느는지 본다 (기획서 "숫자를 맞출 기준").
// 플레이어 자리가 하나라 봇마다 같은 시드의 세계를 따로 돌린다 (서로 경쟁하지 않는다).
import { CYCLE_DAYS } from '../sim/season';
import { BOT_PROFILES, runBot, type BotRun } from '../sim/bot';
import { generateWorld, type WorldMap } from '../sim/worldgen';
import { renderLineChart, SERIES_COLORS } from './lineChart';

/** 여러 시드 요약에 쓰는 시드 (안정성 테스트와 같은 5개 + 5개) */
const SUMMARY_SEEDS = [20261008, 777, 4242, 1, 99999, 2, 13, 34, 144, 2026];

export interface BotPanel {
  reset(map: WorldMap): void;
}

export function mountBotPanel(root: HTMLElement): BotPanel {
  root.innerHTML = `
    <h2 class="dev-h2">봇 돌리기</h2>
    <p class="dev-mono">봇은 플레이어가 보는 것(지금 마을 시세, 기억, 카드 힌트)만 보고 명령으로 움직인다. 순자산 = 현금 + 맡긴 돈 + 짐 × 절반.</p>
    <div class="dev-bar">
      <button type="button" class="dev-btn" data-bot-run>이 시드로 한 시즌</button>
      <button type="button" class="dev-btn alt" data-bot-many>시드 ${SUMMARY_SEEDS.length}개 요약</button>
    </div>
    <section class="dev-slip"><h2>순자산 (성향별)</h2><div class="dev-chart-box" data-bot-chart></div></section>
    <section class="dev-slip"><h2>한 시즌 결과</h2><div class="dev-scroll"><table class="dev-table" data-bot-table></table></div></section>
    <section class="dev-slip"><h2>시드 여러 개 (시즌 중반 · 끝 순자산)</h2><div class="dev-scroll"><table class="dev-table" data-bot-many-table></table></div></section>
  `;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  let map: WorldMap | null = null;

  const busy = (el: HTMLElement, text: string, work: () => void) => {
    el.innerHTML = `<tr><td>${text}</td></tr>`;
    // 글자가 먼저 그려지게 한 박자 쉬고 돌린다
    setTimeout(work, 30);
  };

  $('[data-bot-run]').addEventListener('click', () => {
    if (!map) return;
    const m = map;
    busy($('[data-bot-table]'), '돌리는 중…', () => {
      const runs = BOT_PROFILES.map((p) => runBot(m.requestedSeed, p, { days: CYCLE_DAYS }, m));
      renderLineChart(
        $('[data-bot-chart]'),
        runs.map((r, i) => ({ name: r.profile.name, color: SERIES_COLORS[i % SERIES_COLORS.length]!, values: r.worth })),
        { firstDay: 1, height: 220 },
      );
      $('[data-bot-table]').innerHTML = runTable(runs);
    });
  });

  $('[data-bot-many]').addEventListener('click', () => {
    busy($('[data-bot-many-table]'), `시드 ${SUMMARY_SEEDS.length}개 돌리는 중… (몇 초 걸려요)`, () => {
      const rows = BOT_PROFILES.map((p) => {
        const runs = SUMMARY_SEEDS.map((seed) => runBot(seed, p, { days: CYCLE_DAYS }, generateWorld(seed)));
        const mid = runs.map((r) => r.worth[Math.floor(CYCLE_DAYS / 2) - 1]!);
        const end = runs.map((r) => r.worth.at(-1)!);
        return `<tr><th>${p.name}</th><td>${spread(mid)}</td><td>${spread(end)}</td><td>${end.filter((v) => v < runs[0]!.worth[0]!).length}</td></tr>`;
      });
      $('[data-bot-many-table]').innerHTML =
        `<tr><th>성향</th><th>중반 (최소 · 가운데 · 최대)</th><th>끝 (최소 · 가운데 · 최대)</th><th>잃은 시드</th></tr>` + rows.join('');
    });
  });

  return {
    reset(m) {
      map = m;
      $('[data-bot-chart]').innerHTML = '<p class="dev-mono">버튼을 눌러 돌려 보세요.</p>';
      $('[data-bot-table]').innerHTML = '';
    },
  };
}

function runTable(runs: BotRun[]): string {
  const mid = Math.floor(CYCLE_DAYS / 2) - 1;
  const head = '<tr><th>성향</th><th>중반</th><th>끝</th><th>최고</th><th>거래</th><th>원정</th><th>이동</th><th>하루 명령</th><th>틀린 명령</th></tr>';
  return (
    head +
    runs
      .map((r) => {
        const errors = Object.entries(r.errors)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ');
        return `<tr><th>${r.profile.name}</th><td>${r.worth[mid]}</td><td>${r.worth.at(-1)}</td><td>${Math.max(...r.worth)}</td><td>${r.trades}</td><td>${r.expeditions}</td><td>${r.travels}</td><td>${r.commandsPerDay.toFixed(1)}</td><td>${errors || '없음'}</td></tr>`;
      })
      .join('')
  );
}

function spread(values: number[]): string {
  const s = [...values].sort((a, b) => a - b);
  return `${s[0]} · ${s[Math.floor(s.length / 2)]} · ${s.at(-1)}`;
}
