// 기록할 숫자 (작업목록-0.2.0 13번, handoff 0.2.0 4번, 답 120·133): 세계 상태와 하루치 기록으로 센다.
// 시작 마을 묶음, 첫 5일 순자산·판 이익(하루 값), 독점(전체 / 사람 기준). 서버는 여기에 처음 흐름 시간·접속·시스템 사용을 붙인다.
import { getPlayer, type EconomyState, type GoodId, type LedgerEntry, type PlayerId } from '../economy';
import { AUTUMN } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';

/** 시작 마을 묶음 (답 120): 도시에서 시작 / 도시까지 1·2·3·4일 이상 */
export type StartGroup = 'city' | '1' | '2' | '3' | '4+';

export function startGroup(map: WorldMap, town: number): StartGroup {
  if (map.towns[town]!.tier === 'city') return 'city';
  const days = townTravelDays(map, AUTUMN)[town]!;
  const toCity = Math.min(...map.towns.filter((t) => t.tier === 'city').map((t) => days[t.id]!));
  if (!Number.isFinite(toCity)) return '4+';
  const d = Math.max(1, Math.ceil(toCity));
  return d >= 4 ? '4+' : (String(d) as StartGroup);
}

/**
 * 날마다 판 것의 이익 (봇 측정과 같은 방식, src/sim/bot/run.ts): 물품마다 산 값의 평균을 들고 다니며
 * 판 값 − 판 만큼의 산 값. 원정·채집으로 얻은 것은 산 값 0
 */
export function dailyProfit(ledger: readonly LedgerEntry[]): Map<number, number> {
  const cost: Partial<Record<GoodId, { qty: number; value: number }>> = {};
  const out = new Map<number, number>();
  for (const e of ledger) {
    if (e.kind === 'buy') {
      const c = cost[e.good] ?? { qty: 0, value: 0 };
      cost[e.good] = { qty: c.qty + e.qty, value: c.value + e.qty * e.price };
    } else if (e.kind === 'sell') {
      const c = cost[e.good] ?? { qty: 0, value: 0 };
      const unit = c.qty > 0 ? c.value / c.qty : 0;
      const used = Math.min(c.qty, e.qty);
      cost[e.good] = { qty: c.qty - used, value: c.value - used * unit };
      out.set(e.day, (out.get(e.day) ?? 0) + e.qty * e.price - used * unit);
    }
  }
  return out;
}

export interface FirstDays {
  /** 들어온 날부터 5일, 장날마다 판 이익 (판 것이 없는 날은 0) */
  profit: number[];
  /** 들어온 날부터 5일, 장날 뒤 순자산 (하루치 기록에 있는 날만) */
  worth: number[];
  /** 순자산의 하루 증가 평균 (들어올 때 순자산부터) */
  worthPerDay: number | null;
  profitPerDay: number;
}

/** 첫 5일 (답 120 가·라): 판 이익과 순자산, 하루 값으로 */
export function firstDays(state: EconomyState, pid: PlayerId, worthByDay: ReadonlyMap<number, number>, days = 5): FirstDays {
  const p = getPlayer(state, pid);
  const from = p.record?.joinedDay ?? 1;
  const profitByDay = dailyProfit(p.ledger);
  const span = Array.from({ length: days }, (_, i) => from + i).filter((d) => d < state.day);
  const profit = span.map((d) => Math.round(profitByDay.get(d) ?? 0));
  const worth = span.flatMap((d) => (worthByDay.has(d) ? [worthByDay.get(d)!] : []));
  const start = p.record?.startWorth ?? null;
  const last = worth.at(-1);
  return {
    profit,
    worth,
    worthPerDay: start !== null && last !== undefined && worth.length ? Math.round(((last - start) / worth.length) * 10) / 10 : null,
    profitPerDay: span.length ? Math.round((profit.reduce((a, b) => a + b, 0) / span.length) * 10) / 10 : 0,
  };
}

export interface Monopoly {
  /** 가장 많이 혼자 판 곳에서 그 사람이 50%를 넘은 날 수 */
  soleDays: number;
  at: { town: number; good: GoodId; playerId: PlayerId } | null;
  /** 이번 시즌 연 장날 수 */
  days: number;
  /** 시즌 절반 넘게 (답 92 기준) */
  monopoly: boolean;
}

/**
 * 독점 (답 92, 133): 날마다 마을·물품마다 그날 플레이어 판매의 50%를 넘게 판 사람이 있으면 그 사람의 날 하나.
 * 같은 한 사람이 그 마을·그 물품에서 시즌 절반 넘는 날이면 독점. humansOnly면 그 사람이 사람일 때만 센다(사람 기준).
 * 판매 몫의 분모는 봇을 포함한 모든 플레이어 판매다
 */
export function monopoly(state: EconomyState, humansOnly: boolean): Monopoly {
  const byDay = new Map<string, Map<PlayerId, number>>();
  for (const p of Object.values(state.players)) {
    for (const e of p.ledger) {
      if (e.kind !== 'sell') continue;
      const key = `${e.day}:${e.town}:${e.good}`;
      const m = byDay.get(key) ?? new Map<PlayerId, number>();
      m.set(p.id, (m.get(p.id) ?? 0) + e.qty);
      byDay.set(key, m);
    }
  }
  const sole = new Map<string, number>();
  for (const [key, sellers] of byDay) {
    const total = [...sellers.values()].reduce((a, b) => a + b, 0);
    for (const [pid, q] of sellers) {
      if (total > 0 && q / total > 0.5) {
        const place = `${key.slice(key.indexOf(':') + 1)}:${pid}`;
        sole.set(place, (sole.get(place) ?? 0) + 1);
      }
    }
  }
  let best: [string, number] | null = null;
  for (const [k, v] of sole) {
    const pid = k.split(':').slice(2).join(':');
    if (humansOnly && state.players[pid]?.bot !== false) continue;
    if (!best || v > best[1] || (v === best[1] && k < best[0])) best = [k, v];
  }
  const season = state.season;
  const days = season ? Math.max(0, Math.min(state.day - 1, season.startDay + season.length - 1) - season.startDay + 1) : 0;
  const at = best
    ? (() => {
        const [town, good, ...rest] = best[0].split(':');
        return { town: Number(town), good: good as GoodId, playerId: rest.join(':') };
      })()
    : null;
  return { soleDays: best?.[1] ?? 0, at, days, monopoly: (best?.[1] ?? 0) > days / 2 };
}
