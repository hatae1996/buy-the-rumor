// 카메라와 터치 조작. 한 손가락으로 돌리고, 두 손가락(또는 휠)으로 확대한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 판 전체를 덮는 반지름 (칸 반지름 1, 맵 반지름 7 기준으로 넉넉히) */
const BOARD_RADIUS = 13;
const VIEW_DIR = new THREE.Vector3(0, 1, 1).normalize();

export class MapCamera {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  readonly controls: OrbitControls;
  private touched = false;

  constructor(dom: HTMLElement) {
    this.camera.position.copy(VIEW_DIR).multiplyScalar(30);
    this.controls = new OrbitControls(this.camera, dom);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.minDistance = 9;
    c.minPolarAngle = 0.35;
    c.maxPolarAngle = 1.15;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener('start', () => (this.touched = true));
  }

  /** 화면 크기가 바뀌면 판이 다 보이는 거리로 맞춘다 (사용자가 아직 안 만졌을 때만) */
  resize(width: number, height: number): void {
    const cam = this.camera;
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    const halfV = THREE.MathUtils.degToRad(cam.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * cam.aspect);
    const fit = BOARD_RADIUS / Math.sin(Math.min(halfV, halfH));
    // 비스듬히 보면 판의 앞뒤가 줄어 보이므로 조금 당긴다
    const distance = fit * 0.9;
    this.controls.maxDistance = Math.max(34, distance * 1.3);
    if (!this.touched) cam.position.copy(VIEW_DIR).multiplyScalar(distance);
    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
