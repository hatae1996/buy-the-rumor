// 오래 걸리는 측정만 (npm run measure:server): 서버 코드로 시즌을 처음부터 결산까지 돌린다. npm test에서 뺐다
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.measure.ts'],
    testTimeout: 900_000,
  },
});
