// 신청을 낸 쪽의 돈과 짐. 신청을 낼 때 맡기고, 정산 뒤에 받거나 돌려받는다.
import type { GoodId } from './goods';
import { ECONOMY } from '../constants';
import { seasonOfDay } from '../season';
import { addLot, takeSellable, type Inventory, type Lot } from './inventory';
import type { EconomyState, Order, OrderOwner, Trader, Worker } from './state';

export class Accounts {
  private readonly workers: Map<number, Worker>;
  private readonly traders: Map<number, Trader>;

  /** 오늘 계절의 상하는 배율. 내일이면 상할 물건은 장에 내지 못하게 거른다 */
  private readonly spoilRate: number;

  constructor(private readonly state: EconomyState) {
    this.spoilRate = ECONOMY.spoilRate[seasonOfDay(state.day, state.startSeason)];
    this.workers = new Map(state.workers.map((w) => [w.id, w]));
    this.traders = new Map(state.traders.map((t) => [t.id, t]));
  }

  gold(owner: OrderOwner): number {
    switch (owner.kind) {
      case 'player':
        return this.state.player.gold;
      case 'worker':
        return this.workers.get(owner.id)!.gold;
      case 'trader':
        return this.traders.get(owner.id)!.gold;
      case 'citizens':
        return this.state.towns[owner.town]!.treasury;
    }
  }

  addGold(owner: OrderOwner, amount: number): void {
    switch (owner.kind) {
      case 'player':
        this.state.player.gold += amount;
        break;
      case 'worker':
        this.workers.get(owner.id)!.gold += amount;
        break;
      case 'trader':
        this.traders.get(owner.id)!.gold += amount;
        break;
      case 'citizens':
        this.state.towns[owner.town]!.treasury += amount;
        break;
    }
  }

  /** 주민은 산 물건을 바로 쓴다 (짐이 없다) */
  inventory(owner: OrderOwner): Inventory | null {
    switch (owner.kind) {
      case 'player':
        return this.state.player.cargo;
      case 'worker':
        return this.workers.get(owner.id)!.inv;
      case 'trader':
        return this.traders.get(owner.id)!.inv;
      case 'citizens':
        return null;
    }
  }

  receive(owner: OrderOwner, lots: readonly Lot[]): void {
    const inv = this.inventory(owner);
    if (inv) for (const l of lots) addLot(inv, l);
  }

  /** 신청을 만들고 돈이나 물건을 맡긴다. 맡길 게 모자라면 null */
  place(
    owner: OrderOwner,
    town: number,
    good: GoodId,
    side: 'buy' | 'sell',
    qty: number,
    limit: number,
  ): Order | null {
    if (qty <= 0 || limit <= 0) return null;
    const order: Order = { id: this.state.nextId++, town, good, side, qty, limit, owner, reserved: 0, lots: [] };
    if (side === 'buy') {
      const cost = qty * limit;
      if (this.gold(owner) < cost) return null;
      this.addGold(owner, -cost);
      order.reserved = cost;
    } else {
      const inv = this.inventory(owner);
      if (!inv) return null;
      order.lots = takeSellable(inv, good, qty, this.spoilRate);
      order.qty = order.lots.reduce((s, l) => s + l.qty, 0);
      if (order.qty === 0) return null;
    }
    return order;
  }

  /** 정산하지 않고 맡긴 것을 그대로 돌려준다 */
  cancel(order: Order): void {
    if (order.side === 'buy') this.addGold(order.owner, order.reserved);
    else this.receive(order.owner, order.lots);
    order.reserved = 0;
    order.lots = [];
  }
}
