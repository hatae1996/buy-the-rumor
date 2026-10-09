// 보드게임 말과 길 따라 움직이기.
import * as THREE from 'three';
import type { MaterialKit } from './materials';

export class PawnGeometries {
  readonly base = new THREE.CylinderGeometry(0.2, 0.26, 0.12, 12);
  readonly body = new THREE.CylinderGeometry(0.1, 0.19, 0.42, 12);
  readonly head = new THREE.SphereGeometry(0.15, 12, 10);
  /** 내 말 표시: 발밑 고리, 머리 위 깃대와 깃발 */
  readonly ring = new THREE.RingGeometry(0.32, 0.44, 32).rotateX(-Math.PI / 2);
  readonly pole = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6);
  readonly flag = new THREE.BoxGeometry(0.26, 0.16, 0.03);

  dispose(): void {
    this.base.dispose();
    this.body.dispose();
    this.head.dispose();
    this.ring.dispose();
    this.pole.dispose();
    this.flag.dispose();
  }
}

/** 고리 재질: 언덕·나무에 가려도 보이게 깊이를 무시하고 맨 나중에 그린다 */
export function ringMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
}

/**
 * 내 말 표시를 말에 붙인다: 발밑 고리 둘(가만히 있는 것, 퍼져 나가는 것)과 머리 위 깃발.
 * 퍼져 나가는 고리는 이름 'pulse'로 찾아 지도 쪽에서 움직인다
 */
export function addMarker(
  pawn: THREE.Group,
  geo: PawnGeometries,
  kit: MaterialKit,
  mats: { ring: THREE.Material; pulse: THREE.Material },
  flagColor: number,
  outline: boolean,
): void {
  const ring = new THREE.Mesh(geo.ring, mats.ring);
  ring.position.y = 0.02;
  ring.renderOrder = 10;
  const pulse = new THREE.Mesh(geo.ring, mats.pulse);
  pulse.name = 'pulse';
  pulse.position.y = 0.02;
  pulse.renderOrder = 10;
  const pole = new THREE.Mesh(geo.pole, kit.toon(0x6b4423));
  pole.position.y = 1.0;
  const flag = new THREE.Mesh(geo.flag, kit.toon(flagColor));
  flag.position.set(0.14, 1.17, 0);
  pawn.add(ring, pulse, pole, flag);
  if (outline) {
    const o = new THREE.Mesh(geo.flag, kit.outline);
    o.position.copy(flag.position);
    o.scale.setScalar(1.15);
    pawn.add(o);
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
  [0.5, -0.2],
  [-0.55, -0.15],
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
