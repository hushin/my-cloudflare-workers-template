---
name: testing
description: Use when writing or modifying vitest tests for Cloudflare Workers + Hono routes. Covers @cloudflare/vitest-pool-workers setup, app.request() pattern, env from cloudflare:test, zod response validation, module state reset for test isolation, and tsconfig type setup. Trigger when the user asks to write/add tests, add testing, or mentions vitest/example-todo.test.ts patterns.
---

# Testing Skill — Cloudflare Workers + Hono + Vitest

このプロジェクトでのテストの書き方・設定の規約。

`*.test.ts` は置き場所にかかわらずこの worker プロジェクト（Workers runtime）で実行される。
Hono route のテストに加えて、**DOM に触らない util 関数や計算ロジック**（`src/react-app/` 配下の
ものを含む）もここに書く。DOM を伴う UI のテストは story として書く（`storybook-testing` skill）。

## 構成

```
vitest.config.ts                  # Cloudflare Workers pool 設定
src/worker/routes/*.test.ts      # テストファイル（route と同階層）
tsconfig.worker.json             # vitest/globals, cloudflare:test の型を追加済
```

## vitest.config.ts（雛形）

テストはすべて `@cloudflare/vitest-pool-workers` の `cloudflareTest` プラグイン経由で Workers runtime 上で実行される。`@/` エイリアス解決のため `resolve.alias` も必須。

```ts
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.json' },
    }),
  ],
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
```

`globals: true` により `describe` / `it` / `expect` / `beforeEach` は import 不要。

## テストファイルの基本形

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

モジュールレベルの mutable な状態（Map など）はテスト間で共有される。テスト対象モジュール側にリセット関数を **export** し、`beforeEach` で呼ぶ。

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
- `env.DB.exec()` は複数文を `\n` 区切りで受け取れるが、prepared statement を使わないため
  **maintenance / one-shot 用**（公式ドキュメント）。テストの後片付けはこの用途に当たるので `exec` で問題ない
- テーブルを増やしたら `beforeEach` の削除対象にも追加する（消し忘れは他テストへの汚染になる）
- 外部キー制約がある場合は子テーブルから先に消す

setupFiles と `vitest.config.ts` 側の設定は `add-d1-drizzle` skill を参照。

## tsconfig

`tsconfig.worker.json` の `types` に以下2つが追加済であること：

```json
"types": [
  "vitest/globals",
  "@cloudflare/vitest-pool-workers/types"
]
```

- `vitest/globals` → `describe` / `it` / `expect` 等のグローバル型
- `@cloudflare/vitest-pool-workers/types` → `cloudflare:test` モジュールの型

## 実行

```bash
pnpm test          # vitest run（CI / 1回実行）
```

watch モードは使わない。
