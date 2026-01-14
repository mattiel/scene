import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@scene/core': resolve(__dirname, 'packages/core/dist/index.js'),
      '@scene/surfaces': resolve(__dirname, 'packages/surfaces/dist/index.js'),
      '@scene/renderer': resolve(__dirname, 'packages/renderer/dist/index.js'),
      '@scene/screen': resolve(__dirname, 'packages/screen/dist/index.js'),
      '@scene/input': resolve(__dirname, 'packages/input/dist/index.js'),
      '@scene/navigation': resolve(__dirname, 'packages/navigation/dist/index.js'),
    },
  },
});
