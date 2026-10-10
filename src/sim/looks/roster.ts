// 세계의 얼굴 있는 NPC 명단과, 지금 마을에서 보이는 얼굴들.
// 얼굴은 상태에 저장하지 않는다: 시즌 id와 명단으로 언제든 같은 얼굴을 다시 만든다(봇이 쓰는 playerView에는 넣지 않는다).
import type { EconomyState, PlayerId } from '../economy/state';
import { seasonSeed } from '../economy/worldRef';
import { getPlayer } from '../economy/players';
import { hasBuilding } from '../growth/buildings';
import { candidate, type HireRole } from '../hire/hire';
import type { WorldMap } from '../worldgen';
import { assignLooks, npcKey } from './draw';
import { workerRole } from './roles';
import type { Look, NpcEntry } from './types';

/** 세계에서 얼굴이 있는 NPC 모두 (데려간 일꾼도 그대로 같은 사람) */
export function worldNpcs(state: EconomyState): NpcEntry[] {
  const out: NpcEntry[] = [{ kind: 'elder', id: 0, role: 'elder' }];
  state.towns.forEach((t, town) => {
    out.push({ kind: 'inn', id: town, role: 'innkeeper' });
    out.push({ kind: 'market', id: town, role: t.tier === 'city' ? 'cityMerchant' : 'merchant' });
  });
  for (const g of state.rumorMill.gossips) out.push({ kind: 'gossip', id: g.id, role: 'villager' });
  for (const t of state.traders) out.push({ kind: 'trader', id: t.id, role: 'cityMerchant' });
  for (const w of state.workers) out.push({ kind: 'worker', id: w.id, role: workerRole(w.job) });
  for (const p of Object.values(state.players)) {
    for (const h of p.hires) out.push({ kind: 'worker', id: h.worker.id, role: workerRole(h.worker.job) });
  }
  return out;
}

/** 세계의 모든 얼굴 (열쇠는 "종류:번호", npcKey) */
export function worldLooks(state: EconomyState): Map<string, Look> {
  return assignLooks(seasonSeed(state.world.seasonId), worldNpcs(state));
}

export interface TownFaces {
  town: number;
  /** 여관이 없는 마을은 null */
  innkeeper: Look | null;
  /** 장 상인 (마을 탭 시장 카드) */
  merchant: Look;
  /** 이 마을 소문꾼 */
  gossips: { id: number; name: string; look: Look }[];
  /** 고용 게시판에 나온 사람 (역할마다) */
  board: Partial<Record<HireRole, Look>>;
  /** 내가 데려온 사람 (일꾼 번호 → 얼굴) */
  hires: Record<number, Look>;
  /** 견습 동안 노상인 */
  elder: Look | null;
}

/** 지금 마을에서 보이는 얼굴들. 길 위에서는 null */
export function townFaces(state: EconomyState, map: WorldMap, playerId: PlayerId): TownFaces | null {
  const p = getPlayer(state, playerId);
  if (p.travel) return null;
  const looks = worldLooks(state);
  const of = (kind: NpcEntry['kind'], id: number) => looks.get(npcKey({ kind, id }))!;
  const town = p.town;
  const inn = hasBuilding(state, map, town, 'inn');
  const board: Partial<Record<HireRole, Look>> = {};
  if (inn) {
    for (const role of ['porter', 'gatherer', 'carter'] as const) {
      const w = candidate(state, town, role);
      if (w) board[role] = of('worker', w.id);
    }
  }
  return {
    town,
    innkeeper: inn ? of('inn', town) : null,
    merchant: of('market', town),
    gossips: state.rumorMill.gossips.filter((g) => g.town === town).map((g) => ({ id: g.id, name: g.name, look: of('gossip', g.id) })),
    board,
    hires: Object.fromEntries(p.hires.map((h) => [h.id, of('worker', h.worker.id)])),
    elder: p.apprentice ? of('elder', 0) : null,
  };
}
