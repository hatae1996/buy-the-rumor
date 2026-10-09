import { describe, expect, it } from 'vitest';
import { arrivalText, clockAtText, durationText } from './format';

// 지역 시각 기준 (테스트 기기의 시간대와 상관없이 같게 나오도록 지역 시각으로 만든다)
const at = (month: number, day: number, h: number, m: number) => new Date(2026, month - 1, day, h, m).getTime();

describe('도착 시각 문구', () => {
  const now = at(10, 10, 14, 0);

  it('오늘, 내일, 모레, 그 뒤는 날짜로', () => {
    expect(clockAtText(at(10, 10, 19, 40), now)).toBe('오늘 오후 7:40');
    expect(clockAtText(at(10, 11, 9, 10), now)).toBe('내일 오전 9:10');
    expect(clockAtText(at(10, 12, 0, 0), now)).toBe('모레 오전 12:00');
    expect(clockAtText(at(10, 13, 12, 30), now)).toBe('10월 13일 오후 12:30');
  });

  it('10분 단위로 올린다', () => {
    expect(clockAtText(at(10, 10, 15, 1), now)).toBe('오늘 오후 3:10');
    expect(clockAtText(at(10, 10, 23, 55), now)).toBe('내일 오전 12:00');
  });

  it('남은 시간이 하루를 넘으면 일과 시간으로', () => {
    expect(durationText(26 * 3600_000)).toBe('1일 2시간');
    expect(durationText(48 * 3600_000)).toBe('2일');
    expect(durationText(90 * 60_000)).toBe('1시간 30분');
  });

  it('시간이 흐르지 않으면 게임 속 날로', () => {
    expect(arrivalText(null, 3, now)).toBe('<b>3일</b> 뒤 도착');
    expect(arrivalText(3 * 3600_000, 2, now)).toBe('<b>오늘 오후 5:00</b>쯤 도착 (3시간 남음)');
  });
});
