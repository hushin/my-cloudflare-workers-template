import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    // '@tanstack/router-plugin' は '@vitejs/plugin-react' より前に置く
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/react-app/routes',
      generatedRouteTree: './src/react-app/routeTree.gen.ts',
    }),
    react(),
    cloudflare(),
  ],
});
