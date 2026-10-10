// 봇도 신문을 산다 (0.1.6 답 116 가): 도시 시세를 모르면 그날 신문을 사서, 실린 도시 시세를 "아는 시세"로 기억한다.
// 사람이 첫날 신문 한 부로 도시 값을 보고 집 앞에서 싼 것을 실어 가는 것처럼. 게임 규칙은 그대로다.
// 신문에는 도시마다 많이 거래된 물품 몇 개만 실리니, 기억도 그 물품만이다 (가 본 마을의 기억과 섞는다).
import type { Command, GoodId, PlayerView } from '../economy';
import type { BotMind } from './bot';

/** 신문에서 읽은 마을 시세 (마을 → 신문 날짜와 실린 값) */
export type PaperPrices = Record<number, { day: number; prices: Partial<Record<GoodId, number>> }>;

/** 아는 시세: 가 본 마을의 기억(모든 물품)에 신문에서 읽은 값을 더한 것 */
export type KnownPrices = Record<number, { day: number; prices: Partial<Record<GoodId, number>> }>;

/** 이보다 오래된 도시 시세만 알면 신문을 산다 (가 본 마을 기억을 믿는 날과 같게) */
const PAPER_STALE_DAYS = 30;

/** 산 신문의 도시 시세 줄을 읽어 둔다 (예전 저장의 머릿속에는 칸이 없다) */
export function readPapers(view: PlayerView, mind: BotMind): void {
  const papers = (mind.papers ??= {});
  for (const n of view.news) {
    if (n.section !== 'prices' || n.town === undefined || !n.prices) continue;
    if ((papers[n.town]?.day ?? -Infinity) >= n.day) continue;
    papers[n.town] = { day: n.day, prices: { ...n.prices } };
  }
}

/** 도시 시세를 아나 (가 봤거나 신문에서 읽었고, 오래되지 않았다) */
function knowsCity(view: PlayerView, mind: BotMind, cities: readonly number[]): boolean {
  return cities.some((c) => {
    const seen = Math.max(view.memory[c]?.day ?? -Infinity, mind.papers?.[c]?.day ?? -Infinity);
    return view.day - seen <= PAPER_STALE_DAYS;
  });
}

/** 도시 시세를 모르면(가 보지도, 신문에서 읽지도 않았으면) 오늘 신문을 산다. 살 수 없으면 null */
export function paperStep(view: PlayerView, mind: BotMind, cities: readonly number[], once: (c: Command) => Command | null): Command | null {
  const sale = view.newspaper.onSale;
  if (!sale || sale.bought || view.gold < view.newspaper.fee * 10) return null;
  return knowsCity(view, mind, cities) ? null : once({ type: 'buyNewspaper' });
}

/**
 * 도시 시세를 모르는데 이 마을에 신문이 아직 안 왔으면(시즌 첫날, 도시에서 먼 마을은 이튿날까지) 둘러보러 떠나지 않고 기다린다.
 * 사람도 신문으로 도시 값을 보고 나서 무엇을 실을지 정한다
 */
export function waitForPaper(view: PlayerView, mind: BotMind, cities: readonly number[]): boolean {
  return view.newspaper.onSale === null && view.location.kind === 'town' && !knowsCity(view, mind, cities);
}

/** 가 본 마을의 기억에 신문에서 읽은 더 새 값을 얹는다. 날짜는 둘 중 새것 */
export function knownPrices(view: PlayerView, mind: BotMind): KnownPrices {
  const out: KnownPrices = {};
  for (const [id, m] of Object.entries(view.memory)) out[Number(id)] = { day: m.day, prices: { ...m.prices } };
  for (const [id, paper] of Object.entries(mind.papers ?? {})) {
    const town = Number(id);
    const seen = out[town];
    if (seen && seen.day >= paper.day) continue;
    out[town] = { day: paper.day, prices: { ...seen?.prices, ...paper.prices } };
  }
  return out;
}
