// 은행 (기획서 "은행", 0.0.5): 도시에만, 계좌 하나. 이번 버전은 구조만.
import { describe, expect, it } from 'vitest';
import { GROWTH } from '../constants';
import { CYCLE_DAYS } from '../season';
import { createEconomy } from '../economy';
import { townBuildings } from '../growth/buildings';
import { netWorth } from '../ranking';
import { generateWorld } from '../worldgen';
import { emptyAccount, interestFor, loanLimit } from './bank';

describe('은행', () => {
  it('은행은 도시에만 있다', () => {
    const map = generateWorld(3);
    const s = createEconomy(map, 3);
    for (const t of map.towns) expect(townBuildings(s, map, t.id).includes('bank')).toBe(t.tier === 'city');
  });

  it('순자산의 예금 − 빚은 계좌를 본다', () => {
    const map = generateWorld(3);
    const s = createEconomy(map, 3);
    const base = netWorth(s);
    s.player.bank.deposit = 100;
    s.player.bank.loan = 30;
    expect(netWorth(s)).toBe(base + 70);
  });

  it('이자는 시즌 한 바퀴 기준 비율을 날로 나눈 단리, 대출 한도는 순자산 × 신용', () => {
    const a = { ...emptyAccount(), deposit: 1440, loan: 1440 };
    expect(interestFor(a, CYCLE_DAYS)).toEqual({ deposit: Math.floor(1440 * GROWTH.bank.depositRate), loan: Math.ceil(1440 * GROWTH.bank.loanRate) });
    expect(loanLimit({ deposit: 0, loan: 100, credit: 0.5 }, 1000)).toBe(400);
    expect(loanLimit({ deposit: 0, loan: 600, credit: 0.5 }, 1000)).toBe(0);
  });
});
