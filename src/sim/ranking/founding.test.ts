// 게임 시작 화면과 부품 (0.1.7 답 129·130): 문장 부품, 플레이어 얼굴, 상단 이름은 시즌 사이에만, 상인 번호, 예전 저장 고치기.
import { describe, expect, it } from 'vitest';
import { advanceDay, applyCommand, createEconomy, nextSeasonEconomy, playerView } from '../economy';
import { botSpecs, BOT_COMPANY_NAMES, recommendCompanyName } from '../bot';
import { AVAILABLE_PARTS, cleanFace, faceCloth, faceParts, rollPlayerFace, withCloth, withTop } from '../looks';
import { createRng } from '../rng';
import { generateWorld } from '../worldgen';
import { createCertificate, refitCertificates } from './certificate';
import { DIVISION_IDS, EMBLEM_COLORS, emblemFromCrest, isEmblem, rollEmblem, SHIELD_IDS, SYMBOL_IDS, symbolFromName, type Emblem } from './emblem';

const map = generateWorld(4242);
const EMBLEM: Emblem = { shield: 'kite', field: ['indigo', 'cream'], division: 'pale', symbol: 'scales', symbolColor: 'amber' };

describe('문장 부품', () => {
  it('추천 문장은 고를 수 있는 값이고, 바탕 두 색은 다르다. 같은 시드면 같은 문장', () => {
    for (let s = 0; s < 200; s++) {
      const e = rollEmblem(createRng(s));
      expect(isEmblem(e)).toBe(true);
      expect(e.field[0]).not.toBe(e.field[1]);
      expect(e.symbolColor).not.toBe(e.field[0]);
      expect(rollEmblem(createRng(s))).toEqual(e);
    }
    expect(SHIELD_IDS).toHaveLength(5);
    expect(SYMBOL_IDS).toHaveLength(10);
    expect(DIVISION_IDS).toContain('none');
  });

  it('없는 모양·색·상징은 받지 않는다', () => {
    expect(isEmblem(EMBLEM)).toBe(true);
    expect(isEmblem({ ...EMBLEM, shield: 'star' })).toBe(false);
    expect(isEmblem({ ...EMBLEM, field: ['indigo'] })).toBe(false);
    expect(isEmblem({ ...EMBLEM, symbolColor: 'neon' })).toBe(false);
    expect(isEmblem({ ...EMBLEM, symbol: 'crow' })).toBe(false);
    expect(isEmblem(null)).toBe(false);
    expect(Object.keys(EMBLEM_COLORS).join()).not.toMatch(/gold|worth/);
  });

  it('예전 문장과 봇 상단 이름에서 가까운 상징을 고른다', () => {
    expect(emblemFromCrest('anvil', 1).symbol).toBe('hammer');
    expect(emblemFromCrest('wheat', 1).symbol).toBe('wheat');
    expect(isEmblem(emblemFromCrest('owl', 1))).toBe(true);
    expect(symbolFromName('은빛 송어 상단')).toBe('fish');
    expect(symbolFromName('구리 저울 상단')).toBe('scales');
    expect(symbolFromName('새벽 종 상단')).toBeNull();
    for (const spec of botSpecs(7, 11)) {
      expect(isEmblem(spec.emblem)).toBe(true);
      const want = symbolFromName(spec.name!);
      if (want) expect(spec.emblem!.symbol).toBe(want);
    }
  });
});

describe('플레이어 얼굴', () => {
  it('추천 얼굴은 그림 있는 파츠로 된 젊은 얼굴이다', () => {
    for (let s = 0; s < 100; s++) {
      const f = rollPlayerFace(createRng(s));
      expect(cleanFace(f)).toEqual(f);
      expect(f.old).toBe(false);
      expect(f.hairColor).not.toBe('gray');
      expect(AVAILABLE_PARTS.has(f.top)).toBe(true);
    }
  });

  it('남녀 구분 없이 그림 있는 모든 머리·상의를 고를 수 있다. 그림 없는 파츠는 받지 않는다', () => {
    const f = rollPlayerFace(createRng(3));
    for (const hair of faceParts('hair')) expect(cleanFace({ ...f, hair })).not.toBeNull();
    for (const top of faceParts('top')) expect(cleanFace(withTop(f, top))).not.toBeNull();
    expect(faceParts('hair')).toEqual(expect.arrayContaining(['hair_01', 'hair_02', 'hair_03']));
    expect(cleanFace({ ...f, top: 'top_13' })).toBeNull();
    expect(cleanFace({ ...f, skin: 'green' })).toBeNull();
    expect(cleanFace({ ...f, beard: 'beard_01' })).toBe(AVAILABLE_PARTS.has('beard_01') ? cleanFace({ ...f, beard: 'beard_01' }) : null);
  });

  it('상의를 바꿔도 옷 색은 그대로, 옷 색은 주 색 영역만 바꾼다', () => {
    const f = withCloth(withTop(rollPlayerFace(createRng(5)), 'top_03'), 'madder');
    expect(faceCloth(f)).toBe('madder');
    // top_04는 2번 영역이 주 색이다
    const g = withTop(f, 'top_04');
    expect(faceCloth(g)).toBe('madder');
    expect(g.cloth[2]).toBe('madder');
    expect(g.cloth[1]).toBe('cream');
  });
});

describe('상인 증서: 시작 화면에서 고른 것, 상인 번호, 이름은 시즌 사이에만', () => {
  const face = withCloth(withTop(rollPlayerFace(createRng(9)), 'top_06'), 'olive');

  it('시작 화면에서 고른 이름·얼굴·문장으로 판을 연다. 상인 번호는 플레이어 1번, 봇은 그 뒤', () => {
    const s = createEconomy(map, 4242, { players: [{ id: 'me', name: '  새벽바람   상단 ', face, emblem: EMBLEM }, ...botSpecs(4242, 3)] });
    const c = s.players.me!.certificate;
    expect(c).toMatchObject({ name: '새벽바람 상단', face, emblem: EMBLEM, merchantNo: 1 });
    expect(Object.values(s.players).map((p) => p.certificate.merchantNo)).toEqual([1, 2, 3, 4]);
    const v = playerView(s, map, 'me');
    expect(v.certificate).toMatchObject({ name: '새벽바람 상단', face, emblem: EMBLEM, merchantNo: 1 });
    expect(v.certificates.bot1!.emblem).toEqual(s.players.bot1!.certificate.emblem);
  });

  it('얼굴과 문장은 언제든 바꾸고, 상단 이름은 시즌 중에는 바꾸지 못한다', () => {
    const s = createEconomy(map, 4242, { apprentice: false });
    expect(applyCommand(s, map, 'me', { type: 'setCompany', name: '시험 상단' })).toEqual({ ok: false, error: 'nameLocked' });
    expect(applyCommand(s, map, 'me', { type: 'setEmblem', emblem: EMBLEM }).ok).toBe(true);
    expect(applyCommand(s, map, 'me', { type: 'setFace', face }).ok).toBe(true);
    expect(s.players.me!.certificate).toMatchObject({ emblem: EMBLEM, face });
    expect(applyCommand(s, map, 'me', { type: 'setEmblem', emblem: { ...EMBLEM, shield: 'star' } as unknown as Emblem })).toEqual({ ok: false, error: 'badEmblem' });
    expect(applyCommand(s, map, 'me', { type: 'setFace', face: { ...face, top: 'top_99' } })).toEqual({ ok: false, error: 'badFace' });
  });

  it('시즌이 끝나면 이름을 바꾸고, 다음 시즌에는 이름·얼굴·문장·상인 번호가 이어진다', () => {
    const s = createEconomy(map, 4242, { apprentice: false, warmupDays: 2 });
    s.season!.length = 2;
    for (let d = 0; d < 3 && !s.settlement; d++) advanceDay(s, map);
    expect(s.settlement).not.toBeNull();
    expect(applyCommand(s, map, 'me', { type: 'setCompany', name: '새 이름 상단' }).ok).toBe(true);
    applyCommand(s, map, 'me', { type: 'setFace', face });
    const next = nextSeasonEconomy(s, map, 99);
    expect(next.players.me!.certificate).toMatchObject({ name: '새 이름 상단', face, merchantNo: 1, emblem: s.players.me!.certificate.emblem });
  });

  it('상단 이름 추천은 봇 상단 이름 목록에서, 지금 이름은 빼고', () => {
    for (let i = 0; i < 50; i++) {
      const n = recommendCompanyName(createRng(i), ['꿀벌 상단']);
      expect(BOT_COMPANY_NAMES).toContain(n);
      expect(n).not.toBe('꿀벌 상단');
    }
  });

  it('예전 저장(문장 이름 하나)의 증서를 새 모양으로 고친다', () => {
    const s = createEconomy(map, 4242);
    const old = s.players.me!.certificate as unknown as Record<string, unknown>;
    delete old.emblem;
    delete old.face;
    delete old.merchantNo;
    old.crest = 'anchor';
    refitCertificates(s);
    const c = s.players.me!.certificate;
    expect(c.emblem.symbol).toBe('ship');
    expect(cleanFace(c.face)).toEqual(c.face);
    expect(c.merchantNo).toBe(1);
    expect('crest' in c).toBe(false);
    // 이미 새 모양이면 그대로
    const before = JSON.stringify(c);
    refitCertificates(s);
    expect(JSON.stringify(s.players.me!.certificate)).toBe(before);
  });

  it('새 증서의 추천 문장과 얼굴은 시드로 정해진다', () => {
    expect(createCertificate(11, 1)).toEqual(createCertificate(11, 1));
    expect(createCertificate(11, 1).emblem).not.toEqual(createCertificate(12, 1).emblem);
  });
});

describe('봇 상단 이름', () => {
  it('사람이 쓴 이름은 봇이 쓰지 않는다', () => {
    for (let seed = 0; seed < 30; seed++) {
      const mine = recommendCompanyName(createRng(seed));
      expect(botSpecs(seed, 11, [mine]).map((s) => s.name)).not.toContain(mine);
    }
  });
});
