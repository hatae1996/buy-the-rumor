// 겨울에 내리는 눈. 점 몇백 개를 판 위에서 천천히 떨어뜨린다.
import * as THREE from 'three';

const COUNT = 420;
const RADIUS = 13;
const TOP = 9;
const BOTTOM = -0.5;

export class Snowfall {
  readonly points: THREE.Points;
  private readonly speed = new Float32Array(COUNT);
  private readonly drift = new Float32Array(COUNT);
  private time = 0;

  constructor() {
    const pos = new Float32Array(COUNT * 3);
    // 눈송이 자리는 보기용이라 시드 없이 정해도 되지만, 늘 같은 모습이 되도록 간단한 수열을 쓴다
    let s = 12345;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * RADIUS;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = BOTTOM + rand() * (TOP - BOTTOM);
      pos[i * 3 + 2] = Math.sin(a) * r;
      this.speed[i] = 0.6 + rand() * 0.7;
      this.drift[i] = rand() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  step(dt: number): void {
    this.time += dt;
    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const y = pos[i * 3 + 1]! - this.speed[i]! * dt;
      pos[i * 3 + 1] = y < BOTTOM ? TOP : y;
      pos[i * 3] = pos[i * 3]! + Math.sin(this.time * 0.8 + this.drift[i]!) * 0.15 * dt;
    }
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
