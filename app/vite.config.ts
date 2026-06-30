import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const r = (p: string) => resolve(import.meta.dirname, '..', p);

// Workspace packages are consumed directly as TS source via aliases, so there is
// no per-package build step during development. Vite/esbuild transpiles them.
export default defineConfig({
  plugins: [react()],
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
  server: { port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js core is inherently large; it is split into its own long-cached chunk
    // rather than trimmed, so the 3D vendor warning threshold is raised intentionally.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: [
            '@react-three/fiber',
            '@react-three/drei',
            '@react-three/postprocessing',
            'postprocessing',
          ],
        },
      },
    },
  },
});
