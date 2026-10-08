// 맵 생성기 관찰: 2D 지도, 생성 규칙, 마을 특색, 이동 일수, 맵 지문.
import { SEASON_NAME, type Season } from '../sim/season';
import { mountEconomyPanel } from './economyPanel';
import {
  checkWorldRules,
  generateWorld,
  hexToXY,
  RESOURCE_NAME,
  townTravelDays,
  worldFingerprint,
  type ResourceKind,
  type Terrain,
  type WorldMap,
} from '../sim/worldgen';

// 계절별 지형 색 (prototypes/hexmap-2d.html)
const TERRAIN_COLOR: Record<Terrain, readonly [string, string, string, string]> = {
  sea: ['#5FA8B8', '#4FA0B4', '#5A9CAC', '#7FAFBF'],
  coast: ['#E6CF9E', '#EAD39A', '#E2C79A', '#E9E3D6'],
  plain: ['#A9C96A', '#9CC05A', '#C9B868', '#E8EEF0'],
  forest: ['#7DB466', '#6AA857', '#D9A15A', '#E1E8E8'],
  hills: ['#B9AE6A', '#B0A35E', '#B9A061', '#E3E7E8'],
  mountain: ['#9A9283', '#958C7C', '#8C8577', '#C9CFD3'],
};

const RESOURCE_COLOR: Record<ResourceKind, string> = {
  forest: '#4E8C4E',
  ore: '#5B5F73',
  field: '#C9962E',
  fish: '#2E9C98',
  salt: '#8F8A80',
};

const S = 30; // 칸 반지름 (px)

export function mountWorldgenView(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  let seed = Number(params.get('seed') ?? 20261008) >>> 0;
  let season: Season = 2;
  let map: WorldMap = generateWorld(seed);

  root.innerHTML = `
    <div class="dev">
      <h1>맵 생성기 관찰</h1>
      <div class="dev-bar">
        <input type="number" inputmode="numeric" aria-label="시드" data-seed />
        <button type="button" class="dev-btn alt" data-go>이 시드로</button>
        <button type="button" class="dev-btn" data-new>새 맵</button>
      </div>
      <div class="dev-bar" role="group" aria-label="계절">
        ${([0, 1, 2, 3] as Season[])
          .map((s) => `<button type="button" class="dev-btn alt" data-season="${s}">${SEASON_NAME[s]}</button>`)
          .join('')}
      </div>
      <section data-map3d></section>
      <div class="dev-grid">
        <div class="dev-map" data-map></div>
        <div class="dev-side">
          <section class="dev-slip"><h2>맵</h2><div data-meta></div></section>
          <section class="dev-slip"><h2>생성 규칙</h2><ul data-rules></ul></section>
          <section class="dev-slip"><h2>마을</h2><ul data-towns></ul></section>
          <section class="dev-slip"><h2>이동 일수</h2><table class="dev-table" data-days></table></section>
        </div>
      </div>
      <section class="dev-econ" data-economy></section>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const seedInput = $<HTMLInputElement>('[data-seed]');

  const rebuild = (nextSeed: number) => {
    seed = nextSeed >>> 0;
    map = generateWorld(seed);
    history.replaceState(null, '', `?seed=${seed}`);
    render();
  };

  $('[data-go]').addEventListener('click', () => rebuild(Number(seedInput.value)));
  // 화면 쪽이라 Math.random을 써도 된다. 시뮬레이션에는 시드만 넘어간다.
  $('[data-new]').addEventListener('click', () => rebuild(Math.floor(Math.random() * 1e9)));
  root.querySelectorAll<HTMLButtonElement>('[data-season]').forEach((b) =>
    b.addEventListener('click', () => {
      season = Number(b.dataset.season) as Season;
      render();
    }),
  );

  // 3D는 Three.js가 커서 따로 불러온다
  const map3d = import('./map3dPanel').then((m) => m.mountMap3dPanel($('[data-map3d]')));

  const economy = mountEconomyPanel($('[data-economy]'));
  let economyMap: WorldMap | null = null;

  function render() {
    seedInput.value = String(seed);
    if (economyMap !== map) {
      economyMap = map;
      economy.reset(map);
    }
    void map3d.then((p) => p.update(map, season));
    root
      .querySelectorAll<HTMLButtonElement>('[data-season]')
      .forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.season) === season)));

    $('[data-map]').innerHTML = drawMap(map, season);

    $('[data-meta]').innerHTML = `
      <div>맵 번호 <b>${map.seed}</b> · ${map.tries}번째 지형에서 통과</div>
      <div class="dev-mono">지문 ${worldFingerprint(map)} (기기마다 같아야 함)</div>`;

    $('[data-rules]').innerHTML = checkWorldRules(map)
      .map((r) => `<li><span class="${r.ok ? 'dev-ok' : 'dev-no'}">${r.ok ? '✓' : '✗'}</span><span>${r.label}</span></li>`)
      .join('');

    $('[data-towns]').innerHTML = map.towns
      .map(
        (t) =>
          `<li><b>${t.name}</b><span>${t.specialties
            .map((k) => `<span class="dev-chip" style="background:${RESOURCE_COLOR[k]}">${RESOURCE_NAME[k]}</span>`)
            .join('')}</span></li>`,
      )
      .join('');

    const days = townTravelDays(map, season);
    const names = map.towns.map((t) => t.name);
    $('[data-days]').innerHTML =
      `<tr><th></th>${names.map((n) => `<th>${n}</th>`).join('')}</tr>` +
      days
        .map(
          (row, a) =>
            `<tr><th>${names[a]}</th>${row
              .map((d, b) => `<td>${a === b ? '·' : Number.isFinite(d) ? `${d}일` : '못 감'}</td>`)
              .join('')}</tr>`,
        )
        .join('');
  }

  render();
}

function drawMap(map: WorldMap, season: Season): string {
  const pts = map.tiles.map((t) => {
    const { x, y } = hexToXY(t.q, t.r);
    return { x: x * S, y: y * S };
  });
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - S;
  const minY = Math.min(...ys) - S;
  const w = Math.max(...xs) + S - minX;
  const h = Math.max(...ys) + S + 30 - minY;

  let g = '';
  map.tiles.forEach((t, i) => {
    const { x, y } = pts[i]!;
    g += `<polygon points="${hexPoints(x, y, S - 1)}" fill="${TERRAIN_COLOR[t.terrain][season]}"/>`;
    if (t.resource) {
      g += `<circle cx="${x + 9}" cy="${y + 8}" r="5" fill="${RESOURCE_COLOR[t.resource]}" stroke="#3A2B22" stroke-width="1"/>`;
    }
  });

  // 길: 이웃한 길 칸끼리 잇는다
  const index = new Map(map.tiles.map((t, i) => [`${t.q},${t.r}`, i]));
  map.tiles.forEach((t, i) => {
    if (!t.road) return;
    for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1]] as const) {
      const j = index.get(`${t.q + dq},${t.r + dr}`);
      if (j === undefined || !map.tiles[j]!.road) continue;
      const a = pts[i]!;
      const b = pts[j]!;
      g += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6B4A32" stroke-width="3.5" stroke-dasharray="7 5" stroke-linecap="round"/>`;
    }
  });

  for (const town of map.towns) {
    const { x, y } = pts[town.tile]!;
    g += `<circle cx="${x}" cy="${y}" r="13" fill="#D2594B" stroke="#3A2B22" stroke-width="2.5"/>`;
    g += `<text x="${x}" y="${y + 30}" text-anchor="middle" font-family="Jua, sans-serif" font-size="15" fill="#F1E2C6" stroke="#3A2B22" stroke-width="3" paint-order="stroke">${town.name}</text>`;
  }

  return `<svg viewBox="${minX} ${minY} ${w} ${h}" role="img" aria-label="생성된 육각 지도">${g}</svg>`;
}

/** 뾰족한 쪽이 위인 육각형 꼭짓점 */
function hexPoints(cx: number, cy: number, s: number): string {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}
