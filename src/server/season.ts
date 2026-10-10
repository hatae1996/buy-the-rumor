// 시즌 열기와 세계 배정 (작업목록-0.2.0 8번, 답 104·105·107·114·115, handoff 0.2.0 1번).
// - 시즌 id는 여는 날(한국 시간 'YYYY-MM-DD'), 격주 월요일 아침 9시에 연다. 세계는 모두 마을 6곳, 같은 시드(같은 지도).
// - 운영자가 시즌을 열 때 세계를 미리 n개 연다(비공개 테스트는 둘). 세계는 비어 있고 미리 돌리기를 마친 1일째다.
// - 들어갈 세계: 첫 장날 전에는 사람이 가장 적고 자리가 남은 세계, 모두 찼으면 새 세계를 연다(아직 1일이라 따라잡을 날이 없다).
//   첫 장날 뒤에는 자리가 남은 세계에만, 모두 찼으면 다음 시즌을 기다린다. 들어올 수 있는 마지막 날이 지나도 다음 시즌.
// - 봇 채우기는 tick이 첫 장날 직전에 한다(fillBots).
import { openWorld, seasonSeed, SIM_VERSION } from '../sim/service';
import type { Db } from './db';
import { mapFor } from './maps';
import { DAY_MS } from './schedule';

/** 세계 하나에 사람과 봇을 합쳐 (worlds 표의 check와 같다, 답 114) */
export const WORLD_CAP = 15;

/**
 * 시즌 중간에 들어올 수 있는 마지막 날 (게임 날). 기획서 초안 "10일째까지"를 실제 10일째(시즌 13일 중)로 읽어
 * 여는 때부터 240시간 = 장날 96번 (질문 138)
 */
export const JOIN_LAST_DAY = Math.floor((10 * 24 * 3600_000) / DAY_MS);

export type SeasonKind = 'rehearsal' | 'closed_test' | 'live';

/** 시즌 id(여는 날) → 여는 때: 그날 아침 9시, 한국 시간 */
export function seasonOpensAt(id: string): number {
  return Date.parse(`${id}T09:00:00+09:00`);
}

export type OpenSeasonError = 'badSeasonId' | 'notMonday' | 'seasonExists' | 'badWorldCount';

/**
 * 시즌을 연다: seasons 한 줄과 빈 세계 n개. 예행연습이 아니면 월요일이어야 한다.
 * 시즌은 2주(13일 플레이 + 1일 결산)
 */
export async function openSeason(
  db: Db,
  opt: { id: string; kind: SeasonKind; worlds: number },
): Promise<{ ok: true; seasonId: string; worlds: string[] } | { ok: false; error: OpenSeasonError }> {
  const opens = seasonOpensAt(opt.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opt.id) || Number.isNaN(opens)) return { ok: false, error: 'badSeasonId' };
  if (opt.kind !== 'rehearsal' && new Date(`${opt.id}T00:00:00Z`).getUTCDay() !== 1) return { ok: false, error: 'notMonday' };
  if (!Number.isInteger(opt.worlds) || opt.worlds < 1 || opt.worlds > 20) return { ok: false, error: 'badWorldCount' };
  return db.transaction(async (tx) => {
    const made = await tx.query(
      `insert into public.seasons (id, seed, kind, opens_at, ends_at, sim_version) values ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6)
       on conflict (id) do nothing returning id`,
      [opt.id, seasonSeed(opt.id), opt.kind, new Date(opens).toISOString(), new Date(opens + 14 * 24 * 3600_000).toISOString(), SIM_VERSION],
    );
    if (!made.length) return { ok: false, error: 'seasonExists' };
    const worlds: string[] = [];
    for (let i = 0; i < opt.worlds; i++) worlds.push(await addWorld(tx, opt.id));
    return { ok: true, seasonId: opt.id, worlds };
  });
}

/** 빈 세계 하나를 더 연다 (w1, w2, ... 다음 번호). 같은 시즌 시드라 지도와 사건 일정이 같다 */
export async function addWorld(db: Db, seasonId: string): Promise<string> {
  const [n] = await db.query<{ n: number }>('select count(*)::int as n from public.worlds where season_id = $1', [seasonId]);
  const id = `w${n!.n + 1}`;
  const blob = openWorld(mapFor(seasonId), { seasonId, worldId: id });
  await db.query(
    `insert into public.worlds (season_id, id, humans, bots, state, day, sim_version) values ($1, $2, 0, 0, $3::text::json, $4, $5)`,
    [seasonId, id, JSON.stringify(blob), blob.state.day, blob.simVersion],
  );
  return id;
}

export type PickError =
  /** 시즌 중간에 모든 세계가 찼다 (답 115) */
  | 'worldsFull'
  /** 들어올 수 있는 마지막 날이 지났다 */
  | 'seasonClosed';

/**
 * 졸업한 사람이 들어갈 세계를 골라 잠근다. 고른 세계 id를 돌려준다(행은 잠긴 채).
 * 잠그기 전에 다른 사람이 자리를 채웠으면 다시 고른다
 */
export async function pickWorld(tx: Db, seasonId: string): Promise<{ ok: true; worldId: string } | { ok: false; error: PickError }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const worlds = await tx.query<{ id: string; humans: number; bots: number; day: number }>(
      `select id, humans, bots, day from public.worlds where season_id = $1 and not settled and halted is null order by humans, id`,
      [seasonId],
    );
    const started = worlds.some((w) => w.day > 1);
    if (started && Math.max(...worlds.map((w) => w.day)) > JOIN_LAST_DAY) return { ok: false, error: 'seasonClosed' };
    const room = worlds.find((w) => w.humans + w.bots < WORLD_CAP);
    if (!room) {
      if (started) return { ok: false, error: 'worldsFull' };
      // 첫 장날 전에 모두 찼으면 새 세계 (같은 지도, 아직 1일이라 따라잡을 날이 없다)
      const id = await addWorld(tx, seasonId);
      await tx.query('select 1 from public.worlds where season_id = $1 and id = $2 for update', [seasonId, id]);
      return { ok: true, worldId: id };
    }
    const [locked] = await tx.query<{ id: string }>(
      `select id from public.worlds where season_id = $1 and id = $2 and humans + bots < $3 and not settled and halted is null for update`,
      [seasonId, room.id, WORLD_CAP],
    );
    if (locked) return { ok: true, worldId: locked.id };
  }
  return { ok: false, error: 'worldsFull' };
}
