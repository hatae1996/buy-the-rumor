// Deno에서 서버 번들을 돌리는 시험만 (npm run test:deno). 번들을 먼저 만들어야 해서 npm test에서 뺐다
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.deno.ts'],
    testTimeout: 120_000,
  },
});
