// 서버 번들 (작업목록-0.2.0 2번): src/server(시뮬 포함)를 Deno가 부를 ES 모듈 하나로 묶는다.
// Edge Function(supabase/functions/*/index.ts)은 이 번들만 불러 DB 연결을 넘겨준다.
// npm run build:server → supabase/functions/_shared/server.js (커밋하지 않는다, 배포 전에 만든다)
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    emptyOutDir: false,
    // 서버에서 오류 위치를 읽을 수 있게 줄이지 않는다
    minify: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/server/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'server.js',
    },
  },
});
