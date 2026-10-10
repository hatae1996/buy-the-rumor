// 배포 점검: 서버 번들의 시뮬 버전과 짧은 판의 상태 해시를 돌려준다.
// 같은 값이 로컬에서 나오는지 맞춰 보면 배포한 번들이 소스와 같은 규칙으로 도는지 안다 (작업목록-0.2.0 2번).
import { parityRun, SIM_VERSION } from '../_shared/server.js';

Deno.serve(() => Response.json({ simVersion: SIM_VERSION, parity: parityRun(3) }));
