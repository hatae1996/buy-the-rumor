// 상인 증서 (기획서 "상인 증서 (ID카드)", 시안 prototypes/id-card.html).
// 모든 보상은 증서에 모인다. 다른 사람이 볼 수 있으므로 순자산 숫자는 담지 않는다 (정보 게임이므로).
import { badgeDef } from './badges';
import type { Certificate, EarnedBadge } from './types';

/** 앞면에 달고 다니는 인장 수 */
export const MAX_PINNED = 4;

export function createCertificate(): Certificate {
  return {
    name: '이름 없는 상단',
    crest: 'plain',
    origin: null,
    seasonsCompleted: 0,
    title: null,
    titles: [],
    badges: [],
    pinned: [],
    bestBigShotRank: null,
  };
}

/** 상인 연차에 따라 증서 종이가 바뀐다 (낡은 종이 → 양피지 → 금테). 문턱은 초안 */
export function paperGrade(seasonsCompleted: number): 'worn' | 'parchment' | 'gilded' {
  if (seasonsCompleted >= 10) return 'gilded';
  if (seasonsCompleted >= 3) return 'parchment';
  return 'worn';
}

/** 앞면에 달 인장을 고른다 (인장첩 줄 번호). 많아야 4개, 없는 줄은 뺀다 */
export function pinBadges(c: Certificate, rows: readonly number[]): void {
  c.pinned = [...new Set(rows)].filter((i) => i >= 0 && i < c.badges.length).slice(0, MAX_PINNED);
}

export interface CertificateView {
  name: string;
  crest: string;
  origin: string | null;
  seasonsCompleted: number;
  paper: ReturnType<typeof paperGrade>;
  title: string | null;
  pinned: (EarnedBadge & { name: string })[];
  /** 인장첩: 모은 인장 수 */
  badgeCount: number;
  bestBigShotRank: number | null;
}

/** 남에게 보여 주는 증서 (순자산은 없다) */
export function certificateView(c: Certificate): CertificateView {
  return {
    name: c.name,
    crest: c.crest,
    origin: c.origin,
    seasonsCompleted: c.seasonsCompleted,
    paper: paperGrade(c.seasonsCompleted),
    title: c.title,
    pinned: c.pinned.map((i) => c.badges[i]!).map((b) => ({ ...b, name: badgeDef(b.badge)?.name ?? b.badge })),
    badgeCount: c.badges.length,
    bestBigShotRank: c.bestBigShotRank,
  };
}
