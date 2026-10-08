// 순위 매기기 (기획서: 순위는 장날마다 갱신, 1~3위와 내 순위(상위 몇 %)를 보여 준다).
// 서버가 모든 플레이어 점수를 모아 부를 자리. 지금은 계산만 둔다.

export interface StandingEntry {
  id: string;
  /** 기록이 없으면 null (수완가 부문을 아직 충분히 하지 않음 등) */
  score: number | null;
}

export interface Standing {
  id: string;
  score: number;
  /** 같은 점수는 같은 순위 (1, 2, 2, 4) */
  rank: number;
  /** 상위 몇 % (0~1). 1위면 1/명수 */
  topShare: number;
}

export function standings(entries: readonly StandingEntry[]): Standing[] {
  const scored = entries.filter((e): e is { id: string; score: number } => e.score !== null).sort((a, b) => b.score - a.score);
  const n = scored.length;
  const out: Standing[] = [];
  scored.forEach((e, i) => {
    const prev = out[i - 1];
    const rank = prev && prev.score === e.score ? prev.rank : i + 1;
    out.push({ id: e.id, score: e.score, rank, topShare: rank / n });
  });
  return out;
}
