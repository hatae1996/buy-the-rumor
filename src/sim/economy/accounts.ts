// 신청을 낸 쪽의 돈과 짐. 신청을 낼 때 맡기고, 정산 뒤에 받거나 돌려받는다.
import type { GoodId } from './goods';
import { ECONOMY } from '../constants';
import { seasonOfDay } from '../season';
import { loadGoods, reserveRoom, settleIncoming, takeGoods } from '../cart';
import { shelfLife } from './goods';
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
        // 플레이어 짐은 수레다. 넣고 빼기는 receive와 place가 따로 다룬다
        return null;
      case 'worker':
        return this.workers.get(owner.id)!.inv;
      case 'trader':
        return this.traders.get(owner.id)!.inv;
      case 'citizens':
        return null;
    }
  }

  /** 정산 뒤 물건을 넘긴다. 플레이어는 그 신청으로 잡아 둔 수레 자리에 넣고 자리를 푼다 */
  receive(owner: OrderOwner, lots: readonly Lot[], orderId?: number): void {
    if (owner.kind === 'player') {
      if (orderId !== undefined) settleIncoming(this.state.player.cart, orderId, lots);
      else for (const l of lots) loadGoods(this.state.player.cart, l.good, l.qty, l.age);
      return;
    }
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
      // 플레이어는 살 물건이 들어갈 수레 자리를 미리 잡는다. 자리가 없으면 신청할 수 없다
      if (owner.kind === 'player' && !reserveRoom(this.state.player.cart, good, qty, order.id)) return null;
      this.addGold(owner, -cost);
      order.reserved = cost;
    } else {
      if (owner.kind === 'player') {
        // 수레에서 꺼내되, 안 팔리면 돌아올 자리는 남겨 둔다
        const life = shelfLife(good);
        const sellable = (l: Lot) => life === null || l.age + this.spoilRate < life;
        order.lots = takeGoods(this.state.player.cart, good, qty, sellable, order.id);
      } else {
        const inv = this.inventory(owner);
        if (!inv) return null;
        order.lots = takeSellable(inv, good, qty, this.spoilRate);
      }
      order.qty = order.lots.reduce((s, l) => s + l.qty, 0);
      if (order.qty === 0) return null;
    }
    return order;
  }

  /** 정산하지 않고 맡긴 것을 그대로 돌려준다 */
  cancel(order: Order): void {
    if (order.side === 'buy') {
      this.addGold(order.owner, order.reserved);
      if (order.owner.kind === 'player') settleIncoming(this.state.player.cart, order.id, []);
    } else this.receive(order.owner, order.lots, order.id);
    order.reserved = 0;
    order.lots = [];
  }
}
