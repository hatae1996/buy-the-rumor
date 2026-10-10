// 로우폴리 재질: 면마다 한 가지 색(flatShading)으로 빛과 그림자를 받는다. 같은 색이면 재질 하나를 같이 쓴다 (사파리 메모리).
import * as THREE from 'three';
import { INK } from './palette';

export class MaterialKit {
  private readonly cache = new Map<number, THREE.MeshLambertMaterial>();
  readonly outline: THREE.MeshBasicMaterial;

  constructor() {
    // 외곽선(개발용으로만 켠다): 조금 키운 뒷면을 잉크색으로 그린다
    this.outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  }

  solid(color: number): THREE.MeshLambertMaterial {
    let m = this.cache.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.cache.set(color, m);
    }
    return m;
  }

  dispose(): void {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
    this.outline.dispose();
  }
}
