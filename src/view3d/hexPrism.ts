// 육각 기둥 지오메트리. 높이 1(바닥 y=0, 윗면 y=1)로 만들고 칸마다 y로 늘린다.
// 재질 그룹 0은 윗면, 1은 옆면이다. 윗면 UV는 그림 질감의 윗면 꼭짓점에 맞출 수 있다.
import * as THREE from 'three';

/** 칸 반지름 1에서 틈을 조금 둔 기둥 반지름 */
export const PRISM_RADIUS = 0.97;

/**
 * 윗면 꼭짓점 6개의 UV. 순서는 위(-z)에서 시계 방향: 위, 오른쪽 위, 오른쪽 아래, 아래, 왼쪽 아래, 왼쪽 위.
 * 화면에서 위쪽(-z)이 그림의 위쪽이 된다.
 */
export type TopUv = readonly (readonly [number, number])[];

/** 질감 없이 쓸 때의 기본 UV (정육각형) */
export const REGULAR_TOP_UV: TopUv = corners().map(([x, z]) => [0.5 + x / 2, 0.5 - z / 2] as const);

/** 꼭짓점 위치 (x, z). 반지름 1 */
function corners(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i; // 0이면 위쪽(-z) 꼭짓점
    out.push([Math.sin(a), -Math.cos(a)]);
  }
  return out;
}

export function createHexPrism(topUv: TopUv = REGULAR_TOP_UV): THREE.BufferGeometry {
  const c = corners().map(([x, z]) => [x * PRISM_RADIUS, z * PRISM_RADIUS] as const);
  const center = topUv.reduce((s, [u, v]) => [s[0] + u / 6, s[1] + v / 6], [0, 0]);
  const pos: number[] = [];
  const uv: number[] = [];

  // 윗면: 가운데에서 부채꼴 6조각 (위에서 볼 때 반시계 = 앞면)
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    pos.push(0, 1, 0, c[j]![0], 1, c[j]![1], c[i]![0], 1, c[i]![1]);
    uv.push(center[0], center[1], topUv[j]![0], topUv[j]![1], topUv[i]![0], topUv[i]![1]);
  }
  const topCount = pos.length / 3;

  // 옆면 6장
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const [ax, az] = c[i]!;
    const [bx, bz] = c[j]!;
    // 바깥에서 볼 때 반시계가 되도록 (법선이 바깥을 향한다)
    pos.push(ax, 0, az, bx, 1, bz, bx, 0, bz, ax, 0, az, ax, 1, az, bx, 1, bz);
    uv.push(0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  geo.addGroup(0, topCount, 0);
  geo.addGroup(topCount, pos.length / 3 - topCount, 1);
  return geo;
}
