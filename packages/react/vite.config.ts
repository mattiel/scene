import { defineConfig, type PluginOption } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
      skipDiagnostics: true,
    }) as PluginOption,
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'SceneReact',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        '@scene/core',
        '@scene/surfaces',
        '@scene/motion',
        '@scene/controllers',
        '@scene/renderer',
      ],
    },
    sourcemap: true,
  },
});
