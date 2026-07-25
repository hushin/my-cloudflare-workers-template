---
name: add-d1-drizzle
description: Use when this app needs a database and D1 is not set up yet — adds Cloudflare D1 + Drizzle ORM to the template（binding、drizzle.config.ts、schema、repositories、migration、vitest の D1 setup まで）. Trigger when the user mentions D1, drizzle, drizzle-kit, database, DB, migration, スキーマ, データベース, 永続化, or asks to store data instead of an in-memory Map.
---

# add-d1-drizzle — D1 + Drizzle ORM を追加する

このテンプレートの **main は DB なしの最小構成**。DB が要るアプリでだけこの skill を適用する。
認証（Better Auth）も入れる場合は、**先にこの skill を適用してから** `add-better-auth` skill に進む。

適用前の状態: `src/worker/routes/example-todo.ts` がモジュールスコープの `Map` にデータを持ち、
`src/worker/repositories/` は存在しない。この skill は example-todo を **D1 版に置き換える**ことで
repository パターンの実例も同時に用意する。

`assets/` 以下は配置先と同じ相対パスで実ファイルが入っている。基本はそのままコピーして、
テーブル名・列だけアプリに合わせて書き換える。

## 手順

### 1. 依存を追加

`add-pnpm-package` skill の手順に従って追加する。

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

### 2. D1 を作成して binding する

```bash
pnpm wrangler d1 create <database-name>
```

出力された `database_id` を使って `wrangler.json` に追記する。

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "<database-name>",
    "database_id": "<出力された id>",
    "migrations_dir": "drizzle"
  }
]
```

- `migrations_dir` は drizzle.config.ts の `out` と一致させる。ズレると drizzle-kit が生成した
  SQL を wrangler が適用しない
- 追記後に `pnpm cf-typegen` を実行して `Env` に `DB: D1Database` を反映させる
  （`worker-configuration.d.ts` は生成物なので手編集しない）

### 3. drizzle.config.ts を置く

`assets/drizzle.config.ts` をリポジトリルートにコピーする。

型チェックの対象に入れるため `tsconfig.node.json` の `include` に追加する。

```jsonc
"include": ["vite.config.ts", "drizzle.config.ts"]
```

### 4. db / repository / route を配置

`assets/src/` 以下をそのまま `src/` にコピーする。

| ファイル                                  | 役割                                                             |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `src/worker/db/schema.ts`                 | drizzle のテーブル定義。ここがマイグレーションの source of truth |
| `src/worker/db/index.ts`                  | `createDb(env)` ファクトリと `Db` 型                             |
| `src/worker/repositories/example-todo.ts` | drizzle を使うデータアクセス                                     |
| `src/worker/routes/example-todo.ts`       | repository 経由に書き換えた route（既存を上書き）                |
| `src/worker/routes/example-todo.test.ts`  | D1 版のテスト（既存を上書き）                                    |
| `src/worker/test/apply-migrations.ts`     | テスト用の migration 適用                                        |
| `src/worker/test/env.d.ts`                | `cloudflare:test` の `TEST_MIGRATIONS` 型                        |

守るべき点:

- **db インスタンスをモジュールトップで作らない**。Workers の `env` はリクエストスコープなので、
  ハンドラの中で `createDb(c.env)` と都度生成する
- **route の method chain を切らない**。途中で変数に代入すると Hono RPC の型が失われる
  （`writing-hono-rpc-routes` skill）
- SQL は route に直接書かず repository に閉じ込める。route は zod バリデーションと
  ステータスコードの決定だけを担当する
- 旧実装にあった `resetTodos()` は不要になるので消す（テスト側は D1 の行削除に置き換わる）

### 5. package.json に scripts を追加

```jsonc
"db:generate": "drizzle-kit generate",
"db:migrate:local": "wrangler d1 migrations apply DB --local",
"db:migrate": "wrangler d1 migrations apply DB --remote",
"db:studio": "drizzle-kit studio"
```

`db:migrate` / `db:studio` はリモートの D1 を直接触るので、実行前に内容を確認する。

### 6. マイグレーションを生成して適用

```bash
pnpm db:generate        # schema.ts の差分から drizzle/ に SQL を生成
pnpm db:migrate:local   # ローカル（.wrangler 配下の SQLite）に適用
```

`drizzle/` は **コミット対象**（`routeTree.gen.ts` と同じく生成物だが追跡する）。
本番へは `pnpm db:migrate` で適用する。

### 7. vitest を D1 対応にする

`vitest.config.ts` に 3 箇所足す。ファイル全体を置き換えるのではなく差分で入れる。

```ts
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

// 1. Node 側で migration SQL を読む（top-level await）
const migrations = await readD1Migrations('./drizzle');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.json' },
      // 2. 読んだ migration をテスト用 Worker のバインディングとして渡す
      miniflare: {
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          globals: true,
          // 3. 各テストファイルの実行前に migration を適用する
          setupFiles: ['./src/worker/test/apply-migrations.ts'],
        },
      },
      // storybook プロジェクトはそのまま（MSW でモックするので D1 に触らない）
    ],
  },
});
```

`readD1Migrations` は `@cloudflare/vitest-pool-workers` のルートから import する
（古いドキュメントにある `@cloudflare/vitest-pool-workers/config` は 0.18 では存在しない）。

テスト間の分離は `beforeEach` での `DELETE FROM <table>` で行う。
詳細は `testing` skill の「D1 を使う route のテスト」を参照。

### 8. 確認

```bash
pnpm check && pnpm test
```

## 新しいテーブルを足すとき

1. `src/worker/db/schema.ts` にテーブルを追加
2. `src/worker/repositories/<name>.ts` にデータアクセスを書く（`Db` を第1引数で受ける形に揃える）
3. `src/worker/routes/<name>.ts` を作り `src/worker/index.ts` に `.route()` でマウント
4. `pnpm db:generate && pnpm db:migrate:local`
5. テストの `beforeEach` に新テーブルの `DELETE FROM` を足す

## ハマりどころ

- **`migrations_dir` と `out` の不一致** — `wrangler d1 migrations apply` が「適用するものが無い」と
  言うときはまずここを疑う
- **リモートとローカルは別物** — `--local` で作ったテーブルは本番には無い。デプロイ前に
  `pnpm db:migrate` を忘れない
- **`D1Database.exec()` は単文のみ** — 複数文をまとめて流したいときは `db.batch()` を使う
- **`.returning()` を使わないと作成/更新後の行が取れない** — D1（SQLite）は `RETURNING` に対応済み
