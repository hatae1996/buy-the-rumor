// 바다: 지도 아래에 깔린 수면. 섬(육지 기둥)이 물에서 솟아 보이게 육지 기둥 바닥보다 높고 해안보다 낮다.
// 물색은 가까운 육지까지 거리로 섞는다 (해안 옆은 밝은 얕은 물, 멀어질수록 깊은 물). 거리는 지도를 놓을 때 한 번 재서 작은 질감에 담는다.
// 섬 둘레는 잘게 나눈 판이라 낮게 출렁이는 각진 물결 면이 보이고, 그 바깥은 평평한 판이다. 그리는 법은 seaShader.ts.
// 불투명 수면이라 아이폰에서 가볍다 (반사·굴절 없음).
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { hexToXY, type WorldMap } from '../sim/worldgen';
import { SEA_COLOR } from './palette';
import { seaFragmentShader, seaVertexShader } from './seaShader';

/** 수면 높이 (육지 기둥 바닥 -0.6과 가장 낮은 해안 윗면 사이) */
export const SEA_LEVEL = 0.26;
/** 거리 질감 한 변 픽셀 수 */
const DIST_RES = 128;
/** 거리 질감에 담는 가장 먼 거리 (칸 반지름 1 기준). 이보다 멀면 모두 깊은 바다 */
const MAX_DIST = 8;
/** 육지 칸 가운데에서 이만큼까지는 육지로 본다 (칸 반지름 1, 기둥 0.97) */
const LAND_RADIUS = 0.9;
/** 포말 삼각형 조각 한 변 (칸 반지름 1 기준) */
const FOAM_CELL = 0.13;
/** 물결 판의 격자 한 칸 (작을수록 면이 잘다) */
const WAVE_CELL = 0.55;
/** 물결 높이 */
const WAVE_AMP = 0.05;
/** 해 반짝임 세기 */
const GLINT = 0.11;
/** 바깥 판 크기: 카메라가 어디를 보든 끝이 보이지 않게 */
const PLANE_SIZE = 400;

export class SeaSurface {
  readonly object = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private dist: THREE.DataTexture | null = null;
  private geometries: THREE.BufferGeometry[] = [];

  constructor() {
    const md = MAX_DIST.toFixed(1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: seaVertexShader(md),
      fragmentShader: seaFragmentShader(md, FOAM_CELL.toFixed(2)),
      uniforms: {
        uDist: { value: null },
        uExtent: { value: 1 },
        uCalmEdge: { value: 1 },
        uTime: { value: 0 },
        uAmp: { value: WAVE_AMP },
        uShallow: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uDeep: { value: new THREE.Color() },
        uFoam: { value: new THREE.Color() },
        uFoamAmount: { value: 0.8 },
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uGlint: { value: GLINT },
      },
    });
    this.object.position.y = SEA_LEVEL;
    this.object.renderOrder = -1;
  }

  /** 지도가 바뀌면 해안까지 거리를 다시 재고, 섬 둘레 물결 판을 다시 만든다 */
  setWorld(map: WorldMap): void {
    this.dist?.dispose();
    const extent = Math.sqrt(3) * map.radius + 1 + MAX_DIST;
    this.dist = coastDistance(map, extent);
    const u = this.material.uniforms;
    u.uDist!.value = this.dist;
    u.uExtent!.value = extent;
    u.uCalmEdge!.value = extent;

    this.object.clear();
    this.geometries.forEach((g) => g.dispose());
    const size = 2 * extent;
    const seg = Math.min(120, Math.ceil(size / WAVE_CELL));
    // 섬 둘레: 잘게 나눈 판 (물결 면)
    const inner = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    // 바깥: 가운데를 비운 네 장 (겹치면 물결 골에서 바깥 판이 비친다)
    const far = PLANE_SIZE / 2;
    const ring = [
      [0, -(extent + far) / 2, PLANE_SIZE, far - extent],
      [0, (extent + far) / 2, PLANE_SIZE, far - extent],
      [-(extent + far) / 2, 0, far - extent, size],
      [(extent + far) / 2, 0, far - extent, size],
    ].map(([x, z, w, d]) => new THREE.PlaneGeometry(w!, d!).rotateX(-Math.PI / 2).translate(x!, 0, z!));
    this.geometries = [inner, ...ring];
    for (const g of this.geometries) this.object.add(new THREE.Mesh(g, this.material));
  }

  setSeason(season: Season): void {
    const c = SEA_COLOR[season];
    const u = this.material.uniforms;
    (u.uShallow!.value as THREE.Color).setHex(c.shallow);
    (u.uMid!.value as THREE.Color).setHex(c.mid);
    (u.uDeep!.value as THREE.Color).setHex(c.deep);
    (u.uFoam!.value as THREE.Color).setHex(c.foam);
    u.uFoamAmount!.value = c.foamAmount;
  }

  /** 해가 비추는 쪽 (물결 면의 밝기와 반짝임) */
  setSun(direction: THREE.Vector3): void {
    (this.material.uniforms.uSun!.value as THREE.Vector3).copy(direction).normalize();
  }

  /** 수면 너머 배경도 먼 바다 색으로 */
  get deepColor(): number {
    return (this.material.uniforms.uDeep!.value as THREE.Color).getHex();
  }

  step(dt: number): void {
    // 오래 켜 두어도 숫자가 커져 무늬가 깨지지 않게 되돌린다
    this.material.uniforms.uTime!.value = ((this.material.uniforms.uTime!.value as number) + dt) % 1000;
  }

  dispose(): void {
    this.dist?.dispose();
    this.material.dispose();
    this.geometries.forEach((g) => g.dispose());
  }
}

/**
 * 해안까지 거리 질감: 픽셀마다 가장 가까운 육지 칸 가장자리까지의 거리를 0~MAX_DIST에서 0~255로.
 * 질감의 가로는 x, 세로는 z (-extent ~ extent). 육지 위는 0
 */
export function coastDistance(map: WorldMap, extent: number): THREE.DataTexture {
  const land = map.tiles.filter((t) => t.terrain !== 'sea').map((t) => hexToXY(t.q, t.r));
  const data = new Uint8Array(DIST_RES * DIST_RES * 4);
  for (let py = 0; py < DIST_RES; py++) {
    const z = ((py + 0.5) / DIST_RES) * 2 * extent - extent;
    for (let px = 0; px < DIST_RES; px++) {
      const x = ((px + 0.5) / DIST_RES) * 2 * extent - extent;
      let best = Infinity;
      for (const p of land) {
        const d = Math.hypot(p.x - x, p.y - z);
        if (d < best) best = d;
      }
      const v = Math.round((Math.min(MAX_DIST, Math.max(0, best - LAND_RADIUS)) / MAX_DIST) * 255);
      const i = (py * DIST_RES + px) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, DIST_RES, DIST_RES, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
