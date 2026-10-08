// 보드게임 말과 길 따라 움직이기.
import * as THREE from 'three';
import type { MaterialKit } from './materials';

export class PawnGeometries {
  readonly base = new THREE.CylinderGeometry(0.2, 0.26, 0.12, 12);
  readonly body = new THREE.CylinderGeometry(0.1, 0.19, 0.42, 12);
  readonly head = new THREE.SphereGeometry(0.15, 12, 10);

  dispose(): void {
    this.base.dispose();
    this.body.dispose();
    this.head.dispose();
  }
}

export function createPawn(geo: PawnGeometries, kit: MaterialKit, color: number, outline: boolean): THREE.Group {
  const g = new THREE.Group();
  const parts: [THREE.BufferGeometry, number][] = [
    [geo.base, 0.06],
    [geo.body, 0.33],
    [geo.head, 0.66],
  ];
  for (const [part, y] of parts) {
    const m = new THREE.Mesh(part, kit.toon(color));
    m.position.y = y;
    g.add(m);
    if (outline) {
      const o = new THREE.Mesh(part, kit.outline);
      o.position.y = y;
      o.scale.setScalar(1.1);
      g.add(o);
    }
  }
  return g;
}

/** 칸 위에서 말이 서는 자리. 여러 말이 한 칸에 있으면 겹치지 않게 비켜 선다 */
export const PAWN_SLOTS: readonly (readonly [number, number])[] = [
  [0.42, 0.38],
  [-0.45, 0.35],
  [0.05, 0.55],
  [-0.1, -0.5],
];

/** 길 따라 한 칸씩 깡충깡충 */
export class PawnMover {
  private i = 0;
  private t = 0;

  constructor(
    private readonly pawn: THREE.Object3D,
    private readonly points: readonly THREE.Vector3[],
    /** 한 칸에 걸리는 초 */
    private readonly secondsPerStep = 0.32,
  ) {}

  /** 다 왔으면 true */
  step(dt: number): boolean {
    this.t += dt / this.secondsPerStep;
    while (this.t >= 1) {
      this.t -= 1;
      this.i++;
    }
    if (this.i >= this.points.length - 1) {
      this.pawn.position.copy(this.points[this.points.length - 1]!);
      return true;
    }
    const a = this.points[this.i]!;
    const b = this.points[this.i + 1]!;
    this.pawn.position.lerpVectors(a, b, this.t);
    this.pawn.position.y += Math.sin(this.t * Math.PI) * 0.35;
    return false;
  }
}
