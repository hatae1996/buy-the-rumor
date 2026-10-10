// 칸 위 소품 (로우폴리): 바늘잎나무 무리, 바위산, 언덕 둔덕, 들판 덤불과 바위, 자원지 표시, 마을 집, 길.
// 지오메트리는 한 번 만들어 같이 쓴다. 자리와 크기는 칸 좌표로 정해 늘 같은 모습이다.
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { HEX_DIRS, type WorldMap } from '../sim/worldgen';
import type { InstanceBatcher, Placement } from './batcher';
import { tileCenter, tileHash } from './layout';
import type { MaterialKit } from './materials';
import { BLOSSOM, BUSH_COLOR, FLOWER, PROP, ROCK_COLOR, SNOW, TREE_COLOR } from './palette';
import { addResource, type Fixed, type SeaDir } from './resources';

export class PropGeometries {
  /** 높이 1, 반지름 1인 오각뿔 (나무, 바위산). 원점은 가운데 */
  readonly spike = new THREE.ConeGeometry(1, 1, 5);
  /** 덤불, 둔덕 */
  readonly blob = new THREE.IcosahedronGeometry(1, 0);
  /** 바위 */
  readonly rock = new THREE.DodecahedronGeometry(1, 0);
  /** 높이 1인 나무줄기 (봄 벚꽃나무) */
  readonly trunk = new THREE.CylinderGeometry(0.6, 1, 1, 5);
  /** 크기 1 상자 (이랑, 기둥, 판자, 선체) */
  readonly box = new THREE.BoxGeometry(1, 1, 1);
  /** 밀 다발: 위가 넓은 육각 기둥 */
  readonly bundle = new THREE.CylinderGeometry(1, 0.65, 1, 6);
  /** 광맥 결정 */
  readonly crystal = new THREE.OctahedronGeometry(1, 0);
  /** 세모 돛 (얇게 눌러 쓴다) */
  readonly sail = new THREE.ConeGeometry(1, 1, 3);
  readonly wall = new THREE.BoxGeometry(0.42, 0.32, 0.42);
  readonly roof = new THREE.ConeGeometry(0.38, 0.32, 4);
  readonly tower = new THREE.CylinderGeometry(0.17, 0.2, 0.9, 6);
  readonly towerRoof = new THREE.ConeGeometry(0.26, 0.36, 6);
  /** 길 한 토막: x축으로 길이 1 */
  readonly roadSpoke = new THREE.BoxGeometry(1, 0.04, 0.2);
  readonly roadHub = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 6);

  dispose(): void {
    Object.values(this).forEach((g) => (g as THREE.BufferGeometry).dispose());
  }
}

/** 마을 집 배치 (x, z, 크기). 도시는 탑을 둘러 집이 더 많다 */
const TOWN_HOUSES = [
  [-0.3, 0.15, 1],
  [0.32, 0.05, 0.85],
  [0, -0.35, 0.9],
] as const;
const CITY_HOUSES = [
  [-0.45, 0.2, 0.8],
  [0.45, 0.25, 0.75],
  [-0.35, -0.38, 0.75],
  [0.38, -0.35, 0.8],
  [0, 0.52, 0.7],
] as const;

/** 숲 칸의 나무 자리 (x, z). 칸마다 이 중 몇 개를 고르고 조금씩 흔든다 */
const TREE_SPOTS = [
  [0, 0],
  [-0.38, 0.12],
  [0.36, 0.18],
  [-0.12, -0.4],
  [0.22, -0.34],
  [-0.2, 0.42],
  [0.14, 0.44],
  [0.5, -0.08],
  [-0.48, -0.2],
] as const;

export interface PropOptions {
  season: Season;
  /** 나무, 산, 언덕, 덤불 */
  terrainProps: boolean;
  outline: boolean;
}

export function addProps(map: WorldMap, b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, opt: PropOptions): void {
  const townAt = new Map(map.towns.map((t) => [t.tile, t]));
  const index = new Map(map.tiles.map((t, i) => [`${t.q},${t.r}`, i]));
  const outline = opt.outline ? kit.outline : null;

  map.tiles.forEach((t, i) => {
    const c = tileCenter(t);
    // 칸마다 조금씩 돌려 똑같아 보이지 않게 한다
    const turn = Math.floor(tileHash(t.q, t.r, 1) * 6) * (Math.PI / 3);
    const at: At = (dx, dz, dy, scale = 1, rotY = 0) => {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      return { x: c.x + dx * cos - dz * sin, y: c.y + dy, z: c.z + dx * sin + dz * cos, scale, rotY: rotY + turn };
    };
    const rnd = (k: number) => tileHash(t.q, t.r, k + 10);
    const fixed: Fixed = (dx, dz, dy, scale, rotY = 0) => ({ x: c.x + dx, y: c.y + dy, z: c.z + dz, scale, rotY });
    const ore = t.resource === 'ore';

    const town = townAt.get(i);
    if (town) {
      const houses = town.tier === 'city' ? CITY_HOUSES : TOWN_HOUSES;
      for (const [dx, dz, s] of houses) {
        b.addOutlined(geo.wall, kit.solid(PROP.wall), outline, at(dx, dz, 0.16 * s, s));
        b.addOutlined(geo.roof, kit.solid(PROP.roof), outline, at(dx, dz, 0.48 * s, s, Math.PI / 4));
      }
      // 도시는 가운데에 높은 탑이 있어 멀리서도 알아본다
      if (town.tier === 'city') {
        b.addOutlined(geo.tower, kit.solid(PROP.wall), outline, at(0, 0, 0.45));
        b.addOutlined(geo.towerRoof, kit.solid(PROP.cityRoof), outline, at(0, 0, 1.08));
      }
      return;
    }

    if (opt.terrainProps) {
      if (t.terrain === 'forest') addForest(b, geo, kit, opt.season, at, rnd, t.resource !== null);
      else if (t.terrain === 'mountain') addMountain(b, geo, kit, opt.season, ore ? fixed : at, rnd, ore);
      else if (t.terrain === 'hills') addHills(b, geo, kit, opt.season, ore ? fixed : at, rnd, ore);
      else if ((t.terrain === 'plain' || t.terrain === 'coast') && !t.resource && !t.road) {
        if (opt.season === 0 && t.terrain === 'plain') addFlowers(b, geo, kit, at, rnd);
        else addScatter(b, geo, kit, opt.season, at, rnd);
      }
    }

    addResource(t, b, geo, kit, opt.season, fixed, t.resource === 'fish' ? seaDir(map, index, t.q, t.r) : null);
  });

  addRoads(map, b, geo, kit);
}

type At = (dx: number, dz: number, dy: number, scale?: number | readonly [number, number, number], rotY?: number) => Placement;
type Rnd = (k: number) => number;

/** 바늘잎나무 무리: 가늘고 뾰족한 뿔 4~7그루, 키가 제각각. 자원지 표시가 있으면 한쪽을 비운다 */
function addForest(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: At, rnd: Rnd, leaveRoom: boolean): void {
  const palette = TREE_COLOR[season];
  const count = 4 + Math.floor(rnd(0) * 4);
  const spots = TREE_SPOTS.filter(([x, z]) => !leaveRoom || x < 0.3 || z < 0.25).slice(0, count);
  spots.forEach(([x, z], k) => {
    const h = 0.55 + rnd(k + 1) * 0.5;
    const r = 0.11 + rnd(k + 20) * 0.05;
    const dx = x + (rnd(k + 40) - 0.5) * 0.12;
    const dz = z + (rnd(k + 60) - 0.5) * 0.12;
    // 봄엔 열에 넷쯤이 동그란 벚꽃나무
    if (season === 0 && rnd(k + 100) < 0.4) {
      const crown = 0.2 + rnd(k + 110) * 0.08;
      const stem = 0.22 + rnd(k + 120) * 0.12;
      b.add(geo.trunk, kit.solid(PROP.trunk), at(dx, dz, stem / 2, [0.035, stem, 0.035]));
      const pink = BLOSSOM[Math.floor(rnd(k + 130) * BLOSSOM.length)]!;
      b.add(geo.blob, kit.solid(pink), at(dx, dz, stem + crown * 0.55, [crown, crown * 0.85, crown], rnd(k + 90) * Math.PI));
      return;
    }
    const color = palette[Math.floor(rnd(k + 80) * palette.length)]!;
    b.add(geo.spike, kit.solid(color), at(dx, dz, h / 2, [r, h, r], rnd(k + 90) * Math.PI));
    // 겨울엔 꼭대기에 눈
    if (season === 3) {
      const ch = h * 0.34;
      b.add(geo.spike, kit.solid(SNOW), at(dx, dz, h - ch / 2 + 0.005, [r * 0.36 * 1.08, ch, r * 0.36 * 1.08], rnd(k + 90) * Math.PI));
    }
  });
}

/** 바위산: 큰 봉우리 하나와 작은 봉우리 한두 개, 꼭대기에 눈. 광맥이 있으면 앞쪽을 비우려고 큰 봉우리만 뒤로 물린다 */
function addMountain(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: At | Fixed, rnd: Rnd, ore: boolean): void {
  const winter = season === 3;
  const peaks: [number, number, number, number][] = ore
    ? [[0, -0.2, 0.42, 1.1 + rnd(0) * 0.25], [-0.45, -0.1, 0.24, 0.55 + rnd(1) * 0.15]]
    : [[0, 0, 0.5, 1.2 + rnd(0) * 0.3], [0.42, 0.25, 0.3, 0.65 + rnd(1) * 0.2]];
  if (!ore && rnd(2) < 0.6) peaks.push([-0.4, 0.3, 0.28, 0.55 + rnd(3) * 0.2]);
  peaks.forEach(([dx, dz, r, h], k) => {
    const rot = rnd(k + 5) * Math.PI;
    b.add(geo.spike, kit.solid(ROCK_COLOR[season][k === 0 ? 0 : 1]), at(dx, dz, h / 2, [r, h, r], rot));
    // 눈 모자: 같은 뿔의 윗부분을 조금 크게 덮는다
    const capK = winter ? 0.6 : k === 0 ? 0.36 : 0;
    if (capK > 0) {
      const ch = h * capK;
      b.add(geo.spike, kit.solid(SNOW), at(dx, dz, h - ch / 2 + 0.01, [r * capK * 1.06, ch, r * capK * 1.06], rot));
    }
  });
}

/** 언덕: 낮은 둔덕 두세 개. 광맥이 있으면 뒤쪽에만 */
function addHills(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: At | Fixed, rnd: Rnd, ore: boolean): void {
  const color = BUSH_COLOR[season];
  const mounds: [number, number, number][] = ore
    ? [
        [-0.3, -0.2, 0.32],
        [0.3, -0.25, 0.27],
      ]
    : [
        [-0.25, 0.1, 0.34],
        [0.3, -0.15, 0.27],
      ];
  if (!ore && rnd(0) < 0.5) mounds.push([0.15, 0.42, 0.2]);
  mounds.forEach(([dx, dz, r], k) => b.add(geo.blob, kit.solid(color), at(dx, dz, 0, [r, r * 0.55, r], rnd(k + 3) * Math.PI)));
}

/** 들판·해안: 몇 칸에만 덤불이나 바위 한두 개 (빈 칸이 더 많게) */
function addScatter(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: At, rnd: Rnd): void {
  const roll = rnd(0);
  if (roll < 0.22) {
    const color = kit.solid(BUSH_COLOR[season]);
    const n = 1 + Math.floor(rnd(1) * 3);
    for (let k = 0; k < n; k++) {
      const r = 0.08 + rnd(k + 2) * 0.05;
      b.add(geo.blob, color, at(-0.3 + rnd(k + 5) * 0.6, -0.3 + rnd(k + 8) * 0.6, r * 0.5, [r, r * 0.8, r], rnd(k + 11)));
    }
  } else if (roll < 0.36) {
    const r = 0.07 + rnd(2) * 0.06;
    b.add(geo.rock, kit.solid(PROP.rock), at(-0.25 + rnd(3) * 0.5, -0.25 + rnd(4) * 0.5, r * 0.4, [r, r * 0.75, r], rnd(5) * Math.PI));
  }
}

/** 봄 들판: 절반쯤의 칸에 작은 꽃 무리 (분홍, 하양, 연보라, 노랑) */
function addFlowers(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, at: At, rnd: Rnd): void {
  if (rnd(0) > 0.55) return;
  const n = 4 + Math.floor(rnd(1) * 6);
  const cx = -0.25 + rnd(2) * 0.5;
  const cz = -0.25 + rnd(3) * 0.5;
  for (let k = 0; k < n; k++) {
    const r = 0.035 + rnd(k + 4) * 0.025;
    const color = FLOWER[Math.floor(rnd(k + 20) * FLOWER.length)]!;
    b.add(geo.blob, kit.solid(color), at(cx + (rnd(k + 40) - 0.5) * 0.45, cz + (rnd(k + 60) - 0.5) * 0.45, r * 0.4, [r, r * 0.6, r], rnd(k + 80)));
  }
}

/** 해안 칸에서 이웃한 바다 칸 쪽 방향. 화면 앞쪽(+z)에 가까운 바다를 고른다 (배가 잘 보이게) */
function seaDir(map: WorldMap, index: Map<string, number>, q: number, r: number): SeaDir {
  const c = tileCenter(map.tiles[index.get(`${q},${r}`)!]!);
  let best: [number, number] | null = null;
  for (const [dq, dr] of HEX_DIRS) {
    const j = index.get(`${q + dq},${r + dr}`);
    if (j === undefined || map.tiles[j]!.terrain !== 'sea') continue;
    const n = tileCenter(map.tiles[j]!);
    const len = Math.hypot(n.x - c.x, n.z - c.z);
    const dir: [number, number] = [(n.x - c.x) / len, (n.z - c.z) / len];
    if (!best || dir[1] > best[1]) best = dir;
  }
  return best;
}

/** 길: 칸 가운데에서 이웃한 길 칸 쪽으로 칸 가장자리까지 토막을 놓는다 */
function addRoads(map: WorldMap, b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit): void {
  const index = new Map(map.tiles.map((t, i) => [`${t.q},${t.r}`, i]));
  const mat = kit.solid(PROP.road);
  for (const t of map.tiles) {
    if (!t.road) continue;
    const c = tileCenter(t);
    b.add(geo.roadHub, mat, { x: c.x, y: c.y + 0.02, z: c.z });
    for (const [dq, dr] of HEX_DIRS) {
      const j = index.get(`${t.q + dq},${t.r + dr}`);
      if (j === undefined || !map.tiles[j]!.road) continue;
      const n = tileCenter(map.tiles[j]!);
      const dx = (n.x - c.x) / 2;
      const dz = (n.z - c.z) / 2;
      const len = Math.hypot(dx, dz);
      b.add(geo.roadSpoke, mat, {
        x: c.x + dx / 2,
        y: c.y + 0.02,
        z: c.z + dz / 2,
        rotY: -Math.atan2(dz, dx),
        scale: [len, 1, 1],
      });
    }
  }
}
