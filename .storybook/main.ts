import type { StorybookConfig } from '@storybook/tanstack-react';
import tailwindcss from '@tailwindcss/vite';

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
  staticDirs: ['../public'],
  // root の vite.config.ts の tailwindcss() だけでは vitest時に
  // 反映されないため、ここでも明示的に追加する。
  async viteFinal(viteConfig) {
    viteConfig.plugins ??= [];
    viteConfig.plugins.push(tailwindcss());
    // コールドキャッシュ時に react/jsx-dev-runtime が事前最適化されておらず、
    // テスト実行中に発見されて Vite がリロード→初回のみ vitest が落ちる既知の問題
    // (storybookjs/storybook#32049) への対処。
    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.include = [
      ...(viteConfig.optimizeDeps.include ?? []),
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      '@tanstack/react-form',
      'hono/client',
      'zod',
    ];
    return viteConfig;
  },
};
export default config;
