// 봇 돌리기: 플레이어 봇을 성향별로 한 시즌 돌려 순자산이 어떻게 느는지 본다 (기획서 "숫자를 맞출 기준").
// 플레이어 자리가 하나라 봇마다 같은 시드의 세계를 따로 돌린다 (서로 경쟁하지 않는다).
import { CYCLE_DAYS, SEASON_NAME, type Season } from '../sim/season';
import { BOT_PROFILES, bigDays, dailyIncome, profitIncome, runBot, seasonIncome, type BotProfile, type BotRun, type GrowthKind } from '../sim/bot';
import { generateWorld, type WorldMap } from '../sim/worldgen';
import { renderLineChart, SERIES_COLORS } from './lineChart';

/** 여러 시드 요약에 쓰는 시드 (봇 테스트와 같은 5개). 시작 계절 4개마다 돌린다 (0.0.8: 시작 계절은 시즌마다 랜덤) */
const SUMMARY_SEEDS = [20261008, 777, 4242, 1, 99999];
const SEASONS: Season[] = [0, 1, 2, 3];

export interface BotPanel {
  reset(map: WorldMap): void;
}

export function mountBotPanel(root: HTMLElement): BotPanel {
  root.innerHTML = `
    <h2 class="dev-h2">봇 돌리기</h2>
    <p class="dev-mono">봇은 플레이어가 보는 것(지금 마을 시세, 기억, 카드 힌트)만 보고 명령으로 움직인다. 순자산 = 현금 + 맡긴 돈 + 짐 × 절반.</p>
    <div class="dev-bar">
      <button type="button" class="dev-btn" data-bot-run>이 시드로 한 시즌</button>
      <button type="button" class="dev-btn alt" data-bot-many>시작 계절 4개 × 시드 ${SUMMARY_SEEDS.length}개 요약</button>
    </div>
    <div class="dev-bar" role="group" aria-label="한 시즌 돌릴 때 시작 계절">
      <button type="button" class="dev-btn alt" data-bot-season="" aria-pressed="true">시드대로</button>
      ${SEASONS.map((s) => `<button type="button" class="dev-btn alt" data-bot-season="${s}" aria-pressed="false">${SEASON_NAME[s]} 시작</button>`).join('')}
    </div>
    <section class="dev-slip"><h2>순자산 (성향별)</h2><div class="dev-chart-box" data-bot-chart></div></section>
    <section class="dev-slip"><h2>한 시즌 결과</h2><div class="dev-scroll"><table class="dev-table" data-bot-table></table></div></section>
    <section class="dev-slip"><h2>시작 계절별 요약 (가운데 값)</h2>
      <p class="dev-mono">하루 벌이 = 그날 판 것의 이익 (판 값 − 산 값, 원정에서 얻은 것은 산 값 0). 첫 5일만 가진 것의 온값이 하루에 는 양 (처음엔 사 모아 두는 것도 좋은 장사라서, 0.0.9). 목표: 첫 5일 5~10, 67일 20~40, 후반 평균 &gt; 전반 평균, 10배 번 날 2~3번, 유지비는 벌이의 20~30%.</p>
      <div class="dev-scroll"><table class="dev-table" data-bot-many-table></table></div></section>
  `;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  let map: WorldMap | null = null;
  let startSeason: Season | undefined;

  root.querySelectorAll<HTMLButtonElement>('[data-bot-season]').forEach((btn) =>
    btn.addEventListener('click', () => {
      startSeason = btn.dataset.botSeason ? (Number(btn.dataset.botSeason) as Season) : undefined;
      root.querySelectorAll('[data-bot-season]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    }),
  );

  const busy = (el: HTMLElement, text: string, work: () => void) => {
    el.innerHTML = `<tr><td>${text}</td></tr>`;
    // 글자가 먼저 그려지게 한 박자 쉬고 돌린다
    setTimeout(work, 30);
  };

  $('[data-bot-run]').addEventListener('click', () => {
    if (!map) return;
    const m = map;
    busy($('[data-bot-table]'), '돌리는 중…', () => {
      const runs = BOT_PROFILES.map((p) => runBot(m.requestedSeed, p, { days: CYCLE_DAYS, startSeason }, m));
      renderLineChart(
        $('[data-bot-chart]'),
        runs.map((r, i) => ({ name: r.profile.name, color: SERIES_COLORS[i % SERIES_COLORS.length]!, values: r.worth })),
        { firstDay: 1, height: 220 },
      );
      $('[data-bot-table]').innerHTML = runTable(runs);
    });
  });

  let manyRunning = false;
  $('[data-bot-many]').addEventListener('click', () => {
    if (manyRunning) return;
    manyRunning = true;
    const table = $('[data-bot-many-table]');
    const worlds = SUMMARY_SEEDS.map((seed) => generateWorld(seed));
    // 한 판씩 쉬어 가며 돌린다 (한 판에 몇 초 걸려 화면이 멈추지 않게). 계절·성향 묶음이 끝날 때마다 줄을 그린다
    const jobs = SEASONS.flatMap((season) => BOT_PROFILES.map((profile) => ({ season, profile })));
    const total = jobs.length * SUMMARY_SEEDS.length;
    const rows: string[] = [];
    const all = new Map<string, BotRun[]>();
    let runs: BotRun[] = [];
    let done = 0;
    const draw = (status: string) => {
      table.innerHTML = SUMMARY_HEAD + rows.join('') + (status ? `<tr><td colspan="13">${status}</td></tr>` : '');
    };
    const next = () => {
      const job = jobs[Math.floor(done / SUMMARY_SEEDS.length)]!;
      const i = done % SUMMARY_SEEDS.length;
      runs.push(runBot(SUMMARY_SEEDS[i]!, job.profile, { days: CYCLE_DAYS, startSeason: job.season }, worlds[i]));
      done++;
      if (runs.length === SUMMARY_SEEDS.length) {
        rows.push(summaryRow(SEASON_NAME[job.season], job.profile, runs));
        all.set(job.profile.id, [...(all.get(job.profile.id) ?? []), ...runs]);
        runs = [];
      }
      if (done < total) {
        draw(`돌리는 중… ${done}/${total} 판`);
        setTimeout(next, 0);
        return;
      }
      // 네 계절을 합친 줄
      for (const profile of BOT_PROFILES) rows.push(summaryRow('모두', profile, all.get(profile.id)!));
      draw('');
      manyRunning = false;
    };
    draw(`돌리는 중… 0/${total} 판 (몇 분 걸려요)`);
    setTimeout(next, 30);
  });

  return {
    reset(m) {
      map = m;
      $('[data-bot-chart]').innerHTML = '<p class="dev-mono">버튼을 눌러 돌려 보세요.</p>';
      $('[data-bot-table]').innerHTML = '';
    },
  };
}

const SUMMARY_HEAD =
  '<tr><th>시작</th><th>성향</th><th>끝 순자산 (최소 · 가운데 · 최대)</th><th>잃은 판</th><th>하루 벌이 첫5일(온값) · 67일</th><th>시즌 평균</th><th>전반 → 후반 (후반이 높은 판)</th><th>끝 유지비 (평균 대비)</th><th>10배 번 날</th><th>큰 주문 (겨울)</th><th>행렬 꾸린 판</th><th>첫 말·짐꾼</th><th>첫 채집꾼·창고</th></tr>';

/** 같은 시작 계절, 같은 성향의 여러 판을 한 줄로 */
function summaryRow(season: string, p: BotProfile, runs: BotRun[]): string {
  const end = runs.map((r) => r.worth.at(-1)!);
  const lost = runs.filter((r) => r.worth.at(-1)! < r.worth[0]!).length;
  // 처음 산 날의 가운데 값 (안 산 판은 맨 뒤로)
  const first = (pick: (r: BotRun) => number | undefined) => medianDay(runs.map(pick), runs.length);
  const firstHorse = first((r) => minDay(r.firsts.horse, r.firsts.porter));
  const firstGather = first((r) => minDay(r.firsts.gatherer, r.firsts.warehouse));
  const income = (a: number, b: number) => median(runs.map((r) => profitIncome(r, a, b)));
  const s = runs.map(seasonIncome);
  const avg = median(s.map((x) => x.avg));
  const rising = s.filter((x) => x.secondHalf > x.firstHalf).length;
  const halves = `${median(s.map((x) => x.firstHalf))} → ${median(s.map((x) => x.secondHalf))} (${rising}/${runs.length})`;
  const upkeep = median(runs.map((r) => r.upkeep.at(-1) ?? 0));
  const share = avg > 0 ? `${Math.round((upkeep / avg) * 100)}%` : '-';
  const big = median(runs.map((r) => bigDays(r)));
  // 큰 주문 사건 수 평균, 그중 겨울 (0.0.8 목표: 시즌 2~4번, 겨울 비중을 높게)
  const mean = (f: (r: BotRun) => number) => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
  const orders = `${mean((r) => r.bigOrders.length)} (${mean((r) => r.bigOrders.filter((s) => s === 3).length)})`;
  return `<tr><th>${season}</th><th>${p.name}</th><td>${spread(end)}</td><td>${lost}/${runs.length}</td><td>${median(runs.map((r) => dailyIncome(r, 0, 5)))} · ${income(60, 74)}</td><td>${avg}</td><td>${halves}</td><td>${upkeep} (${share})</td><td>${big}</td><td>${orders}</td><td>${runs.filter((r) => r.firsts.caravan !== undefined).length}/${runs.length}</td><td>${firstHorse}</td><td>${firstGather}</td></tr>`;
}

function runTable(runs: BotRun[]): string {
  const mid = Math.floor(CYCLE_DAYS / 2) - 1;
  const head = '<tr><th>성향</th><th>시작</th><th>중반</th><th>끝</th><th>최고</th><th>거래</th><th>원정</th><th>이동</th><th>하루 명령</th><th>틀린 명령</th><th>처음 산 날</th></tr>';
  return (
    head +
    runs
      .map((r) => {
        const errors = Object.entries(r.errors)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ');
        const firsts = Object.entries(r.firsts)
          .map(([k, v]) => `${GROWTH_NAME[k as GrowthKind]} ${v}일`)
          .join(', ');
        return `<tr><th>${r.profile.name}</th><td>${SEASON_NAME[r.startSeason]}</td><td>${r.worth[mid]}</td><td>${r.worth.at(-1)}</td><td>${Math.max(...r.worth)}</td><td>${r.trades}</td><td>${r.expeditions}</td><td>${r.travels}</td><td>${r.commandsPerDay.toFixed(1)}</td><td>${errors || '없음'}</td><td>${firsts || '없음'}</td></tr>`;
      })
      .join('')
  );
}

const GROWTH_NAME: Record<GrowthKind, string> = {
  horse: '말',
  wagon: '짐수레',
  porter: '짐꾼',
  gatherer: '채집꾼',
  warehouse: '창고',
  caravan: '두 번째 행렬',
  gear: '장비',
};

const minDay = (...days: (number | undefined)[]) => {
  const d = days.filter((x): x is number => x !== undefined);
  return d.length ? Math.min(...d) : undefined;
};

/** 시드들 중 가운데 날. 안 산 시드는 맨 뒤로 친다. 절반 넘게 없으면 "없음" */
function medianDay(days: (number | undefined)[], n: number): string {
  const s = days.map((d) => d ?? Infinity).sort((a, b) => a - b);
  const m = s[Math.floor(n / 2)]!;
  const got = days.filter((d) => d !== undefined).length;
  return Number.isFinite(m) ? `${m}일 (${got}/${n})` : `없음 (${got}/${n})`;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)] ?? 0);
}

function spread(values: number[]): string {
  const s = [...values].sort((a, b) => a - b);
  return `${s[0]} · ${s[Math.floor(s.length / 2)]} · ${s.at(-1)}`;
}
