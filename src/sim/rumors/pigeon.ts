// 돈을 내고 아는 소식 (기획서 "소문 - 듣는 방법"): 전서구와 정보원. 둘 다 정확하다.
// 전서구는 먼 마을 하나의 오늘 시세를 한 번, 다음 날 받는다.
// 정보원은 한 마을에 심어 두면 매일 그 마을 시세와 장날 신청 현황을 보내 준다 (여관 고용 게시판에서 고용).
import { RUMORS } from '../constants';
import { GOOD_NAME, GOODS, type GoodId } from '../economy/goods';
import type { EconomyState } from '../economy/state';
import { iGa } from '../josa';
import type { WorldMap } from '../worldgen';
import { addNote } from './notebook';
import type { HeardRumor } from './types';

/** 그 마을 오늘 시세를 플레이어 기억에 적는다 (마지막으로 본 날과 함께) */
function rememberPrices(state: EconomyState, town: number): Record<GoodId, number> {
  const t = state.towns[town]!;
  const prices = {} as Record<GoodId, number>;
  for (const g of GOODS) prices[g] = Math.round(t.refPrice[g]);
  const p = state.player;
  p.memory[town] = { day: state.day, prices, previous: p.memory[town]?.prices ?? null };
  return prices;
}

/** 장날이 끝난 뒤: 보낸 전서구가 그 마을 오늘 시세를 갖고 온다 (플레이어는 다음 날 아침에 본다) */
export function deliverPigeons(state: EconomyState, map: WorldMap): HeardRumor[] {
  const p = state.player;
  const out: HeardRumor[] = [];
  for (const pg of p.pigeons) {
    const prices = rememberPrices(state, pg.town);
    const list = GOODS.map((g) => `${GOOD_NAME[g]} ${prices[g]}`).join(' · ');
    out.push(
      addNote(state, {
        town: pg.town,
        text: `${map.towns[pg.town]!.name} 시세: ${list}`,
        via: 'pigeon',
        from: '전서구',
        gossip: null,
        rumor: null,
        importance: 4,
        claim: null,
      }),
    );
  }
  p.pigeons = [];
  return out;
}

/** 장날이 끝난 뒤: 정보원이 품삯을 받고 그 마을 시세와 신청 현황을 보낸다. 품삯을 못 주면 떠난다 */
export function informantReports(state: EconomyState, map: WorldMap): HeardRumor[] {
  const p = state.player;
  const out: HeardRumor[] = [];
  const stay: number[] = [];
  for (const town of p.informants) {
    const name = map.towns[town]!.name;
    if (p.gold < RUMORS.informant.dailyWage) {
      out.push(addNote(state, { town, text: `품삯을 못 받은 ${iGa(name)} 정보원이 일을 그만뒀어요.`, via: 'informant', from: '정보원', gossip: null, rumor: null, importance: 3, claim: null }));
      continue;
    }
    p.gold -= RUMORS.informant.dailyWage;
    p.ledger.push({ day: state.day, kind: 'info', what: 'informant', town, fee: RUMORS.informant.dailyWage });
    stay.push(town);
    rememberPrices(state, town);
    const m = state.towns[town]!.lastMarket;
    const short = GOODS.filter((g) => m[g].demand > m[g].supply).map((g) => `${GOOD_NAME[g]} ${m[g].demand - m[g].supply}`);
    const extra = GOODS.filter((g) => m[g].supply > m[g].demand).map((g) => `${GOOD_NAME[g]} ${m[g].supply - m[g].demand}`);
    const text = `${name} 장날: 모자란 것 ${short.join(', ') || '없음'} / 남는 것 ${extra.join(', ') || '없음'}`;
    out.push(addNote(state, { town, text, via: 'informant', from: '정보원', gossip: null, rumor: null, importance: 4, claim: null }));
  }
  p.informants = stay;
  return out;
}
