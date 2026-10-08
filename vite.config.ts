import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const version = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim();

export default defineConfig({
  // GitHub Pages처럼 하위 경로(/buy-the-rumor/)에 올려도 열리도록 상대 경로로 빌드한다.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    target: 'es2022',
    // Three.js 조각(약 580kB, gzip 150kB)은 지도 탭을 열 때만 불러온다
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      // 개발용 관찰 화면도 같이 올려 아이폰에서 열어 볼 수 있게 한다 (dev.html)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dev: fileURLToPath(new URL('./dev.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
