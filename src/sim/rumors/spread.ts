// 퍼짐: 소문은 생긴 마을에서 길을 따라 하루에 한 마을씩 건너고, 건널 때마다 숫자가 뭉개지거나 부풀려진다.
// 생길 때 마을마다 닿는 날과 흐려진 정도를 미리 정해 둔다. 날마다 다시 돌리지 않아도 되고, 같은 시드면 같다.
import { RUMORS } from '../constants';
import type { Rng } from '../rng';
import { townLinks, type WorldMap } from '../worldgen';
import type { RumorCopy } from './types';

/** origin에서 day에 시작해 expires까지 닿는 마을들 (가까운 순) */
export function spreadReach(map: WorldMap, origin: number, day: number, expires: number, rng: Rng): RumorCopy[] {
  const links = townLinks(map);
  const out: RumorCopy[] = [{ town: origin, day, blur: 0, scale: 1 }];
  const seen = new Set([origin]);
  for (let i = 0; i < out.length; i++) {
    const from = out[i]!;
    if (from.day + 1 > expires) continue;
    for (const town of links[from.town]!) {
      if (seen.has(town)) continue;
      seen.add(town);
      out.push({
        town,
        day: from.day + 1,
        blur: from.blur + (rng.next() < RUMORS.hop.blurChance ? 1 : 0),
        scale: from.scale * (rng.next() < RUMORS.hop.exaggerateChance ? RUMORS.hop.exaggerate : 1),
      });
    }
  }
  return out;
}
