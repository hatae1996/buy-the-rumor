// 칸 위 소품: 나무, 산, 언덕, 자원지 표시, 마을 집, 길. 지오메트리는 한 번 만들어 같이 쓴다.
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { HEX_DIRS, type Tile, type WorldMap } from '../sim/worldgen';
import type { InstanceBatcher, Placement } from './batcher';
import { tileCenter } from './layout';
import type { MaterialKit } from './materials';
import { PROP, SNOW, TREE_COLOR } from './palette';

export class PropGeometries {
  readonly tree = new THREE.ConeGeometry(0.26, 0.75, 6);
  readonly trunk = new THREE.CylinderGeometry(0.05, 0.06, 0.14, 5);
  readonly mountain = new THREE.ConeGeometry(0.7, 1.3, 5);
  readonly mountainCap = new THREE.ConeGeometry(0.29, 0.54, 5);
  readonly hill = new THREE.SphereGeometry(0.42, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  readonly wheat = new THREE.BoxGeometry(0.75, 0.12, 0.13);
  readonly ore = new THREE.OctahedronGeometry(0.18);
  readonly salt = new THREE.ConeGeometry(0.16, 0.22, 6);
  readonly boat = new THREE.BoxGeometry(0.42, 0.1, 0.18);
  readonly wall = new THREE.BoxGeometry(0.42, 0.32, 0.42);
  readonly roof = new THREE.ConeGeometry(0.38, 0.32, 4);
  /** 길 한 토막: x축으로 길이 1 */
  readonly roadSpoke = new THREE.BoxGeometry(1, 0.04, 0.2);
  readonly roadHub = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8);

  dispose(): void {
    Object.values(this).forEach((g) => (g as THREE.BufferGeometry).dispose());
  }
}

export interface PropOptions {
  season: Season;
  /** 나무, 산, 언덕. 땅 그림에 이미 그려져 있으면 끈다 */
  terrainProps: boolean;
  outline: boolean;
}

export function addProps(
  map: WorldMap,
  b: InstanceBatcher,
  geo: PropGeometries,
  kit: MaterialKit,
  opt: PropOptions,
): void {
  const townTiles = new Set(map.towns.map((t) => t.tile));
  const outline = opt.outline ? kit.outline : null;
  const winter = opt.season === 3;

  map.tiles.forEach((t, i) => {
    const c = tileCenter(t);
    // 칸마다 조금씩 돌려 똑같아 보이지 않게 한다 (시드 없이 좌표로 정하므로 늘 같은 모습)
    const turn = ((t.q * 7 + t.r * 13) % 6) * (Math.PI / 3);
    const at: At = (dx, dz, dy, scale = 1, rotY = 0) => {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      return { x: c.x + dx * cos - dz * sin, y: c.y + dy, z: c.z + dx * sin + dz * cos, scale, rotY: rotY + turn };
    };

    if (townTiles.has(i)) {
      for (const [dx, dz, s] of [[-0.3, 0.15, 1], [0.32, 0.05, 0.85], [0, -0.35, 0.9]] as const) {
        b.addOutlined(geo.wall, kit.toon(PROP.wall), outline, at(dx, dz, 0.16 * s, s));
        b.addOutlined(geo.roof, kit.toon(PROP.roof), outline, at(dx, dz, 0.48 * s, s, Math.PI / 4));
      }
      return;
    }

    if (opt.terrainProps) {
      if (t.terrain === 'forest') {
        const leaf = kit.toon(winter ? SNOW : TREE_COLOR[opt.season]);
        for (const [dx, dz, s] of [[-0.35, 0.2, 1], [0.3, 0.3, 0.85], [0, -0.35, 0.95]] as const) {
          b.addOutlined(geo.tree, leaf, outline, at(dx, dz, 0.42 * s, s));
          b.add(geo.trunk, kit.toon(PROP.trunk), at(dx, dz, 0.07));
        }
      } else if (t.terrain === 'mountain') {
        b.addOutlined(geo.mountain, kit.toon(PROP.mountain), outline, at(0, 0, 0.65));
        b.add(geo.mountainCap, kit.toon(0xffffff), at(0, 0, 1.03));
      } else if (t.terrain === 'hills') {
        const col = kit.toon(winter ? SNOW : PROP.hills);
        b.addOutlined(geo.hill, col, outline, at(-0.25, 0.1, 0));
        b.addOutlined(geo.hill, col, outline, at(0.3, -0.15, 0, 0.8));
      }
    }

    addResource(t, b, geo, kit, outline, winter, at);
  });

  addRoads(map, b, geo, kit);
}

type At = (dx: number, dz: number, dy: number, scale?: number, rotY?: number) => Placement;

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
      // 겨울엔 거둬들여 비어 있다
      if (!winter) for (let k = -1; k <= 1; k++) b.add(geo.wheat, kit.toon(PROP.wheat), at(0, k * 0.26, 0.06));
      break;
    case 'ore':
      b.addOutlined(geo.ore, kit.toon(PROP.ore), outline, at(0.45, 0.4, 0.2));
      break;
    case 'salt':
      b.addOutlined(geo.salt, kit.toon(PROP.salt), outline, at(0.2, 0.15, 0.11), 0.1);
      b.addOutlined(geo.salt, kit.toon(PROP.salt), outline, at(-0.15, 0.3, 0.11), 0.1);
      break;
    case 'fish':
      b.addOutlined(geo.boat, kit.toon(PROP.boat), outline, at(0.25, 0.3, 0.05));
      break;
    default:
      break;
  }
}

/** 길: 칸 가운데에서 이웃한 길 칸 쪽으로 칸 가장자리까지 토막을 놓는다 */
function addRoads(map: WorldMap, b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit): void {
  const index = new Map(map.tiles.map((t, i) => [`${t.q},${t.r}`, i]));
  const mat = kit.toon(PROP.road);
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
