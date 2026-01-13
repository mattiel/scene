import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'SceneNavigation',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@scene/core', '@scene/surfaces'],
    },
    sourcemap: true,
  },
});
