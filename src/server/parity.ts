// 같은 시드·같은 명령이면 어디서 돌려도 같은 상태인지 보는 짧은 판 (작업목록-0.2.0 2번).
// 소스를 Node(vitest)에서 돌린 값과, 번들을 Deno(로컬 또는 배포한 Edge Function)에서 돌린 값을 맞춰 본다.
// 서버처럼 날마다 상태를 글자로 저장했다 다시 읽는다.
import { SIM_VERSION } from '../sim/service/version';
import { stateHash } from '../sim/service/hash';
import { commandWorld, openWorld, seasonMap, tickWorld, type WorldBlob } from '../sim/service/world';

export interface ParityResult {
  simVersion: number;
  /** 날마다 장날 뒤 상태 해시 */
  hashes: string[];
}

const PARITY_SEASON = '2000-01-03';
const PARITY_HUMAN = '00000000-0000-0000-0000-000000000001';

export function parityRun(days = 5): ParityResult {
  const map = seasonMap(PARITY_SEASON);
  let blob: WorldBlob = openWorld(map, {
    seasonId: PARITY_SEASON,
    worldId: 'parity',
    humans: [{ id: PARITY_HUMAN, name: '맞춤 상단', merchantNo: 1, apprentice: false }],
    bots: 11,
    warmupDays: 3,
  });
  const hashes: string[] = [];
  for (let d = 0; d < days; d++) {
    commandWorld(blob, map, PARITY_HUMAN, { type: 'restAtInn' });
    blob = JSON.parse(JSON.stringify(blob)) as WorldBlob;
    tickWorld(blob, map);
    blob = JSON.parse(JSON.stringify(blob)) as WorldBlob;
    hashes.push(stateHash(blob));
  }
  return { simVersion: SIM_VERSION, hashes };
}
