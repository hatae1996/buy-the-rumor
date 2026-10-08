// 같은 지오메트리와 재질을 쓰는 물체를 InstancedMesh 하나로 묶는다.
// 나무 수십 그루도 그리기 호출 한 번이라 아이폰에서 가볍다.
import * as THREE from 'three';

interface Bucket {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  matrices: THREE.Matrix4[];
}

const tmpQuat = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);

export interface Placement {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  /** 숫자 하나면 고르게, 배열이면 [x, y, z] */
  scale?: number | readonly [number, number, number];
}

export class InstanceBatcher {
  private readonly buckets = new Map<string, Bucket>();
  private readonly ids = new WeakMap<object, number>();
  private nextId = 0;

  add(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], at: Placement): void {
    const key = `${this.id(geometry)}:${Array.isArray(material) ? material.map((m) => this.id(m)).join('+') : this.id(material)}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { geometry, material, matrices: [] };
      this.buckets.set(key, b);
    }
    b.matrices.push(toMatrix(at));
  }

  /** 몸체와 외곽선을 같이 넣는다. 외곽선은 지오메트리 원점 기준으로 조금 키운다 */
  addOutlined(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    outline: THREE.Material | null,
    at: Placement,
    thickness = 0.06,
  ): void {
    this.add(geometry, material, at);
    if (!outline) return;
    const s = at.scale ?? 1;
    const k = 1 + thickness;
    this.add(geometry, outline, { ...at, scale: typeof s === 'number' ? s * k : [s[0] * k, s[1] * k, s[2] * k] });
  }

  build(): THREE.InstancedMesh[] {
    return [...this.buckets.values()].map((b) => {
      const mesh = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length);
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      return mesh;
    });
  }

  private id(o: object): number {
    let n = this.ids.get(o);
    if (n === undefined) {
      n = this.nextId++;
      this.ids.set(o, n);
    }
    return n;
  }
}

export function toMatrix({ x, y, z, rotY = 0, scale = 1 }: Placement): THREE.Matrix4 {
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQuat.setFromAxisAngle(yAxis, rotY), s);
}
