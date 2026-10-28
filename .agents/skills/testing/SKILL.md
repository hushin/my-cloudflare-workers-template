---
name: testing
description: Use when writing or modifying vitest tests for Cloudflare Workers + Hono routes. Covers the unit/worker/storybook project split in vitest.config.ts, @cloudflare/vitest-plugin setup on the worker project only, app.request() pattern, env from cloudflare:test, zod response validation, module state reset for test isolation, and tsconfig type setup. Trigger when the user asks to write/add tests, add testing, or mentions vitest/example-todo.test.ts patterns.
---

# Testing Skill — Cloudflare Workers + Hono + Vitest

このプロジェクトでのテストの書き方・設定の規約。

`vitest.config.ts` は置き場所でテストの project を振り分ける。`src/worker/**` の `*.test.ts` は
`worker` project（workerd + D1）、`src/react-app/**` と `src/shared/**` の `*.test.ts` は
`unit` project（Node）で実行される。Hono route / middleware / repository のテストと、worker の
コードに依存する計算ロジックは `src/worker/` 配下に書く。DOM に触らない util 関数や計算ロジック
（`src/react-app/` 配下のものを含む）は対象の隣に書けば `unit` で流れる。
DOM を伴う UI のテストは story として書く（`storybook-testing` skill）。

## project の振り分け

| project     | 何を流すか                                                                                  | どこで動くか                         |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| `unit`      | `src/react-app/**/*.test.ts`、`src/shared/**/*.test.ts`、`PURE_WORKER_TESTS` に列挙したもの | Node（workerd なし。速い）           |
| `worker`    | `src/worker/**/*.test.ts`（`PURE_WORKER_TESTS` を除く）                                     | workerd（+ migration 適用済みの D1） |
| `storybook` | `*.stories.tsx` の `play`                                                                   | Chromium（browser mode）             |

- 置き場所で決まる。新しく足すテストは対象のソースの隣に置けば正しい側に入る
- `src/worker` 配下は中身が純粋でも既定では `worker` で流す（worker のバンドル解決を実 runtime で
  確かめられるようにするため）。bindings も workerd も要らないと分かっているものだけ、
  `vitest.config.ts` の `PURE_WORKER_TESTS` に列挙して `unit` に移す（テンプレートの main では空）
- `unit` は Node なので **`document` / `window` は無く、`cloudflare:test`（`env` / D1）も無い**。
  DOM が要るものは story、`env` が要るものは `src/worker/` 配下に置く
- D1 はテストファイルごとに隔離される（`@cloudflare/vitest-plugin` の仕様）ので、ファイルは並列に
  流してよい。状態が混ざることはない
- `maxWorkers` は 4 に固定してある。既定値は CPU 数依存で、2 vCPU の CI ランナーでは 1（= 完全に
  直列）になるため。project ごとに違う値を入れると vitest が別 group として直列に流すので、
  全 project で同じ値にしてある

## 構成

```
vitest.config.ts                    # 3 project の定義。cloudflareTest は worker だけ
src/worker/routes/*.test.ts         # worker project（route と同階層）
src/react-app/**/*.test.ts          # unit project（対象の隣）
tsconfig.worker.json / tsconfig.test.json  # vitest/globals, cloudflare:test の型
```

## vitest.config.ts（雛形）

`cloudflareTest` を **ルートの `plugins` に置かない**こと。project は `extends: true` でルート設定を
継承するので、ルートに置くと `unit` と `storybook` にも workerd が用意され、テスト本体が数十 ms
でも 1 ファイルあたり約 2 秒の起動コストが乗る。`cloudflareTest` は `worker` project の中だけに置く。

```ts
const PURE_WORKER_TESTS: string[] = [];

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    maxWorkers: 4,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: ['src/react-app/**/*.test.ts', 'src/shared/**/*.test.ts', ...PURE_WORKER_TESTS],
          exclude: [...defaultExclude, '**/skills/*/assets/**', '**/.wt/**'],
        },
      },
      {
        extends: true,
        // workerd と D1 を用意するのはこの project だけ
        plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.json' } })],
        test: {
          name: 'worker',
          globals: true,
          include: ['src/worker/**/*.test.ts'],
          exclude: [...defaultExclude, '**/skills/*/assets/**', '**/.wt/**', ...PURE_WORKER_TESTS],
        },
      },
      // storybook project（browser mode）はそのまま
    ],
  },
});
```

`exclude` の `**/skills/*/assets/**` は add-on skill の貼り付け用ファイル、`**/.wt/**` は
git worktree の置き場を対象外にするためのもの。消さないこと。

## テストファイルの基本形（worker project）

```ts
import { env } from 'cloudflare:test';
import app from './example-todo';

describe('example-todo routes', () => {
  it('GET / returns 200', async () => {
    const res = await app.request('/', {}, env);
    expect(res.status).toBe(200);
  });
});
```

- `env` は `cloudflare:test` から import し、`app.request()` の第3引数に必ず渡す
- route の Hono app は default export されている前提（`export default app`）
- テスト対象の route app を直接 import してテストする（`/api` prefix は付かない）
- `globals: true` なので `describe` / `it` / `expect` / `beforeEach` は import 不要
  （`tsconfig.worker.json` に `vitest/globals` が入っているため型も通る）

### unit project のテストは vitest から明示的に import する

`src/react-app/**` と `src/shared/**` は `tsconfig.app.json` の担当で、そこには `vitest/globals` を
入れていない（アプリのコードにテストのグローバル型を持ち込まないため）。そのため unit 側の
テストでは globals に頼らず import する。

```ts
import { describe, expect, it } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('pads the month', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
```

`document` / `window` / `cloudflare:test` は使えない。DOM が要るなら story にする。

## レスポンスのバリデーション

`res.json()` の戻り値は `unknown` のため、zod スキーマでパースして型安全に扱う。

```ts
import { z } from 'zod';

const todoSchema = z.object({ id: z.string(), title: z.string() });
const todosSchema = z.array(todoSchema);

const todo = todoSchema.parse(await res.json()); // 単体
const todos = todosSchema.parse(await res.json()); // 配列
```

`as` による型アサーションは使わない（oxlint `no-unsafe-type-assertion` エラーになる）。

## テスト間の状態分離

モジュールレベルの mutable な状態（Map など）は同一ファイル内のテスト間で共有される。テスト対象
モジュール側にリセット関数を **export** し、`beforeEach` で呼ぶ。

```ts
// example-todo.ts（本実装）
export function resetTodos(): void {
  todos.clear();
}
```

```ts
// example-todo.test.ts
import app, { resetTodos } from './example-todo';

describe('example-todo routes', () => {
  beforeEach(() => {
    resetTodos();
  });
  // ...
});
```

API 経由で DELETE をループしてクリアする方式は避ける（テストが API の正常動作に依存してしまう）。

## D1 を使う route のテスト

D1（`add-d1-drizzle` skill）を導入している場合、状態はモジュール変数ではなくデータベースに載る。
リセット関数の代わりに、`beforeEach` でテーブルの行を消す。

```ts
import { env } from 'cloudflare:test';

beforeEach(async () => {
  await env.DB.exec('DELETE FROM example_todos');
});
```

- マイグレーションの適用は各テストではなく `setupFiles`（`src/worker/test/apply-migrations.ts`）で
  一度だけ行う。テスト本体に migration を書かない
- その `setupFiles` と `miniflare.bindings`（`TEST_MIGRATIONS`）は **`worker` project の中だけ**に
  入れる。`unit` も `storybook` も D1 に触らないので要らない（`add-d1-drizzle` skill の手順 7）
- D1 は **テストファイルごとに隔離される**（同じファイル内では共有される）。ファイル間の状態は
  混ざらないので、並列実行を止める必要はない
- `env.DB.exec()` は複数文を `\n` 区切りで受け取れるが、prepared statement を使わないため
  **maintenance / one-shot 用**（公式ドキュメント）。テストの後片付けはこの用途に当たるので `exec` で問題ない
- テーブルを増やしたら `beforeEach` の削除対象にも追加する（消し忘れは他テストへの汚染になる）
- 外部キー制約がある場合は子テーブルから先に消す

## tsconfig

worker project のテストの型は `tsconfig.worker.json`（と `tsconfig.test.json`）の `types` で足す。

```json
"types": [
  "vitest/globals",
  "@cloudflare/vitest-plugin/types"
]
```

- `vitest/globals` → `describe` / `it` / `expect` 等のグローバル型
- `@cloudflare/vitest-plugin/types` → `cloudflare:test` モジュールの型

unit project のテストは `vitest` からの import で型が付くので、`tsconfig.app.json` に
`vitest/globals` を足す必要はない。

## 実行

```bash
pnpm test                                      # 3 project まとめて（CI / 1回実行）
pnpm exec vitest run --project worker          # worker だけ
pnpm exec vitest run --project unit            # unit だけ（workerd を起動しない）
pnpm exec vitest run --project storybook       # story だけ
```

テンプレートの main は unit のテストを持たないので、`vitest.config.ts` のルートに
`passWithNoTests: true` を置いてある（無いと `--project unit` が `No test files found` で落ちる。
project ごとには指定できない）。unit のテストが揃ったアプリでは、テストが 0 件になったときに
気づけるよう外してよい。

watch モードは使わない。
