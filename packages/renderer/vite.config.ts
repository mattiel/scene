import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      // Don't rollup types - api-extractor has issues with WebGPU global types
      rollupTypes: false,
      skipDiagnostics: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SceneRenderer',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: [],
      output: {
        preserveModules: false
      }
    },
    sourcemap: true,
    minify: false
  }
});
