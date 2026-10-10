// 바다: 지도 아래에 깔린 큰 수면 하나. 섬(육지 기둥)이 물에서 솟아 보이게 육지 기둥 바닥보다 높고 해안보다 낮다.
// 물색은 가까운 육지까지 거리로 섞는다 (해안 옆은 밝은 얕은 물, 멀어질수록 깊은 물). 거리는 지도를 놓을 때 한 번 재서 작은 질감에 담는다.
// 물결은 높이 대신 밝기만 아주 느리게 흐르고, 해안 가까이에 군데군데 끊어진 포말이 나타났다 사라진다.
// 포말은 로우폴리 느낌으로 작은 삼각형 조각 단위다: 조각마다 가운데 한 점에서만 재서 조각 전체가 켜지거나 꺼진다.
// 불투명 수면 하나라 아이폰에서 가볍다 (반사·굴절 없음).
import * as THREE from 'three';
import type { Season } from '../sim/season';
import { hexToXY, type WorldMap } from '../sim/worldgen';
import { SEA_COLOR } from './palette';

/** 수면 높이 (육지 기둥 바닥 -0.6과 가장 낮은 해안 윗면 사이) */
export const SEA_LEVEL = 0.26;
/** 거리 질감 한 변 픽셀 수 */
const DIST_RES = 128;
/** 거리 질감에 담는 가장 먼 거리 (칸 반지름 1 기준). 이보다 멀면 모두 깊은 바다 */
const MAX_DIST = 8;
/** 육지 칸 가운데에서 이만큼까지는 육지로 본다 (칸 반지름 1, 기둥 0.97) */
const LAND_RADIUS = 0.9;
/** 포말 삼각형 조각 한 변 (칸 반지름 1 기준) */
const FOAM_CELL = 0.22;
/** 수면 크기: 카메라가 어디를 보든 끝이 보이지 않게 */
const PLANE_SIZE = 400;

const vertexShader = /* glsl */ `
varying vec2 vXZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vXZ = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uDist;
uniform float uExtent;
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uFoamAmount;
varying vec2 vXZ;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

/** 해안까지 거리 (칸 반지름 1 기준) */
float coastDist(vec2 xz) {
  vec2 uv = xz / (2.0 * uExtent) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return ${MAX_DIST.toFixed(1)};
  return texture2D(uDist, uv).r * ${MAX_DIST.toFixed(1)};
}

void main() {
  float dist = coastDist(vXZ);

  // 해안까지 거리로 얕은 물 → 바다 → 먼 바다
  vec3 col = mix(uShallow, uMid, smoothstep(0.0, 1.2, dist));
  col = mix(col, uDeep, smoothstep(2.2, 7.0, dist));

  // 서로 다른 쪽으로 흐르는 무늬 둘을 겹쳐 밝기만 조금 (±5%)
  float n = noise(vXZ * 0.8 + vec2(uTime * 0.05, uTime * 0.03)) + noise(vXZ * 1.6 - vec2(uTime * 0.04, -uTime * 0.06));
  col *= 1.0 + (n - 1.0) * 0.05;

  // 포말: 삼각형 격자(한 변 FOAM_CELL)로 나눠, 조각 가운데에서 해안 거리와 무늬를 잰다.
  // 해안에 가까울수록 켜지기 쉽고, 무늬가 천천히 흘러 조각이 하나씩 나타났다 사라진다
  vec2 s = vXZ / ${FOAM_CELL.toFixed(2)};
  vec2 cell = floor(s + (s.x + s.y) * 0.3660254);
  vec2 local = s - (cell - (cell.x + cell.y) * 0.2113249);
  vec2 corner = local.x > local.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 mid = (cell * 3.0 + corner + vec2(1.0)) / 3.0;
  vec2 center = (mid - (mid.x + mid.y) * 0.2113249) * ${FOAM_CELL.toFixed(2)};
  float cd = coastDist(center);
  float wave = noise(center * 1.3 + vec2(uTime * 0.1, -uTime * 0.06)) * 0.7 + 0.3 * (0.5 + 0.5 * sin(uTime * 0.6 + center.x * 1.1 + center.y * 0.8));
  float on = step(cd, 0.42) * step(0.52 + cd * 0.6, wave);
  // 조각마다 밝기를 조금 달리해 면이 보이게
  float facet = 0.93 + 0.07 * hash(cell * 2.0 + corner);
  col = mix(col, uFoam * facet, on * uFoamAmount);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class SeaSurface {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE).rotateX(-Math.PI / 2);
  private dist: THREE.DataTexture | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uDist: { value: null },
        uExtent: { value: 1 },
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uDeep: { value: new THREE.Color() },
        uFoam: { value: new THREE.Color() },
        uFoamAmount: { value: 0.8 },
      },
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.y = SEA_LEVEL;
    // 바닥 판이라 다른 것을 가리지 않는다 (육지 기둥이 먼저 그려져도 깊이로 가린다)
    this.mesh.renderOrder = -1;
  }

  /** 지도가 바뀌면 해안까지 거리를 다시 잰다 */
  setWorld(map: WorldMap): void {
    this.dist?.dispose();
    const extent = (Math.sqrt(3) * map.radius + 1) + MAX_DIST;
    this.dist = coastDistance(map, extent);
    this.material.uniforms.uDist!.value = this.dist;
    this.material.uniforms.uExtent!.value = extent;
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
    this.geometry.dispose();
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
