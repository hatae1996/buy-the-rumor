// 카메라와 터치 조작. 한 손가락으로 돌리고, 두 손가락(또는 휠)으로 확대한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 판 전체를 덮는 반지름 (칸 반지름 1, 맵 반지름 7 기준으로 넉넉히) */
const BOARD_RADIUS = 13;
const VIEW_DIR = new THREE.Vector3(0, 1, 1).normalize();
/** 내 말에 다가갈 때의 거리 */
const FOCUS_DISTANCE = 12;
/** 다가가고 물러나는 빠르기 (클수록 빠르다) */
const EASE = 5;

export class MapCamera {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  readonly controls: OrbitControls;
  private touched = false;
  /** 판 전체가 보이는 거리 (화면 크기로 정해진다) */
  private overviewDistance = 30;
  /** 따라가는 말. null이면 판 가운데 */
  private following: THREE.Object3D | null = null;
  /** 가려는 거리. 닿거나 사용자가 만지면 null */
  private goalDistance: number | null = null;
  private readonly goal = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

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
    c.addEventListener('start', () => {
      this.touched = true;
      // 손가락으로 확대하면 그 거리를 따른다 (따라가기는 그대로)
      this.goalDistance = null;
    });
  }

  /** 말 하나를 따라가며 다가간다. null이면 판 전체가 보이게 물러난다 */
  focusOn(obj: THREE.Object3D | null): void {
    this.touched = true;
    this.following = obj;
    this.goalDistance = obj ? FOCUS_DISTANCE : this.overviewDistance;
  }

  /** 거리는 그대로 두고 따라갈 말만 바꾼다 (말을 다시 만들었을 때) */
  follow(obj: THREE.Object3D): void {
    if (this.following) this.following = obj;
  }

  get focused(): boolean {
    return this.following !== null;
  }

  /** 매 장면마다: 따라가는 말 쪽으로 천천히 옮기고 조작을 반영한다 */
  step(dt: number): void {
    const c = this.controls;
    const f = this.following;
    // 말이 깡충 뛰어도 카메라가 흔들리지 않게 높이는 고정
    if (f) this.goal.set(f.position.x, 0.3, f.position.z);
    else this.goal.set(0, 0, 0);
    if (c.target.distanceToSquared(this.goal) > 1e-6 || this.goalDistance !== null) {
      const k = 1 - Math.exp(-dt * EASE);
      this.offset.copy(this.camera.position).sub(c.target);
      c.target.lerp(this.goal, k);
      if (this.goalDistance !== null) {
        const len = THREE.MathUtils.lerp(this.offset.length(), this.goalDistance, k);
        this.offset.setLength(len);
        if (Math.abs(len - this.goalDistance) < 0.05) this.goalDistance = null;
      }
      this.camera.position.copy(c.target).add(this.offset);
    }
    c.update();
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
    this.overviewDistance = distance;
    this.controls.maxDistance = Math.max(34, distance * 1.3);
    if (!this.touched) cam.position.copy(VIEW_DIR).multiplyScalar(distance);
    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
