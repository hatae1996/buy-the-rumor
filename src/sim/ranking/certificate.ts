// 상인 증서 (기획서 "상인 증서 (ID카드)", 시안 prototypes/id-card.html).
// 모든 보상은 증서에 모인다. 다른 사람이 볼 수 있으므로 순자산 숫자는 담지 않는다 (정보 게임이므로).
import { badgeDef } from './badges';
import type { Certificate, EarnedBadge } from './types';

/** 앞면에 달고 다니는 인장 수 */
export const MAX_PINNED = 4;

/** 상단 문장(깃발). 고르기만 한다 (그림은 나중) */
export const CRESTS = {
  plain: '무늬 없음',
  crow: '까마귀',
  fox: '여우',
  fish: '물고기',
  oak: '떡갈나무',
  sail: '돛',
  anvil: '모루',
  wheat: '보리',
  deer: '사슴',
  anchor: '닻',
  owl: '부엉이',
  salt: '소금 결정',
} as const;
export type CrestId = keyof typeof CRESTS;
export const CREST_IDS = Object.keys(CRESTS) as CrestId[];

/** 상단 이름 길이 (글자). 금칙어 걸러 내기는 서버 버전에서 (handoff 0.1.0) */
export const COMPANY_NAME_LENGTH = [2, 12] as const;

export type CertificateError = 'badName' | 'badCrest' | 'noTitle';

/** 상단 이름과 문장을 고른다. 앞뒤 빈칸은 지우고, 줄바꿈과 꺾쇠는 받지 않는다 */
export function setCompany(c: Certificate, name: string, crest: string): CertificateError | null {
  const n = name.trim().replace(/\s+/g, ' ');
  if ([...n].length < COMPANY_NAME_LENGTH[0] || [...n].length > COMPANY_NAME_LENGTH[1] || /[<>&"]/.test(n)) return 'badName';
  if (!(crest in CRESTS)) return 'badCrest';
  c.name = n;
  c.crest = crest;
  return null;
}

/** 대표 칭호를 고른다 (얻은 칭호 중에서, 없애려면 null) */
export function setTitle(c: Certificate, title: string | null): CertificateError | null {
  if (title !== null && !c.titles.includes(title)) return 'noTitle';
  c.title = title;
  return null;
}

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
