import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHexPrism } from './hexPrism';

describe('육각 기둥', () => {
  const geo = createHexPrism();
  const pos = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  const [top, side] = geo.groups;

  it('윗면 6조각, 옆면 12조각', () => {
    expect(top!.count).toBe(18);
    expect(side!.count).toBe(36);
  });

  it('윗면 법선은 위를 향한다', () => {
    for (let i = top!.start; i < top!.start + top!.count; i++) expect(normal.getY(i)).toBeCloseTo(1);
  });

  it('옆면 법선은 바깥을 향한다 (외곽선과 조명이 맞으려면)', () => {
    for (let i = side!.start; i < side!.start + side!.count; i++) {
      const p = new THREE.Vector3(pos.getX(i), 0, pos.getZ(i));
      const n = new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i));
      expect(n.dot(p)).toBeGreaterThan(0);
    }
  });
});
