import type { StorybookConfig } from '@storybook/tanstack-react';
import tailwindcss from '@tailwindcss/vite';
import { msw } from 'msw/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
    'msw-storybook-addon',
  ],
  framework: '@storybook/tanstack-react',
  // ルートの vite.config.ts の tailwindcss() だけでは vitest時に
  // 反映されないため、ここでも明示的に追加する。
  async viteFinal(viteConfig) {
    viteConfig.plugins ??= [];
    viteConfig.plugins.push(tailwindcss());
    // mockServiceWorker.js は msw/vite が dev server で配信し、build 時に出力する。
    // 手動 setupWorker()（preview.tsx）を使うため worker-only モードでよい。
    // これにより postinstall（msw init）と public/ 配下の生成物が不要になる。
    viteConfig.plugins.push(msw({ mode: 'worker-only' }));
    return viteConfig;
  },
};
export default config;
