// 시즌 지도는 시드로 다시 만든다(저장하지 않는다). Edge Function 인스턴스가 살아 있는 동안 시즌마다 한 번만 만든다
import { seasonMap } from '../sim/service';
import type { WorldMap } from '../sim/worldgen';

const maps = new Map<string, WorldMap>();

export function mapFor(seasonId: string): WorldMap {
  let m = maps.get(seasonId);
  if (!m) {
    // 여러 시즌을 오래 들고 있지 않는다 (시즌은 2주마다 하나)
    if (maps.size >= 4) maps.clear();
    m = seasonMap(seasonId);
    maps.set(seasonId, m);
  }
  return m;
}
