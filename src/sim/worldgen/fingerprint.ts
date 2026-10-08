// 맵 전체를 짧은 문자열 하나로. 같은 시드에서 기기마다(사파리, Node) 같은 맵이 나오는지 비교할 때 쓴다.
import type { WorldMap } from './types';

export function worldFingerprint(map: WorldMap): string {
  const text =
    map.tiles.map((t) => `${t.terrain[0]}${t.resource?.[0] ?? '-'}${t.road ? 'r' : ''}`).join('|') +
    '#' +
    map.towns.map((t) => `${t.tile}:${t.name}:${t.tier}:${t.specialties.join(',')}`).join('|') +
    '#' +
    map.regions.map((r) => `${r.tag}:${r.tiles.join(',')}`).join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
