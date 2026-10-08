// 구조 원칙 1, 3을 지키는지 검사한다.
// src/sim은 화면, Three.js, 실제 시간, Math.random()에 기대지 않는 순수 코드여야 한다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM_DIR = join(import.meta.dirname, '..', 'src', 'sim');

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /Math\.random\s*\(/, why: '랜덤은 src/sim/rng.ts의 시드 난수를 쓴다' },
  { pattern: /Date\.now\s*\(|new Date\s*\(|performance\.now\s*\(/, why: '시간은 게임 속 하루로만 진행한다' },
  { pattern: /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, why: '타이머는 화면 쪽에서 돈다' },
  { pattern: /from\s+['"]three['"]|from\s+['"]\.\.\/(view3d|ui|dev)\b/, why: '시뮬레이션은 화면 코드를 불러오지 않는다' },
  { pattern: /\b(document|window|localStorage)\s*\./, why: 'DOM과 브라우저 저장소는 화면 쪽에서 다룬다' },
];

function listTs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTs(path);
    // 테스트 파일은 검사 대상에서 뺀다 (테스트 도구는 Node에서 돈다)
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('src/sim 순수성', () => {
  const files = listTs(SIM_DIR);

  it('검사할 파일이 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(relative(SIM_DIR, file), () => {
      const code = readFileSync(file, 'utf8')
        // 주석 안의 언급은 허용한다
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const { pattern, why } of FORBIDDEN) {
        expect(code, `${pattern} 금지: ${why}`).not.toMatch(pattern);
      }
    });
  }
});
