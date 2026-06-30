import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const r = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      '@grid/sim': r('packages/sim/src/index.ts'),
      '@grid/content': r('packages/content/src/index.ts'),
      '@grid/game': r('packages/game/src/index.ts'),
      '@grid/render': r('packages/render/src/index.ts'),
      '@grid/ui': r('packages/ui/src/index.ts'),
      '@grid/audio': r('packages/audio/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts', 'tools/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
    },
  },
});
