// 툰 셰이딩 재질. 같은 색이면 재질 하나를 같이 쓴다 (사파리 메모리).
import * as THREE from 'three';
import { INK } from './palette';

export class MaterialKit {
  /** 명암 3단 */
  private readonly gradient: THREE.DataTexture;
  private readonly cache = new Map<number, THREE.MeshToonMaterial>();
  readonly outline: THREE.MeshBasicMaterial;

  constructor() {
    this.gradient = new THREE.DataTexture(
      new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]),
      3,
      1,
      THREE.RGBAFormat,
    );
    this.gradient.minFilter = THREE.NearestFilter;
    this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.needsUpdate = true;
    // 외곽선: 조금 키운 뒷면을 잉크색으로 그린다
    this.outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  }

  toon(color: number): THREE.MeshToonMaterial {
    let m = this.cache.get(color);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient });
      this.cache.set(color, m);
    }
    return m;
  }

  /** 그림 질감을 입힌 재질. 질감은 부른 쪽이 관리한다 */
  textured(map: THREE.Texture): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ map, gradientMap: this.gradient });
  }

  dispose(): void {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
    this.outline.dispose();
    this.gradient.dispose();
  }
}
