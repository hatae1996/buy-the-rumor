// 개발용 선 그래프 (SVG). 세로축 하나, 선 끝에 이름표, 마우스나 손가락을 대면 그날 값.
// 색은 종이(#F1E2C6) 위에서 색약 검사를 통과한 4색 (dataviz 기준 팔레트 1, 2, 3, 7번).

export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7'] as const;

export interface Series {
  name: string;
  color: string;
  values: readonly number[];
}

export interface LineChartOptions {
  /** 첫 값의 날짜 */
  firstDay: number;
  /** 값 표시 (툴팁, 축) */
  format?: (v: number) => string;
  height?: number;
}

const PAD = { top: 10, right: 72, bottom: 22, left: 44 };

export function renderLineChart(host: HTMLElement, series: readonly Series[], opt: LineChartOptions): void {
  const width = Math.max(280, host.clientWidth);
  const height = opt.height ?? 180;
  const fmt = opt.format ?? ((v: number) => String(Math.round(v)));
  const n = Math.max(0, ...series.map((s) => s.values.length));
  host.innerHTML = '';
  if (n === 0) {
    host.innerHTML = '<p class="dev-mono">아직 기록이 없어요. 하루를 돌려 보세요.</p>';
    return;
  }

  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(...all, 1));
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.classList.add('dev-chart');

  let g = '';
  // 가로 눈금 (옅게)
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    g += `<line x1="${PAD.left}" x2="${PAD.left + plotW}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    g += `<text x="${PAD.left - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${fmt(v)}</text>`;
  }
  // 날짜 축: 처음과 끝
  g += `<text x="${PAD.left}" y="${height - 6}" class="axis">${opt.firstDay}일</text>`;
  g += `<text x="${PAD.left + plotW}" y="${height - 6}" text-anchor="end" class="axis">${opt.firstDay + n - 1}일</text>`;

  // 선 끝 이름표가 겹치지 않게 위아래로 비킨다
  const ends = series
    .filter((s) => s.values.length)
    .map((s) => ({ s, y: y(s.values[s.values.length - 1]!) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 13);

  for (const s of series) {
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  for (const { s, y: ly } of ends) {
    const lx = x(s.values.length - 1);
    g += `<circle cx="${lx}" cy="${y(s.values[s.values.length - 1]!)}" r="3" fill="${s.color}" stroke="#F1E2C6" stroke-width="2"/>`;
    g += `<text x="${lx + 8}" y="${ly + 4}" class="label">${s.name}</text>`;
  }
  g += `<line class="cross" x1="0" x2="0" y1="${PAD.top}" y2="${PAD.top + plotH}" visibility="hidden"/>`;
  svg.innerHTML = g;
  host.appendChild(svg);

  // 툴팁: 그날 모든 선의 값
  const tip = document.createElement('div');
  tip.className = 'dev-tip';
  tip.hidden = true;
  host.appendChild(tip);
  const cross = svg.querySelector<SVGLineElement>('.cross')!;
  const show = (clientX: number) => {
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * width;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - PAD.left) / plotW) * (n - 1))));
    cross.setAttribute('x1', String(x(i)));
    cross.setAttribute('x2', String(x(i)));
    cross.setAttribute('visibility', 'visible');
    const rows = series
      .filter((s) => s.values[i] !== undefined)
      .map((s) => `<div><i style="background:${s.color}"></i>${s.name} <b>${fmt(s.values[i]!)}</b></div>`)
      .join('');
    tip.innerHTML = `<div class="dev-tip-day">${opt.firstDay + i}일</div>${rows}`;
    tip.hidden = false;
    const left = (x(i) / width) * r.width;
    tip.style.left = `${Math.min(r.width - tip.offsetWidth, Math.max(0, left + 10))}px`;
  };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
  });
}

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
