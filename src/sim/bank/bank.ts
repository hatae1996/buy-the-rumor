// 은행 (기획서 "은행", 0.0.5): 은행은 도시에만 있고 계좌는 하나다(어느 도시에서나 같다, 초안).
// 이번 버전은 자리와 데이터 구조만: 예금·대출의 실제 동작(맡기기, 빌리기, 이자 붙이기)은 나중 버전 (questions.md 61번).
// 순자산의 "예금 − 빚" 칸이 이 계좌를 본다.
import { GROWTH } from '../constants';
import { CYCLE_DAYS } from '../season';

export interface BankAccount {
  /** 맡긴 돈 */
  deposit: number;
  /** 빌린 돈 (갚을 원금과 붙은 이자) */
  loan: number;
  /**
   * 신용: 대출 한도를 정한다 (기획서 "대출 한도는 신용도로 막는다").
   * 제때 갚으면 오르고, 못 갚으면 떨어진다. 0~1
   */
  credit: number;
}

export function emptyAccount(): BankAccount {
  return { deposit: 0, loan: 0, credit: 0.5 };
}

/** 이자율은 시즌 한 바퀴 기준. 하루치로 나눈다 */
const SEASON_DAYS = CYCLE_DAYS;

/** days일 동안 붙는 이자 (예금은 받고, 대출은 낸다). 단리 초안 */
export function interestFor(account: BankAccount, days: number): { deposit: number; loan: number } {
  return {
    deposit: Math.floor((account.deposit * GROWTH.bank.depositRate * days) / SEASON_DAYS),
    loan: Math.ceil((account.loan * GROWTH.bank.loanRate * days) / SEASON_DAYS),
  };
}

/** 대출 한도 초안: 순자산 × 신용. 처음부터 큰돈을 빌려 시장을 독점하지 못하게 */
export function loanLimit(account: BankAccount, netWorth: number): number {
  return Math.max(0, Math.floor(netWorth * account.credit) - account.loan);
}
