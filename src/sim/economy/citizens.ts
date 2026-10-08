// 마을 주민 (일꾼이 아닌 사람들). 마을 금고로 물건을 사서 쓴다.
// 금고에는 날마다 바깥 경제에서 돈이 들어오고(돈이 생기는 곳), 너무 쌓이면 영주에게 바친다(돈이 빠지는 곳).
import { ECONOMY } from '../constants';
import { stochasticRound, type Rng } from '../rng';
import { AUTUMN, WINTER, type Season } from '../season';
import type { Accounts } from './accounts';
import { basePrice, FOODS, GOODS, type GoodId } from './goods';
import type { Order, TownEconomy } from './state';

const C = ECONOMY.citizens;

export function citizenDemand(town: TownEconomy, good: GoodId, season: Season): number {
  let d: number = C.demand[good];
  if (town.tier === 'city') d *= ECONOMY.city.demandFactor;
  if (season === WINTER) {
    if (good === 'wood') d *= C.winterWoodFactor;
    if (good === 'leather') d *= C.winterLeatherFactor;
    if (FOODS.includes(good)) d *= C.winterFoodFactor;
  }
  if (season === AUTUMN && good === 'grain') d *= C.autumnGrainFactor;
  for (const b of town.boosts) if (b.good === good) d *= b.factor;
  return d;
}

export function citizenOrders(town: TownEconomy, season: Season, accounts: Accounts, rng: Rng): Order[] {
  const owner = { kind: 'citizens', town: town.id } as const;
  const out: Order[] = [];
  for (const good of GOODS) {
    const daily = citizenDemand(town, good, season);
    const premium = town.tier === 'city' && (ECONOMY.city.premiumGoods as readonly GoodId[]).includes(good);
    for (const step of C.priceSteps) {
      const limit = Math.max(1, Math.round(basePrice(good) * step.factor * (premium ? ECONOMY.city.premiumFactor : 1)));
      const qty = Math.min(stochasticRound(daily * step.share, rng), Math.floor(town.treasury / limit));
      const o = accounts.place(owner, town.id, good, 'buy', qty, limit);
      if (o) out.push(o);
    }
  }
  return out;
}

/** 장날 뒤: 금고에 돈이 들어오고, 넘치면 바친다. 바친 돈을 돌려준다 */
/** 하루 금고에 들어오는 돈 (도시는 더 많다) */
export function stipendOf(town: TownEconomy): number {
  return C.stipend * (town.tier === 'city' ? ECONOMY.city.treasuryFactor : 1);
}

export function treasuryDay(town: TownEconomy): number {
  town.treasury += stipendOf(town);
  const cap = C.treasuryCap * (town.tier === 'city' ? ECONOMY.city.treasuryFactor : 1);
  let tribute = 0;
  if (town.treasury > cap) {
    tribute = Math.floor((town.treasury - cap) * C.tributeRate);
    town.treasury -= tribute;
  }
  for (const b of town.boosts) b.daysLeft--;
  town.boosts = town.boosts.filter((b) => b.daysLeft > 0);
  if (town.storm > 0) town.storm--;
  return tribute;
}
