// 경제 관찰: 날을 돌리며 시세, 통화량, 일꾼 수를 본다. 플레이어에게는 안 보이는 실제 수치다.
import { ECONOMY } from '../sim/constants';
import {
  advanceDay,
  createEconomy,
  GOOD_NAME,
  GOODS,
  hungryWorkers,
  JOB_NAME,
  JOBS,
  jobCounts,
  moneySupply,
  population,
  type DayReport,
  type EconomyState,
  type GoodId,
} from '../sim/economy';
import { RESOURCE_NAME, type WorldMap } from '../sim/worldgen';
import { seasonOfDay, SEASON_NAME } from '../sim/season';
import { eventDef, eventsAt } from '../sim/events';
import { renderLineChart, SERIES_COLORS } from './lineChart';

interface History {
  money: number[];
  /** pop[마을][날] */
  pop: number[][];
  /** price[마을][물품][날] (기준 시세) */
  price: Record<GoodId, number[]>[];
  reports: DayReport[];
}

export interface EconomyPanel {
  reset(map: WorldMap): void;
}

export function mountEconomyPanel(root: HTMLElement): EconomyPanel {
  root.innerHTML = `
    <h2 class="dev-h2">경제 관찰</h2>
    <div class="dev-bar">
      <button type="button" class="dev-btn" data-run="1">하루</button>
      <button type="button" class="dev-btn" data-run="30">30일</button>
      <button type="button" class="dev-btn" data-run="360">360일</button>
      <button type="button" class="dev-btn alt" data-reset>처음부터</button>
    </div>
    <div class="dev-tiles" data-tiles></div>
    <section class="dev-slip"><h2>무너지거나 폭주하지 않나</h2><ul data-checks></ul></section>
    <section class="dev-slip">
      <h2>물품 시세 (마을별)</h2>
      <div class="dev-bar dev-goods" role="group" aria-label="물품" data-goods>
        ${GOODS.map((g) => `<button type="button" class="dev-chip-btn" data-good="${g}">${GOOD_NAME[g]}</button>`).join('')}
      </div>
      <div class="dev-chart-box" data-price-chart></div>
    </section>
    <div class="dev-grid2">
      <section class="dev-slip"><h2>통화량</h2><div class="dev-chart-box" data-money-chart></div></section>
      <section class="dev-slip"><h2>일꾼 수 (마을별)</h2><div class="dev-chart-box" data-pop-chart></div></section>
    </div>
    <section class="dev-slip"><h2>오늘 장날 (기준 시세 · 거래량)</h2><div class="dev-scroll"><table class="dev-table" data-market></table></div></section>
    <section class="dev-slip"><h2>마을</h2><div class="dev-towns" data-towns></div></section>
    <section class="dev-slip"><h2>소식</h2><ul class="dev-news" data-news></ul></section>
    <section class="dev-slip"><h2>이번 시즌 사건 일정 (플레이어는 모름)</h2><div class="dev-scroll"><table class="dev-table" data-schedule></table></div></section>
  `;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  let map: WorldMap;
  let state: EconomyState;
  let hist: History;
  let startPop = 0;
  let good: GoodId = 'grain';

  const reset = (m: WorldMap) => {
    map = m;
    state = createEconomy(map, map.seed);
    startPop = population(state);
    hist = {
      money: [],
      pop: state.towns.map(() => []),
      price: state.towns.map(() => Object.fromEntries(GOODS.map((g) => [g, []])) as unknown as Record<GoodId, number[]>),
      reports: [],
    };
    render();
  };

  const run = (days: number) => {
    for (let d = 0; d < days; d++) {
      hist.reports.push(advanceDay(state, map));
      hist.money.push(moneySupply(state));
      state.towns.forEach((t) => {
        hist.pop[t.id]!.push(population(state, t.id));
        for (const g of GOODS) hist.price[t.id]![g].push(t.refPrice[g]);
      });
    }
    render();
  };

  root.querySelectorAll<HTMLButtonElement>('[data-run]').forEach((b) =>
    b.addEventListener('click', () => run(Number(b.dataset.run))),
  );
  $('[data-reset]').addEventListener('click', () => reset(map));
  root.querySelectorAll<HTMLButtonElement>('[data-good]').forEach((b) =>
    b.addEventListener('click', () => {
      good = b.dataset.good as GoodId;
      render();
    }),
  );
  new ResizeObserver(() => map && renderCharts()).observe($('[data-price-chart]'));

  function render() {
    const today = state.day - 1;
    const last = hist.reports.at(-1);
    const season = seasonOfDay(Math.max(1, today), state.startSeason);
    const month = hist.reports.slice(-30);
    const tribute = month.reduce((s, r) => s + r.tribute, 0);
    const hungry = hungryWorkers(state);
    const pop = population(state);

    $('[data-tiles]').innerHTML = [
      tile('날짜', today === 0 ? '시작 전' : `${today}일`, SEASON_NAME[season]),
      tile('통화량', fmt(moneySupply(state)), '모든 돈 (금고 포함)'),
      tile('일꾼', `${pop}명`, `굶는 사람 ${hungry}명 · 시작 ${startPop}명`),
      tile('영주에게 바친 돈', fmt(tribute), `최근 ${month.length}일 (바깥에서 ${fmt(month.reduce((s, r) => s + r.stipend, 0))} 들어옴)`),
      tile('오늘 거래량', last ? fmt(sumVolume(last)) : '-', '네 마을, 모든 물품'),
    ].join('');

    // 테스트(economy.test.ts)와 같은 기준
    const settled = hist.money[29];
    const checks: [boolean | null, string][] = [
      [today ? pop >= startPop * 0.4 && pop <= startPop * 2 : null, `일꾼 수가 시작의 40%~200% (${pop} / ${startPop})`],
      [today ? state.towns.every((t) => population(state, t.id) > 0) : null, '마을마다 일꾼이 남아 있음'],
      [
        settled === undefined ? null : hist.money.slice(29).every((m) => m > settled * 0.5 && m < settled * 2),
        settled === undefined ? '통화량이 30일째의 0.5~2배 (30일 지나면 검사)' : `통화량이 30일째(${fmt(settled)})의 0.5~2배`,
      ],
      [today ? hungry / Math.max(1, pop) < 0.3 : null, `굶는 일꾼 30% 미만 (${Math.round((hungry / Math.max(1, pop)) * 100)}%)`],
    ];
    $('[data-checks]').innerHTML = checks
      .map(([ok, text]) => {
        const [cls, mark, word] = ok === null ? ['dev-wait', '·', '대기'] : ok ? ['dev-ok', '✓', '통과'] : ['dev-no', '✗', '실패'];
        return `<li><span class="${cls}">${mark} ${word}</span><span>${text}</span></li>`;
      })
      .join('');

    root
      .querySelectorAll<HTMLButtonElement>('[data-good]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.good === good)));

    renderMarket(last);
    renderTowns();
    $('[data-news]').innerHTML =
      state.news
        .slice(-15)
        .reverse()
        .map((n) => `<li><span class="dev-mono">${n.day}일</span> ${n.text}</li>`)
        .join('') || '<li class="dev-mono">아직 소식이 없어요.</li>';
    renderSchedule();
    renderCharts();
  }

  function renderSchedule() {
    const season = state.season;
    if (!season) return;
    const name = (id: number) => map.towns[id]!.name;
    const rows = [
      ...season.schedule.map((s) => ({ day: s.day, omen: s.omenDay, text: `${eventDef(s.event).name}${s.good ? `(${GOOD_NAME[s.good]})` : ''}`, town: s.town, fake: false })),
      ...season.fakeOmens.map((f) => ({ day: f.day, omen: f.day, text: `헛징조: ${eventDef(f.event).name}`, town: f.town, fake: true })),
    ].sort((a, b) => a.day - b.day);
    const reactive = season.log.filter((e) => eventDef(e.event).category === 'reactive');
    $('[data-schedule]').innerHTML =
      `<tr><th>날</th><th>사건</th><th>마을</th><th>징조</th><th></th></tr>` +
      rows
        .map(
          (r) =>
            `<tr><td>${r.day}일</td><td>${r.text}</td><td>${name(r.town)}</td><td>${r.fake ? '거짓' : r.omen === null ? '-' : `${r.omen}일`}</td><td>${r.day < state.day ? '지남' : ''}</td></tr>`,
        )
        .join('') +
      reactive.map((e) => `<tr><td>${e.day}일</td><td>반응: ${eventDef(e.event).name}${e.good ? `(${GOOD_NAME[e.good]})` : ''}</td><td>${name(e.town)}</td><td>-</td><td>지남</td></tr>`).join('') +
      `<tr><td colspan="5" class="dev-mono">${season.number}번째 시즌 · ${season.startDay}일부터 ${season.length}일</td></tr>`;
  }

  function renderCharts() {
    const names = map.towns.map((t) => t.name);
    const color = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]!;
    renderLineChart(
      $('[data-price-chart]'),
      state.towns.map((t, i) => ({ name: names[i]!, color: color(i), values: hist.price[t.id]![good] })),
      { firstDay: 1, format: (v) => v.toFixed(v < 10 ? 1 : 0) },
    );
    renderLineChart($('[data-money-chart]'), [{ name: '통화량', color: color(0), values: hist.money }], {
      firstDay: 1,
      format: fmt,
      height: 150,
    });
    renderLineChart(
      $('[data-pop-chart]'),
      state.towns.map((t, i) => ({ name: names[i]!, color: color(i), values: hist.pop[t.id]! })),
      { firstDay: 1, height: 150 },
    );
  }

  function renderMarket(last: DayReport | undefined) {
    const head = `<tr><th></th>${map.towns.map((t, i) => `<th><i class="dev-key" style="background:${SERIES_COLORS[i]}"></i>${t.name}</th>`).join('')}</tr>`;
    const rows = GOODS.map((g) => {
      const cells = state.towns
        .map((t) => {
          const m = last?.markets[t.id]![g];
          const vol = m && m.volume ? ` · ${m.volume}개` : '';
          return `<td>${Math.round(t.refPrice[g])}<span class="dev-mono">${vol}</span></td>`;
        })
        .join('');
      return `<tr><th>${GOOD_NAME[g]}</th>${cells}</tr>`;
    }).join('');
    $('[data-market]').innerHTML = head + rows;
  }

  function renderTowns() {
    $('[data-towns]').innerHTML = state.towns
      .map((t) => {
        const jobs = jobCounts(state, t.id);
        const jobText = JOBS.filter((j) => jobs[j] > 0)
          .map((j) => `${JOB_NAME[j]} ${jobs[j]}`)
          .join(', ');
        const nodes = t.nodes
          .map((n) => `${RESOURCE_NAME[n.kind]} ${Math.round((n.amount / n.capacity) * 100)}%`)
          .join(', ');
        // 지금 이 마을에 미치는 사건
        const tags = eventsAt(state, t.id)
          .map((e) => `${eventDef(e.event).name}${e.good ? `(${GOOD_NAME[e.good]})` : ''} ~${e.end}일`)
          .join(' · ');
        return `<div class="dev-town">
          <h3><i class="dev-key" style="background:${SERIES_COLORS[t.id]}"></i>${map.towns[t.id]!.name}</h3>
          <div>일꾼: ${jobText || '없음'}</div>
          <div>자원지: ${nodes || '없음'}</div>
          <div>금고 ${fmt(t.treasury)} (상한 ${fmt(ECONOMY.citizens.treasuryCap)})${tags ? ` · ${tags}` : ''}</div>
        </div>`;
      })
      .join('');
  }

  return { reset };
}

function tile(label: string, value: string, sub: string): string {
  return `<div class="dev-tile"><div class="dev-tile-k">${label}</div><div class="dev-tile-v">${value}</div><div class="dev-tile-s">${sub}</div></div>`;
}

function sumVolume(r: DayReport): number {
  return r.markets.reduce((s, m) => s + GOODS.reduce((a, g) => a + m[g].volume, 0), 0);
}

function fmt(v: number): string {
  return Math.round(v).toLocaleString('ko-KR');
}
