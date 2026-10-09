// 견습 마을 장날 손님: 견습 동안 플레이어 신청은 반드시 다 맞춰진다 (기획서: 첫 이익은 반드시 난다).
// 다른 신청과 함께 맞추면 더 싸게 부른 일꾼에게 밀릴 수 있어서, 장날에 따로 맞춘다.
// 플레이어가 팔면 시세보다 조금 비싸게 사 주고(마을 금고에서), 사면 시세보다 조금 싸게 판다(바깥에서 들여옴).
import { ECONOMY } from '../constants';
import type { Accounts } from '../economy/accounts';
import type { Fill } from '../economy/market';
import { ownedBy } from '../economy/players';
import type { EconomyState, PlayerState } from '../economy/state';

const A = ECONOMY.apprentice;

/** 장날에: 견습 마을에 낸 이 플레이어 신청을 모두 맞추고 신청 목록에서 뺀다. 맞춘 결과를 돌려준다 */
export function settleApprenticeOrders(state: EconomyState, p: PlayerState, accounts: Accounts): Fill[] {
  const ap = p.apprentice;
  if (!ap) return [];
  const town = state.towns[ap.town]!;
  const owner = { kind: 'player', pid: p.id } as const;
  const fills: Fill[] = [];
  const mine = (x: (typeof state.orders)[number]) => x.town === ap.town && ownedBy(x.owner, p.id);
  for (const o of state.orders.filter(mine)) {
    const ref = Math.round(town.refPrice[o.good]);
    if (o.side === 'sell') {
      const price = Math.max(o.limit, Math.round(ref * A.buyMarkup));
      const pay = o.qty * price;
      town.treasury -= Math.min(town.treasury, pay);
      accounts.addGold(owner, pay);
      o.lots = [];
      // 안 팔리면 돌아올 자리로 잡아 둔 칸을 푼다
      accounts.receive(owner, [], o.id);
      fills.push({ owner, good: o.good, side: 'sell', qty: o.qty, price });
    } else {
      const price = Math.max(1, Math.min(o.limit, Math.round(ref * A.sellMarkdown)));
      accounts.receive(owner, [{ good: o.good, qty: o.qty, age: 0, cost: price }], o.id);
      accounts.addGold(owner, o.reserved - o.qty * price);
      town.treasury += o.qty * price;
      o.reserved = 0;
      fills.push({ owner, good: o.good, side: 'buy', qty: o.qty, price });
    }
  }
  state.orders = state.orders.filter((x) => !mine(x));
  return fills;
}
