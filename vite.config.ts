import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Storybook はこの設定ファイルを取り込んで自身の preview ビルドにも使うが、
// cloudflare() は preview を workerd ランタイム上で動かそうとして壊れるため、
// vitest / storybook からの実行時は含めない。
const isStorybookOrVitest = Boolean(process.env.VITEST || process.env.STORYBOOK);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    // '@tanstack/router-plugin' は '@vitejs/plugin-react' より前に置く
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/react-app/routes',
      // route と colocation した *.stories.tsx / *.mock.ts をルート扱いしない
      routeFileIgnorePattern: '\\.(stories|mock)\\.',
      generatedRouteTree: './src/react-app/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    ...(isStorybookOrVitest ? [] : [cloudflare()]),
  ],
});
