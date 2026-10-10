// 소스를 Node에서 돌린 판과 번들을 Deno에서 돌린 판의 상태 해시가 날마다 같은가 (작업목록-0.2.0 2번)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parityRun, type ParityResult } from '../../src/server/parity';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DAYS = 6;

describe('서버 번들을 Deno에서', () => {
  it('소스와 같은 상태로 날이 간다', () => {
    const out = execFileSync('deno', ['run', '--allow-read', 'scripts/deno/parity.ts', String(DAYS)], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const deno = JSON.parse(out.trim().split('\n').at(-1)!) as ParityResult;
    const node = parityRun(DAYS);
    expect(deno.simVersion).toBe(node.simVersion);
    expect(deno.hashes).toEqual(node.hashes);
    expect(new Set(node.hashes).size).toBe(DAYS);
  });
});
