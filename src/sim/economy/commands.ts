// 플레이어 명령. 화면은 명령을 보내고 결과 상태를 그리기만 한다.
// 나중에 멀티플레이를 붙이면 이 명령을 서버로 보낸다.
import { ECONOMY } from '../constants';
import { seasonOfDay } from '../season';
import { townTravelDays, type WorldMap } from '../worldgen';
import { Accounts } from './accounts';
import { GOODS, type GoodId } from './goods';
import { count, totalCount } from './inventory';
import type { EconomyState } from './state';

export type Command =
  | { type: 'placeBuyOrder'; good: GoodId; qty: number; maxPrice: number }
  | { type: 'placeSellOrder'; good: GoodId; qty: number; minPrice: number }
  | { type: 'cancelOrder'; orderId: number }
  | { type: 'travel'; to: number };

export type CommandError =
  | 'traveling'
  | 'badGood'
  | 'badQty'
  | 'badPrice'
  | 'notEnoughGold'
  | 'notEnoughGoods'
  | 'noRoom'
  | 'noOrder'
  | 'sameTown'
  | 'noTown'
  | 'noRoute';

export type CommandResult = { ok: true; orderId?: number } | { ok: false; error: CommandError };

const fail = (error: CommandError): CommandResult => ({ ok: false, error });

export function applyCommand(state: EconomyState, map: WorldMap, cmd: Command): CommandResult {
  const p = state.player;
  const accounts = new Accounts(state);
  const owner = { kind: 'player' } as const;

  switch (cmd.type) {
    case 'placeBuyOrder': {
      if (p.travel) return fail('traveling');
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      if (!isCount(cmd.qty)) return fail('badQty');
      if (!isCount(cmd.maxPrice)) return fail('badPrice');
      // 짐칸: 지금 짐 + 이미 낸 사자 신청이 다 채워져도 넘치지 않아야 한다
      const pendingBuys = state.orders.filter((o) => o.side === 'buy').reduce((s, o) => s + o.qty, 0);
      if (totalCount(p.cargo) + pendingBuys + cmd.qty > p.capacity) return fail('noRoom');
      if (p.gold < cmd.qty * cmd.maxPrice) return fail('notEnoughGold');
      const o = accounts.place(owner, p.town, cmd.good, 'buy', cmd.qty, cmd.maxPrice)!;
      state.orders.push(o);
      return { ok: true, orderId: o.id };
    }
    case 'placeSellOrder': {
      if (p.travel) return fail('traveling');
      if (!GOODS.includes(cmd.good)) return fail('badGood');
      if (!isCount(cmd.qty)) return fail('badQty');
      if (!isCount(cmd.minPrice)) return fail('badPrice');
      if (count(p.cargo, cmd.good) < cmd.qty) return fail('notEnoughGoods');
      const o = accounts.place(owner, p.town, cmd.good, 'sell', cmd.qty, cmd.minPrice)!;
      state.orders.push(o);
      return { ok: true, orderId: o.id };
    }
    case 'cancelOrder': {
      const i = state.orders.findIndex((o) => o.id === cmd.orderId);
      if (i < 0) return fail('noOrder');
      accounts.cancel(state.orders[i]!);
      state.orders.splice(i, 1);
      return { ok: true };
    }
    case 'travel': {
      if (p.travel) return fail('traveling');
      if (!state.towns[cmd.to]) return fail('noTown');
      if (cmd.to === p.town) return fail('sameTown');
      const days = townTravelDays(map, seasonOfDay(state.day, state.startSeason))[p.town]![cmd.to]!;
      if (!Number.isFinite(days)) return fail('noRoute');
      const fee = days * ECONOMY.player.travelFeePerDay;
      if (p.gold < fee) return fail('notEnoughGold');
      // 떠나면 이 마을에 낸 신청은 거둔다
      for (const o of state.orders) accounts.cancel(o);
      state.orders = [];
      p.gold -= fee;
      state.towns[p.town]!.treasury += fee;
      p.ledger.push({ day: state.day, kind: 'travel', from: p.town, to: cmd.to, days, fee });
      p.travel = { from: p.town, to: cmd.to, days, daysLeft: days };
      return { ok: true };
    }
  }
}

function isCount(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}
