// 하루가 끝나면 "알림을 보낼 사건"을 만든다. 그날 장부와 상태를 보고 사실만 적는다.
// 플레이어가 알 수 있는 것만 쓴다 (내 거래, 내 행렬, 내 짐, 신문).
import { cartLots, itemName, type Board } from '../cart';
import { INCIDENT_NAME } from '../economy/incidents';
import { ECONOMY, GROWTH, HORSES } from '../constants';
import { GOOD_NAME, shelfLife, type GoodId } from '../economy/goods';
import type { EconomyState, PlayerState } from '../economy/state';
import { porterBoards } from '../hire/boards';
import { wageToday } from '../hire/wage';
import { eulReul, euro, iGa } from '../josa';
import { seasonOfDay } from '../season';
import type { WorldMap } from '../worldgen';
import type { NotifyEvent } from './types';

/** 장날(day) 뒤, 날이 바뀌기 전에 부른다. arrived: 오늘 밤 내가 도착한 마을 (없으면 null) */
export function dayNotices(state: EconomyState, p: PlayerState, map: WorldMap, day: number, news: readonly string[], arrived: number | null): NotifyEvent[] {
  const name = (t: number) => map.towns[t]!.name;
  const out: NotifyEvent[] = [];
  const today = p.ledger.filter((e) => e.day === day);

  // 장날 결과: 마을마다 "소금 20개 팔림, +312"
  const byTown = new Map<number, { parts: string[]; net: number }>();
  for (const e of today) {
    if (e.kind !== 'buy' && e.kind !== 'sell') continue;
    // 예약 주문 체결은 따로 알린다 (내 거래와 체결 값만, 그 마을 시세는 알리지 않는다)
    if (e.reserved) {
      out.push({ kind: 'reservation', day, text: `예약 주문: ${name(e.town)}에서 ${GOOD_NAME[e.good]} ${e.qty}개 ${e.kind === 'sell' ? '팔림' : '삼'} (개당 ${e.price})`, target: { tab: 'ledger', section: 'orders' } });
      continue;
    }
    const t = byTown.get(e.town) ?? { parts: [], net: 0 };
    t.parts.push(`${GOOD_NAME[e.good]} ${e.qty}개 ${e.kind === 'sell' ? '팔림' : '삼'}`);
    t.net += (e.kind === 'sell' ? 1 : -1) * e.qty * e.price;
    byTown.set(e.town, t);
  }
  for (const [town, t] of byTown) {
    out.push({ kind: 'market', day, text: `${name(town)} 장날: ${t.parts.join(', ')}, ${t.net >= 0 ? '+' : ''}${t.net}`, target: { tab: 'news', section: 'reports' } });
  }

  // 도착: 내 행렬, 두 번째 행렬
  if (arrived !== null) out.push({ kind: 'arrival', day, text: `${name(arrived)}에 도착했어요.`, target: { tab: 'town' } });
  for (const e of today) {
    // 길 위 사건으로 짐칸이 망가졌다 (0.1.2)
    if (e.kind === 'cartDamage') {
      const lost = e.lost ? ` ${itemName(e.lost.good)} ${e.lost.qty}개를 잃었어요.` : '';
      out.push({ kind: 'arrival', day, text: `${e.caravan ? '두 번째 행렬이 ' : ''}길에서 ${INCIDENT_NAME[e.cause]}을 만나 짐칸 한 칸이 망가졌어요.${lost}`, target: { tab: 'cart' } });
    }
    if (e.kind === 'caravan' && e.what === 'arrive') out.push({ kind: 'arrival', day, text: `두 번째 행렬이 ${name(e.town)}에 도착했어요.`, target: { tab: 'map' } });
  }

  // 곧 상할 짐: 내일이면 상하는 음식 (수레, 짐꾼, 행렬, 창고)
  const rate = ECONOMY.spoilRate[seasonOfDay(day + 1, state.startSeason)];
  const soon = (board: Board) => {
    const n: Partial<Record<GoodId, number>> = {};
    for (const l of cartLots(board)) {
      const life = shelfLife(l.good);
      if (life !== null && l.age + rate >= life) n[l.good] = (n[l.good] ?? 0) + l.qty;
    }
    return Object.entries(n).map(([g, q]) => `${GOOD_NAME[g as GoodId]} ${q}개`);
  };
  const carried = [p.cart, ...porterBoards(p), ...(p.caravan ? [p.caravan.cart] : [])].flatMap(soon);
  if (carried.length) out.push({ kind: 'spoiling', day, text: `내일 상할 짐: ${carried.join(', ')}`, target: { tab: 'cart' } });
  for (const w of p.warehouses) {
    const s = soon(w.board);
    if (s.length) out.push({ kind: 'spoiling', day, text: `${name(w.town)} 창고에서 내일 상할 것: ${s.join(', ')}`, target: { tab: 'cart' } });
  }

  // 사람과 말: 내일 일당을 다 못 주면 누군가 떠난다, 말이 굶었다
  const wages = p.hires.reduce((s, h) => s + wageToday(state, p, h), 0);
  if (wages > 0 && p.gold < wages) out.push({ kind: 'people', day, text: `내일 일당 ${wages}에 돈이 모자라요 (가진 돈 ${p.gold}). 못 받은 일꾼은 떠나요.`, target: { tab: 'ledger', section: 'people' } });
  for (const e of today) {
    if (e.kind === 'hire' && e.what === 'quit') out.push({ kind: 'people', day, text: `${iGa(e.name ?? '일꾼')} 일당을 못 받아 ${euro(name(e.town))} 돌아갔어요.`, target: { tab: 'ledger', section: 'people' } });
    if (e.kind === 'horse' && e.what === 'lost') out.push({ kind: 'people', day, text: `굶은 말이 ${name(e.town)} 마구간으로 돌아갔어요.`, target: { tab: 'ledger', section: 'people' } });
    // 말·일꾼 추첨 결과 (0.1.0): 뽑히면 산 줄이, 떨어지면 추첨 줄이 장부에 있다
    if (e.kind === 'horse' && e.what === 'buy') out.push({ kind: 'people', day, text: `${name(e.town)} 마구간 추첨에 뽑혀 ${eulReul(HORSES.kinds[e.horse].name)} 샀어요.`, target: { tab: 'town' }, draw: true });
    if (e.kind === 'hire' && e.what === 'hire' && e.role) out.push({ kind: 'people', day, text: `${name(e.town)} 여관 추첨에 뽑혀 ${eulReul(`${GROWTH.hire[e.role].name} ${e.name ?? ''}`.trim())} 고용했어요.`, target: { tab: 'town' }, draw: true });
    if (e.kind === 'draw') out.push({ kind: 'people', day, text: `${name(e.town)} ${e.what === 'horse' ? '마구간' : '여관'} 추첨에서 뽑히지 않았어요. 맡긴 돈은 돌려받았어요.`, target: { tab: 'ledger', section: 'people' }, draw: true });
  }
  const hungry = [...p.horses, ...(p.caravan?.horses ?? [])].filter((h) => h.hungry > 0).length;
  if (hungry) out.push({ kind: 'people', day, text: `말 ${hungry}필이 굶었어요. 먹이를 챙겨 주세요.`, target: { tab: 'ledger', section: 'people' } });

  // 시즌 마지막 날
  const season = state.season;
  if (season && day + 1 === season.startDay + season.length - 1) out.push({ kind: 'season', day, text: '내일이 이번 시즌 마지막 장날이에요.', target: { tab: 'news', section: 'guild' } });

  // 원정 기회가 가득
  if (!p.travel && p.expeditionChances >= ECONOMY.expedition.maxChances) out.push({ kind: 'chances', day, text: `${name(p.town)} 원정 기회가 가득 찼어요.`, target: { tab: 'town', building: 'outside' } });

  // 새 신문
  if (news.length) out.push({ kind: 'newspaper', day, text: `신문: ${news[0]}`, target: { tab: 'news', section: 'paper' } });
  return out;
}
