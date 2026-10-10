// 상인 증서 (기획서 "상인 증서 (ID카드)", 시안 prototypes/id-card.html).
// 모든 보상은 증서에 모인다. 다른 사람이 볼 수 있으므로 순자산 숫자는 담지 않는다 (정보 게임이므로).
import { cleanFace, rollPlayerFace } from '../looks/player';
import type { Look } from '../looks/types';
import { createRng, mixSeed } from '../rng';
import { badgeDef } from './badges';
import { emblemFromCrest, isEmblem, rollEmblem, type Emblem } from './emblem';
import type { Certificate, EarnedBadge } from './types';

/** 앞면에 달고 다니는 인장 수 */
export const MAX_PINNED = 4;

/** 상단 이름 길이 (글자). 금칙어와 같은 시즌 중복은 서버 버전에서 (0.1.7 답 129: 로컬은 글자 수만) */
export const COMPANY_NAME_LENGTH = [2, 12] as const;

export type CertificateError = 'badName' | 'nameLocked' | 'badEmblem' | 'badFace' | 'noTitle';

/** 상단 이름을 다듬는다: 앞뒤 빈칸은 지우고, 줄바꿈과 꺾쇠는 받지 않는다. 안 되면 null */
export function cleanCompanyName(name: string): string | null {
  const n = name.trim().replace(/\s+/g, ' ');
  if ([...n].length < COMPANY_NAME_LENGTH[0] || [...n].length > COMPANY_NAME_LENGTH[1] || /[<>&"]/.test(n)) return null;
  return n;
}

/** 상단 이름을 바꾼다. 시즌 사이에만 (부르는 쪽이 확인한다, 0.1.7 답 129) */
export function setCompany(c: Certificate, name: string): CertificateError | null {
  const n = cleanCompanyName(name);
  if (n === null) return 'badName';
  c.name = n;
  return null;
}

/** 문장을 바꾼다 (언제든) */
export function setEmblem(c: Certificate, emblem: unknown): CertificateError | null {
  if (!isEmblem(emblem)) return 'badEmblem';
  c.emblem = { shield: emblem.shield, field: [emblem.field[0], emblem.field[1]], division: emblem.division, symbol: emblem.symbol, symbolColor: emblem.symbolColor };
  return null;
}

/** 얼굴을 바꾼다 (언제든). 그림 있는 파츠만 */
export function setFace(c: Certificate, face: unknown): CertificateError | null {
  const f = cleanFace(face);
  if (!f) return 'badFace';
  c.face = f;
  return null;
}

/** 대표 칭호를 고른다 (얻은 칭호 중에서, 없애려면 null) */
export function setTitle(c: Certificate, title: string | null): CertificateError | null {
  if (title !== null && !c.titles.includes(title)) return 'noTitle';
  c.title = title;
  return null;
}

/**
 * 새 증서. 문장과 얼굴은 시드로 추천해 둔다 (시작 화면에서 그대로 넘어가도 된다, 0.1.7 답 129).
 * 상인 번호는 계정을 만든 순서 (로컬은 플레이어 1번, 봇은 그 뒤)
 */
export function createCertificate(seed = 0, merchantNo: number | null = null): Certificate {
  const rng = createRng(mixSeed(seed, 0xce47));
  return {
    name: '이름 없는 상단',
    emblem: rollEmblem(rng),
    face: rollPlayerFace(rng),
    merchantNo,
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
  emblem: Emblem;
  face: Look;
  merchantNo: number | null;
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
    emblem: c.emblem,
    face: c.face,
    merchantNo: c.merchantNo,
    origin: c.origin,
    seasonsCompleted: c.seasonsCompleted,
    paper: paperGrade(c.seasonsCompleted),
    title: c.title,
    pinned: c.pinned.map((i) => c.badges[i]!).map((b) => ({ ...b, name: badgeDef(b.badge)?.name ?? b.badge })),
    badgeCount: c.badges.length,
    bestBigShotRank: c.bestBigShotRank,
  };
}

/**
 * 예전 저장(0.1.6까지)의 증서를 새 모양으로 (0.1.7): 문장 이름(crest) → 문장 부품, 얼굴과 상인 번호를 채운다.
 * 이미 새 모양이면 그대로
 */
export function refitCertificates(state: { seed: number; players: Record<string, { seq: number; certificate: Certificate }> }): void {
  for (const p of Object.values(state.players)) {
    const c = p.certificate as Certificate & { crest?: string };
    const fresh = createCertificate(mixSeed(state.seed, 0xce47, p.seq), p.seq + 1);
    if (!c.emblem) c.emblem = emblemFromCrest(c.crest, mixSeed(state.seed, 0xe3b1, p.seq));
    if (!c.face) c.face = fresh.face;
    if (c.merchantNo === undefined) c.merchantNo = fresh.merchantNo;
    delete c.crest;
  }
}
