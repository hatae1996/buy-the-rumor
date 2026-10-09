// 짐칸 정보와 손상 (0.1.2): 산 값, 길 위 사건으로 망가지는 칸, 수레방 수리.
import { describe, expect, it } from 'vitest';
import { cartCount, createCart, fits, loadGoods } from '../cart';
import { CART_DAMAGE } from '../constants';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { hasBuilding } from '../growth/buildings';
import { applyCommand } from './commands';
import { createEconomy } from './create';
import { advanceDay } from './day';
import { breakCell, rollIncident, roadRisk } from './incidents';
import { moneySupply } from './stats';
import type { EconomyState, Travel } from './state';
import { playerView } from './view';

const SEED = 20261008;
const map = generateWorld(SEED);

function world(): EconomyState {
  const s = createEconomy(map, SEED);
  s.players.me!.town = map.towns.find((t) => hasBuilding(s, map, t.id, 'cartShop'))!.id;
  s.players.me!.cart = createCart('handcart');
  return s;
}

describe('산 값 (짐칸 정보판)', () => {
  it('장날에 산 물건에는 그날 값이, 원정으로 얻은 물건에는 0이 붙는다', () => {
    const s = world();
    const me = s.players.me!;
    me.gold = 1000;
    expect(applyCommand(s, map, 'me', { type: 'placeBuyOrder', good: 'salt', qty: 3, maxPrice: 200 }).ok).toBe(true);
    advanceDay(s, map);
    const buy = me.ledger.find((e) => e.kind === 'buy');
    const v = playerView(s, map, 'me');
    if (buy && buy.kind === 'buy') {
      const salt = v.cart.pieces.find((p) => p.good === 'salt')!;
      expect(salt.cost).toBe(buy.price);
    }
    // 원정·채집으로 얻은 것은 0
    loadGoods(me.cart, 'wood', 2, 0, 0);
    expect(playerView(s, map, 'me').cart.pieces.find((p) => p.good === 'wood')!.cost).toBe(0);
  });
});

describe('길 위 사건으로 짐칸이 망가진다', () => {
  it('망가진 칸에는 놓을 수 없고, 그 칸에 걸친 짐 조각 하나만 잃는다', () => {
    const cart = createCart('handcart');
    loadGoods(cart, 'salt', 30);
    const before = cart.pieces.length;
    const hit = breakCell(cart, createRng(7))!;
    expect(cart.broken).toEqual([hit.cell]);
    const [x, y] = hit.cell.split(',').map(Number) as [number, number];
    expect(fits(cart, 'ore', x, y, 0)).toBe(false);
    if (hit.lost) {
      expect(hit.lost.good).toBe('salt');
      expect(cart.pieces).toHaveLength(before - 1);
      expect(cartCount(cart, 'salt')).toBe(30 - hit.lost.qty);
    }
    // 같은 시드면 같은 칸
    const again = createCart('handcart');
    loadGoods(again, 'salt', 30);
    expect(breakCell(again, createRng(7))!.cell).toBe(hit.cell);
  });

  it('등짐은 망가지지 않고, 위험이 없는 길에서는 아무 일도 없다', () => {
    const travel: Travel = { from: 0, to: 1, days: 2, daysLeft: 2, risk: { rough: 1, rockfall: 1, banditsFrom: true, banditsTo: true } };
    expect(rollIncident(travel, createCart('pack'), createRng(1))).toBeNull();
    const safe: Travel = { ...travel, risk: { rough: 0, rockfall: 0, banditsFrom: false, banditsTo: false } };
    expect(rollIncident(safe, createCart('handcart'), createRng(1))).toBeNull();
    expect(rollIncident(travel, createCart('handcart'), createRng(1))).not.toBeNull();
  });

  it('산적은 떠나는 날과 도착하는 날에만, 험한 길은 언덕·산 칸 몫만큼', () => {
    const s = world();
    const r = roadRisk(s, map, 0, 1);
    expect(r.rough).toBeGreaterThanOrEqual(0);
    expect(r.rough).toBeLessThanOrEqual(CART_DAMAGE.rough);
    const mid: Travel = { from: 0, to: 1, days: 3, daysLeft: 2, risk: { rough: 0, rockfall: 0, banditsFrom: true, banditsTo: true } };
    for (let i = 0; i < 50; i++) expect(rollIncident(mid, createCart('handcart'), createRng(i))).toBeNull();
  });

  it('길을 떠나면 위험을 재 두고, 밤마다 굴려 장부에 적는다', () => {
    const s = world();
    const me = s.players.me!;
    const to = map.towns.find((t) => t.id !== me.town)!.id;
    expect(applyCommand(s, map, 'me', { type: 'travel', to }).ok).toBe(true);
    expect(me.travel!.risk).toBeDefined();
    me.travel!.risk = { rough: 1, rockfall: 0, banditsFrom: false, banditsTo: false };
    advanceDay(s, map);
    expect(me.cart.broken).toHaveLength(1);
    expect(me.ledger.at(-1)?.kind === 'cartDamage' || me.ledger.some((e) => e.kind === 'cartDamage')).toBe(true);
  });

  it('수레방에서 칸마다 돈을 내고 고친다. 돈은 마을 금고로 (새지 않는다)', () => {
    const s = world();
    const me = s.players.me!;
    me.cart.broken = ['1,1', '2,1'];
    expect(playerView(s, map, 'me').cart.repairCost).toBe(2 * CART_DAMAGE.repairPerCell.handcart);
    me.gold = CART_DAMAGE.repairPerCell.handcart; // 한 칸 값만 있다
    const money = moneySupply(s);
    const treasury = s.towns[me.town]!.treasury;
    expect(applyCommand(s, map, 'me', { type: 'repairCart' }).ok).toBe(true);
    expect(s.towns[me.town]!.treasury - treasury).toBe(CART_DAMAGE.repairPerCell.handcart);
    expect(moneySupply(s)).toBe(money);
    expect(me.cart.broken).toHaveLength(1);
    expect(me.gold).toBe(0);
    me.gold = 100;
    expect(applyCommand(s, map, 'me', { type: 'repairCart' }).ok).toBe(true);
    expect(me.cart.broken).toHaveLength(0);
    expect(applyCommand(s, map, 'me', { type: 'repairCart' })).toEqual({ ok: false, error: 'cartFine' });
  });

  it('새 수레로 바꾸면 망가진 칸은 따라오지 않는다', () => {
    const s = world();
    const me = s.players.me!;
    me.gold = 1000;
    me.cart.broken = ['0,1'];
    me.horses = [];
    expect(applyCommand(s, map, 'me', { type: 'buyCart', cart: 'pack' }).ok).toBe(true);
    expect(me.cart.type).toBe('pack');
    expect(me.cart.broken ?? []).toEqual([]);
  });
});
