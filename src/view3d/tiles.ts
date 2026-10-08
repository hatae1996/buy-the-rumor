// 육각 기둥들. 지형마다 InstancedMesh 하나, 외곽선은 전체에 하나.
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { HEX_DIRS, type Terrain, type WorldMap } from '../sim/worldgen';
import { toMatrix } from './batcher';
import { createHexPrism } from './hexPrism';
import { PRISM_BOTTOM, tileCenter } from './layout';
import type { MaterialKit } from './materials';
import { FROZEN_SEA, SIDE_COLOR, TOP_COLOR } from './palette';
import { seasonTexture, type TileArtSet } from './tileArt';

const TERRAINS: readonly Terrain[] = ['sea', 'coast', 'plain', 'forest', 'hills', 'mountain'];

/** 기둥 지오메트리. 그림 질감마다 윗면 UV가 달라 지형별로 하나씩 */
export class PrismGeometries {
  readonly plain = createHexPrism();
  private readonly painted = new Map<Terrain, THREE.BufferGeometry>();

  forTerrain(t: Terrain, art: TileArtSet | null): THREE.BufferGeometry {
    if (!art) return this.plain;
    let g = this.painted.get(t);
    if (!g) {
      g = createHexPrism(art[t].topUv);
      this.painted.set(t, g);
    }
    return g;
  }

  dispose(): void {
    this.plain.dispose();
    this.painted.forEach((g) => g.dispose());
  }
}

export interface TileBoard {
  meshes: THREE.Object3D[];
  /** 누른 InstancedMesh와 instanceId로 칸 번호를 찾는다 */
  pickable: THREE.InstancedMesh[];
  tileOf(mesh: THREE.Object3D, instanceId: number): number | null;
  /** 이 판에서만 쓰는 질감과 재질 */
  dispose(): void;
}

export interface TileOptions {
  season: Season;
  /** null이면 색만 칠한다 */
  art: TileArtSet | null;
  outline: boolean;
}

export function buildTiles(map: WorldMap, prisms: PrismGeometries, kit: MaterialKit, opt: TileOptions): TileBoard {
  const owned: { dispose(): void }[] = [];
  const nearCoast = frozenSea(map);

  // 지형(겨울엔 언 바다 따로)마다 칸 번호를 모은다
  const groups = new Map<string, { terrain: Terrain; frozen: boolean; tiles: number[] }>();
  map.tiles.forEach((t, i) => {
    const frozen = opt.season === 3 && !opt.art && t.terrain === 'sea' && nearCoast.has(i);
    const key = `${t.terrain}${frozen ? '-ice' : ''}`;
    let g = groups.get(key);
    if (!g) {
      g = { terrain: t.terrain, frozen, tiles: [] };
      groups.set(key, g);
    }
    g.tiles.push(i);
  });

  const pickable: THREE.InstancedMesh[] = [];
  const tileIds = new Map<THREE.Object3D, number[]>();

  for (const terrain of TERRAINS) {
    for (const g of groups.values()) {
      if (g.terrain !== terrain) continue;
      let top: THREE.Material;
      if (opt.art) {
        const tex = seasonTexture(opt.art[terrain], terrain, opt.season);
        const mat = kit.textured(tex);
        owned.push(tex, mat);
        top = mat;
      } else {
        top = kit.toon(g.frozen ? FROZEN_SEA : TOP_COLOR[terrain][opt.season]);
      }
      const mesh = new THREE.InstancedMesh(prisms.forTerrain(terrain, opt.art), [top, kit.toon(SIDE_COLOR[terrain])], g.tiles.length);
      g.tiles.forEach((ti, k) => {
        const c = tileCenter(map.tiles[ti]!);
        mesh.setMatrixAt(k, toMatrix({ x: c.x, y: PRISM_BOTTOM, z: c.z, scale: [1, c.y - PRISM_BOTTOM, 1] }));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      pickable.push(mesh);
      tileIds.set(mesh, g.tiles);
    }
  }

  const meshes: THREE.Object3D[] = [...pickable];
  if (opt.outline) {
    const out = new THREE.InstancedMesh(prisms.plain, kit.outline, map.tiles.length);
    map.tiles.forEach((t, i) => {
      const c = tileCenter(t);
      out.setMatrixAt(i, toMatrix({ x: c.x, y: PRISM_BOTTOM - 0.01, z: c.z, scale: [1.025, c.y - PRISM_BOTTOM + 0.02, 1.025] }));
    });
    out.instanceMatrix.needsUpdate = true;
    out.computeBoundingSphere();
    meshes.push(out);
  }

  return {
    meshes,
    pickable,
    tileOf: (mesh, id) => tileIds.get(mesh)?.[id] ?? null,
    dispose: () => owned.forEach((o) => o.dispose()),
  };
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
