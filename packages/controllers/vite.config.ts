import { defineConfig, PluginOption } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
    }) as PluginOption,
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'SceneControllers',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@scene/core', '@scene/input', '@scene/motion'],
    },
    sourcemap: true,
  },
});
