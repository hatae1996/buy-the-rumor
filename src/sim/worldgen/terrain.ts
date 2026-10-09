// 1단계: 노이즈 높이와 습도로 지형 6종과 자원지를 정한다.
import { WORLDGEN } from '../constants';
import type { Rng } from '../rng';
import { buildNeighbors, hexesInRadius, hexToXY } from './hex';
import { fbm } from './noise';
import type { ResourceKind, Terrain, Tile } from './types';

export interface TerrainResult {
  tiles: Tile[];
  neighbors: number[][];
}

export function generateTerrain(seed: number, rng: Rng, radius: number): TerrainResult {
  const { noise, terrain: th, resource: rc } = WORLDGEN;
  const ox = rng.next() * 100;
  const oy = rng.next() * 100;
  const mx = rng.next() * 100;
  const my = rng.next() * 100;
  const heightSeed = seed % 997;
  const moistureSeed = (seed + 7) % 997;
  const maxDist = Math.sqrt(3) * radius;

  const cells = hexesInRadius(radius);
  const neighbors = buildNeighbors(cells);

  const raw = cells.map(({ q, r }) => {
    const { x, y } = hexToXY(q, r);
    const dn = Math.sqrt(x * x + y * y) / maxDist;
    // 가장자리로 갈수록 낮아져 섬이 된다. 프로토타입은 dn^2.6이었는데,
    // Math.pow는 엔진마다 끝자리가 다를 수 있어 정확히 계산되는 dn^2.5 = dn² × √dn으로 바꿨다.
    const falloff = dn * dn * Math.sqrt(dn);
    return {
      q,
      r,
      height: fbm(x * noise.heightScale + ox, y * noise.heightScale + oy, heightSeed) + noise.heightBias - noise.edgeFalloff * falloff,
      moisture: fbm(x * noise.moistureScale + mx, y * noise.moistureScale + my, moistureSeed),
      roll: rng.next(),
    };
  });

  const terrains: Terrain[] = raw.map(({ height, moisture }) => {
    if (height < th.sea) return 'sea';
    if (height > th.mountain) return 'mountain';
    if (height > th.hills) return 'hills';
    if (moisture > th.forestMoisture) return 'forest';
    return 'plain';
  });

  // 해안은 위에서 정한 바다를 보고 정한다 (해안끼리는 서로 영향을 주지 않는다)
  const finalTerrains = terrains.map((t, i) => {
    const low = raw[i]!.height < th.coastHeight;
    const bySea = neighbors[i]!.some((n) => terrains[n] === 'sea');
    return (t === 'plain' || t === 'forest') && low && bySea ? 'coast' : t;
  });

  const tiles = raw.map(({ q, r, height, moisture, roll }, i): Tile => {
    const terrain = finalTerrains[i]!;
    return { q, r, terrain, height, moisture, resource: pickResource(terrain, moisture, roll), road: false };
  });

  return { tiles, neighbors };

  function pickResource(terrain: Terrain, moisture: number, roll: number): ResourceKind | null {
    switch (terrain) {
      case 'forest':
        return 'forest';
      case 'coast':
        return moisture < rc.saltMoisture && roll < rc.saltChance ? 'salt' : 'fish';
      case 'hills':
        return roll < rc.hillsOreChance ? 'ore' : null;
      case 'mountain':
        return roll < rc.mountainOreChance ? 'ore' : null;
      case 'plain':
        return roll < rc.fieldChance ? 'field' : null;
      case 'sea':
        return null;
    }
  }
}
