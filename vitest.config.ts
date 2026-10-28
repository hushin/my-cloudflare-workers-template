import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defaultExclude, defineConfig } from 'vitest/config';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = import.meta.dirname;

// add-on skill の assets は「貼り付け用の実ファイル」であって
// このリポジトリでは解決できない import を含むため、テスト対象から外す。
// .wt は git worktree の置き場（別ブランチの作業ツリー）。
const commonExclude = [...defaultExclude, '**/skills/*/assets/**', '**/.wt/**'];

// テストは置き場所で project を振り分ける。
//   unit      … Workers も D1 も使わない純ロジック（Node で流す。速い）
//   worker    … src/worker のコード（workerd + D1 で流す）
//   storybook … UI（story の play をブラウザで流す）
// 新しく足すテストは、対象のソースの隣に置けばこの規則で入る。
// src/worker 配下は中身が純粋でも既定では worker で流す（worker の
// バンドル解決を実 runtime で確かめられるようにするため）。bindings も
// workerd も要らないと分かっているものだけ、下の PURE_WORKER_TESTS に
// 列挙して unit に移す。
const PURE_WORKER_TESTS: string[] = [];

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    // テストファイルは既定で並列に流れるが、その並列度は CPU 数依存で、
    // 2 vCPU の CI ランナーでは 1 (= 完全に直列) になる。worker project の
    // 1 ファイルあたりのコストは workerd の起動が支配的 (テスト本体は数 ms)
    // なので、明示的に固定してファイルを重ねる。
    // project ごとに違う値を入れると vitest が別 group として直列に流す
    // (sequence.groupOrder) ので、全 project で同じ値にしておく。
    // このテンプレート自体 (public) の CI は 4 vCPU なので効果は小さいが、
    // テンプレートから作る private リポジトリの標準ランナーは 2 vCPU で、
    // そちらでは直列と並列の差がそのままテスト時間になる。
    maxWorkers: 4,
    // テンプレートの main はまだ unit のテストを持たない。無いままだと
    // `--project unit` が 'No test files found' で落ちるので許容する
    // (project ごとには指定できない)。unit のテストが揃ったアプリでは、
    // テストが 0 件になったときに CI が気づけるよう外してよい。
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // Workers runtime を使わないので Node で流す。document / window と
          // cloudflare:test (env / D1) はここには無い。
          environment: 'node',
          globals: true,
          include: ['src/react-app/**/*.test.ts', 'src/shared/**/*.test.ts', ...PURE_WORKER_TESTS],
          exclude: commonExclude,
        },
      },
      {
        extends: true,
        // Workers runtime (workerd) と D1 を用意するのはこの project だけ。
        // 純ロジックのテストまで workerd を起動するとファイルごとに
        // 起動コストが乗るので、unit と分けている。
        plugins: [
          cloudflareTest({
            wrangler: {
              configPath: './wrangler.json',
            },
          }),
        ],
        test: {
          name: 'worker',
          globals: true,
          include: ['src/worker/**/*.test.ts'],
          // PURE_WORKER_TESTS は unit で流す（二重に走らせない）
          exclude: [...commonExclude, ...PURE_WORKER_TESTS],
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
