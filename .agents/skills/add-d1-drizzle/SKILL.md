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

これは **Cloudflare アカウントに実リソースを作る操作**なので、実行前にユーザーに確認する。

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
  （`worker-configuration.d.ts` は生成物なので手編集しない。lint / fmt からは除外済み）

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

`drizzle/meta/*.json` は drizzle-kit のフォーマットで出力されるため、そのままだと `fmt:check` が
落ちる。`.oxfmtrc.json` の `ignorePatterns` に `"drizzle/meta/*.json"` を **既存の配列へ追加**する
（配列ごと置き換えないこと。`worker-configuration.d.ts` などの既存の除外が消える）。

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

0.18 で変わった点が 2 つあるので、古いドキュメントのコピペに注意する。

- `readD1Migrations` は `@cloudflare/vitest-pool-workers` の **ルート**から import する
  （`@cloudflare/vitest-pool-workers/config` は存在しない）
- `cloudflare:test` の `env` は `Cloudflare.Env` 型で、**`ProvidedEnv` は廃止された**。
  テスト専用バインディングの型は `declare module 'cloudflare:test'` ではなく
  `declare global { namespace Cloudflare { interface Env { ... } } }` で足す
  （`assets/src/worker/test/env.d.ts` がその形）

テスト間の分離は `beforeEach` での `DELETE FROM <table>` で行う。
詳細は `testing` skill の「D1 を使う route のテスト」を参照。

### 8. 確認

```bash
pnpm check && pnpm test
```

## 新しいテーブルを足すとき

1. `src/worker/db/schema.ts` にテーブルを追加。**`WHERE` / `ORDER BY` に使う列には `index()` を張る**
   （インデックスの無い全表走査は D1 の読み取り行数課金に直結する）。時刻は
   `integer(..., { mode: 'timestamp_ms' })` で持つ（`text` + `current_timestamp` は秒精度で
   同一秒内の並び順が定まらない）
2. `src/worker/repositories/<name>.ts` にデータアクセスを書く（`Db` を第1引数で受ける形に揃える）。
   **一覧系には必ず `.limit()` を掛ける**
3. `src/worker/routes/<name>.ts` を作り `src/worker/index.ts` に `.route()` でマウント
4. `pnpm db:generate && pnpm db:migrate:local`
5. テストの `beforeEach` に新テーブルの `DELETE FROM` を足す
6. `unique()` を張った列があるなら、制約違反を捕まえて 409 を返す（下記）

## UNIQUE 制約違反を 409 にする

制約違反はアプリコードから到達しうるので、そのままだと 500 になる。route 側で捕まえる。

```ts
.post('/', zValidator('json', createSchema), async (c) => {
  try {
    return c.json(await someRepository.create(createDb(c.env), c.req.valid('json')), 201);
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Conflict' }, 409);
    }
    throw e;
  }
})
```

`add-better-auth` を適用すると `user.email` に UNIQUE が張られる点に注意。

## ハマりどころ

- **`migrations_dir` と `out` の不一致** — `wrangler d1 migrations apply` が「適用するものが無い」と
  言うときはまずここを疑う
- **リモートとローカルは別物** — `--local` で作ったテーブルは本番には無い。デプロイ前に
  `pnpm db:migrate` を忘れない
- **`D1Database.exec()` はアプリのクエリに使わない** — prepared statement を使わないため遅く、
  安全性も低い。公式ドキュメントも "Only use this method for maintenance and one-shot tasks
  (for example, migration jobs)" としている（複数文を `\n` 区切りで渡すことは可能）。
  アプリのクエリは drizzle 経由（= prepared statement）で書き、**複数の書き込みをアトミックに
  したいときは `db.batch()`**（batch は SQL transaction として実行され、失敗すると全体が rollback される）
- **`.returning()` を使わないと作成/更新後の行が取れない** — D1（SQLite）は `RETURNING` に対応済み
