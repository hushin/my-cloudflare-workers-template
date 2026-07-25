import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defaultExclude, defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.json',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          globals: true,
          // add-on skill の assets は「貼り付け用の実ファイル」であって
          // このリポジトリでは解決できない import を含むため、テスト対象から外す
          exclude: [...defaultExclude, '**/skills/*/assets/**'],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          // story ファイルを並列に読み込むと、コールドキャッシュの初回実行で
          // テスターページが落ちる／繋がらないことがある（vitest-dev/vitest#8471,
          // #10791）。直列にすると数秒遅くなるが初回が安定する。
          // 詳細は docs/storybook-vitest-first-run-flake.md
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
});
