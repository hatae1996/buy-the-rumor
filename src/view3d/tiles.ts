// 육각 기둥들. 모든 칸을 InstancedMesh 하나로 그리고, 칸마다 색(instanceColor)을 입힌다.
// 윗면 재질은 흰색, 옆면 재질은 회색이라 같은 칸 색이 옆면에서는 어둡게 보인다.
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { HEX_DIRS, type WorldMap } from '../sim/worldgen';
import { toMatrix } from './batcher';
import { createHexPrism } from './hexPrism';
import { PRISM_BOTTOM, tileCenter, tileHash } from './layout';
import type { MaterialKit } from './materials';
import { FROZEN_SEA, SIDE_SHADE, TILE_COLOR } from './palette';

export interface TileBoard {
  meshes: THREE.Object3D[];
  /** 누른 InstancedMesh와 instanceId로 칸 번호를 찾는다 */
  pickable: THREE.InstancedMesh[];
  tileOf(mesh: THREE.Object3D, instanceId: number): number | null;
}

export interface TileOptions {
  season: Season;
  outline: boolean;
}

/** 지도에 하나만 두는 기둥 지오메트리 */
export function createPrism(): THREE.BufferGeometry {
  return createHexPrism();
}

export function buildTiles(map: WorldMap, prism: THREE.BufferGeometry, kit: MaterialKit, opt: TileOptions): TileBoard {
  const nearCoast = frozenSea(map);
  const sideGray = Math.round(SIDE_SHADE * 255);
  const mesh = new THREE.InstancedMesh(prism, [kit.solid(0xffffff), kit.solid((sideGray << 16) | (sideGray << 8) | sideGray)], map.tiles.length);
  const color = new THREE.Color();
  map.tiles.forEach((t, i) => {
    const c = tileCenter(t);
    mesh.setMatrixAt(i, toMatrix({ x: c.x, y: PRISM_BOTTOM, z: c.z, scale: [1, c.y - PRISM_BOTTOM, 1] }));
    const frozen = opt.season === 3 && t.terrain === 'sea' && nearCoast.has(i);
    // 밝은 칸이 조금 더 많게 (들판이 환해 보이게)
    const [light, dark] = TILE_COLOR[t.terrain][opt.season];
    mesh.setColorAt(i, color.setHex(frozen ? FROZEN_SEA : tileHash(t.q, t.r) < 0.62 ? light : dark));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const meshes: THREE.Object3D[] = [mesh];
  if (opt.outline) {
    const out = new THREE.InstancedMesh(prism, kit.outline, map.tiles.length);
    map.tiles.forEach((t, i) => {
      const c = tileCenter(t);
      out.setMatrixAt(i, toMatrix({ x: c.x, y: PRISM_BOTTOM - 0.01, z: c.z, scale: [1.025, c.y - PRISM_BOTTOM + 0.02, 1.025] }));
    });
    out.instanceMatrix.needsUpdate = true;
    out.computeBoundingSphere();
    meshes.push(out);
  }

  return { meshes, pickable: [mesh], tileOf: (m, id) => (m === mesh ? id : null) };
}

/** 해안에 닿은 바다 칸 */
function frozenSea(map: WorldMap): Set<number> {
  const coast = new Set(map.tiles.filter((t) => t.terrain === 'coast').map((t) => `${t.q},${t.r}`));
  const out = new Set<number>();
  map.tiles.forEach((t, i) => {
    if (t.terrain !== 'sea') return;
    const near = HEX_DIRS.some(([dq, dr]) => coast.has(`${t.q + dq},${t.r + dr}`));
    if (near) out.add(i);
  });
  return out;
}
