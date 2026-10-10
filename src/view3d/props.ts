// 칸 위 소품 (로우폴리): 바늘잎나무 무리, 바위산, 언덕 둔덕, 들판 덤불과 바위, 자원지 표시, 마을 집, 길.
// 지오메트리는 한 번 만들어 같이 쓴다. 자리와 크기는 칸 좌표로 정해 늘 같은 모습이다.
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { HEX_DIRS, type Tile, type WorldMap } from '../sim/worldgen';
import type { InstanceBatcher, Placement } from './batcher';
import { tileCenter, tileHash } from './layout';
import type { MaterialKit } from './materials';
import { PROP, SNOW, TREE_COLOR } from './palette';

export class PropGeometries {
  /** 높이 1, 반지름 1인 오각뿔 (나무, 바위산). 원점은 가운데 */
  readonly spike = new THREE.ConeGeometry(1, 1, 5);
  /** 덤불, 둔덕 */
  readonly blob = new THREE.IcosahedronGeometry(1, 0);
  /** 바위 */
  readonly rock = new THREE.DodecahedronGeometry(1, 0);
  /** 볏단: 낮은 사각뿔 */
  readonly sheaf = new THREE.ConeGeometry(0.075, 0.2, 4);
  readonly ore = new THREE.OctahedronGeometry(0.18);
  readonly salt = new THREE.ConeGeometry(0.16, 0.22, 6);
  readonly boat = new THREE.BoxGeometry(0.42, 0.1, 0.18);
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
  const outline = opt.outline ? kit.outline : null;
  const winter = opt.season === 3;

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
      else if (t.terrain === 'mountain') addMountain(b, geo, kit, winter, at, rnd);
      else if (t.terrain === 'hills') addHills(b, geo, kit, opt.season, at, rnd);
      else if ((t.terrain === 'plain' || t.terrain === 'coast') && !t.resource && !t.road) addScatter(b, geo, kit, winter, at, rnd);
    }

    addResource(t, b, geo, kit, outline, winter, at);
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
    const color = palette[Math.floor(rnd(k + 80) * palette.length)]!;
    b.add(geo.spike, kit.solid(color), at(dx, dz, h / 2, [r, h, r], rnd(k + 90) * Math.PI));
    // 겨울엔 꼭대기에 눈
    if (season === 3) {
      const ch = h * 0.34;
      b.add(geo.spike, kit.solid(SNOW), at(dx, dz, h - ch / 2 + 0.005, [r * 0.36 * 1.08, ch, r * 0.36 * 1.08], rnd(k + 90) * Math.PI));
    }
  });
}

/** 바위산: 큰 봉우리 하나와 작은 봉우리 한두 개, 꼭대기에 눈 */
function addMountain(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, winter: boolean, at: At, rnd: Rnd): void {
  const peaks: [number, number, number, number][] = [[0, 0, 0.5, 1.2 + rnd(0) * 0.3]];
  peaks.push([0.42, 0.25, 0.3, 0.65 + rnd(1) * 0.2]);
  if (rnd(2) < 0.6) peaks.push([-0.4, 0.3, 0.28, 0.55 + rnd(3) * 0.2]);
  peaks.forEach(([dx, dz, r, h], k) => {
    const rot = rnd(k + 5) * Math.PI;
    b.add(geo.spike, kit.solid(k === 0 ? PROP.rock : PROP.rockDark), at(dx, dz, h / 2, [r, h, r], rot));
    // 눈 모자: 같은 뿔의 윗부분을 조금 크게 덮는다
    const capK = winter ? 0.6 : k === 0 ? 0.36 : 0;
    if (capK > 0) {
      const ch = h * capK;
      b.add(geo.spike, kit.solid(SNOW), at(dx, dz, h - ch / 2 + 0.01, [r * capK * 1.06, ch, r * capK * 1.06], rot));
    }
  });
}

/** 언덕: 낮은 둔덕 두세 개 */
function addHills(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: At, rnd: Rnd): void {
  const color = season === 3 ? SNOW : season === 2 ? 0x9a8a45 : PROP.bush;
  const mounds: [number, number, number][] = [
    [-0.25, 0.1, 0.34],
    [0.3, -0.15, 0.27],
  ];
  if (rnd(0) < 0.5) mounds.push([0.15, 0.42, 0.2]);
  mounds.forEach(([dx, dz, r], k) => b.add(geo.blob, kit.solid(color), at(dx, dz, 0, [r, r * 0.55, r], rnd(k + 3) * Math.PI)));
}

/** 들판·해안: 몇 칸에만 덤불이나 바위 한두 개 (빈 칸이 더 많게) */
function addScatter(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, winter: boolean, at: At, rnd: Rnd): void {
  const roll = rnd(0);
  if (roll < 0.22) {
    const color = kit.solid(winter ? SNOW : PROP.bush);
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

function addResource(
  t: Tile,
  b: InstanceBatcher,
  geo: PropGeometries,
  kit: MaterialKit,
  outline: THREE.Material | null,
  winter: boolean,
  at: At,
): void {
  switch (t.resource) {
    case 'field':
      // 볏단을 세 줄로 세운다. 겨울엔 거둬들여 비어 있다
      if (!winter) {
        for (let row = -1; row <= 1; row++) {
          for (let col = -1; col <= 1; col++) b.add(geo.sheaf, kit.solid(PROP.wheat), at(col * 0.24 + row * 0.12, row * 0.22, 0.1, 1, Math.PI / 4));
        }
      }
      break;
    case 'ore':
      b.addOutlined(geo.ore, kit.solid(PROP.ore), outline, at(0.45, 0.4, 0.2));
      break;
    case 'salt':
      b.addOutlined(geo.salt, kit.solid(PROP.salt), outline, at(0.2, 0.15, 0.11), 0.1);
      b.addOutlined(geo.salt, kit.solid(PROP.salt), outline, at(-0.15, 0.3, 0.11), 0.1);
      break;
    case 'fish':
      b.addOutlined(geo.boat, kit.solid(PROP.boat), outline, at(0.25, 0.3, 0.05));
      break;
    default:
      break;
  }
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
