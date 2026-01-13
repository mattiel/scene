import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      // Don't rollup types - api-extractor has issues with WebGPU global types
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'SceneScreen',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@scene/renderer'],
    },
    sourcemap: true,
  },
});
