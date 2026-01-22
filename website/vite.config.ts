import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsConfigPaths(), tanstackStart(), viteReact(), basicSsl()],
  server: {
    host: true, // Listen on all interfaces
    allowedHosts: ['.ts.net'], // Allow all Tailscale MagicDNS hosts
  },
  resolve: {
    alias: {
      '@scene/core': resolve(__dirname, '../packages/core/src/index.ts'),
      '@scene/react': resolve(__dirname, '../packages/react/src/index.ts'),
      '@scene/surfaces': resolve(__dirname, '../packages/surfaces/src/index.ts'),
      '@scene/navigation': resolve(__dirname, '../packages/navigation/src/index.ts'),
      '@scene/input': resolve(__dirname, '../packages/input/src/index.ts'),
      '@scene/renderer': resolve(__dirname, '../packages/renderer/src/index.ts'),
      '@scene/screen': resolve(__dirname, '../packages/screen/src/index.ts'),
      '@scene/a11y': resolve(__dirname, '../packages/a11y/src/index.ts'),
    },
  },
});
