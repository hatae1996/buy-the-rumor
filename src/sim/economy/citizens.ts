// 마을 주민 (일꾼이 아닌 사람들). 마을 금고로 물건을 사서 쓴다.
// 금고에는 날마다 바깥 경제에서 돈이 들어오고(돈이 생기는 곳), 너무 쌓이면 영주에게 바친다(돈이 빠지는 곳).
import { ECONOMY } from '../constants';
import { stochasticRound, type Rng } from '../rng';
import { WINTER, type Season } from '../season';
import type { Accounts } from './accounts';
import { basePrice, GOODS, type GoodId } from './goods';
import type { Order, TownEconomy } from './state';

const C = ECONOMY.citizens;

export function citizenDemand(town: TownEconomy, good: GoodId, season: Season): number {
  let d: number = C.demand[good];
  if (good === 'wood' && season === WINTER) d *= C.winterWoodFactor;
  for (const b of town.boosts) if (b.good === good) d *= b.factor;
  return d;
}

export function citizenOrders(town: TownEconomy, season: Season, accounts: Accounts, rng: Rng): Order[] {
  const owner = { kind: 'citizens', town: town.id } as const;
  const out: Order[] = [];
  for (const good of GOODS) {
    const daily = citizenDemand(town, good, season);
    for (const step of C.priceSteps) {
      const limit = Math.max(1, Math.round(basePrice(good) * step.factor));
      const qty = Math.min(stochasticRound(daily * step.share, rng), Math.floor(town.treasury / limit));
      const o = accounts.place(owner, town.id, good, 'buy', qty, limit);
      if (o) out.push(o);
    }
  }
  return out;
}

/** 장날 뒤: 금고에 돈이 들어오고, 넘치면 바친다. 바친 돈을 돌려준다 */
export function treasuryDay(town: TownEconomy): number {
  town.treasury += C.stipend;
  let tribute = 0;
  if (town.treasury > C.treasuryCap) {
    tribute = Math.floor((town.treasury - C.treasuryCap) * C.tributeRate);
    town.treasury -= tribute;
  }
  for (const b of town.boosts) b.daysLeft--;
  town.boosts = town.boosts.filter((b) => b.daysLeft > 0);
  if (town.storm > 0) town.storm--;
  return tribute;
}
