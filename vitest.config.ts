import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    environment: 'node',
    // The production build runs the suite with NODE_ENV=production, which loads React's
    // production bundle; that lacks `act`, which Testing Library needs.
    env: { NODE_ENV: 'test' },
    // Integration files share one database and clear it between tests; never run them concurrently.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['lib/prisma.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
