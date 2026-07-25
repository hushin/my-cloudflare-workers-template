# [プロジェクト名]

## WHAT — プロジェクトの目的と構造

<!-- TODO: アプリのテンプレートなので書き換える -->

個人用の Cloudflare Workers のWebアプリのテンプレートリポジトリ
[このアプリの概要説明]

```
src/
├── worker/
│   ├── index.ts         # Hono API routes（method chain）、Workers entrypoint
│   ├── routes/          # 機能ごとの Hono route（method chain, .route() でマウント）
│   ├── schemas/         # zod スキーマ（zValidator と併用）
│   └── repositories/    # データアクセス
└── react-app/           # React SPA
    ├── main.tsx          # RouterProvider / QueryClientProvider の起点
    ├── client.ts          # hc<AppType> クライアント
    ├── routes/            # TanStack Router file-based routes（__root.tsx / *.stories.tsx / *.mock.ts を colocation）
    ├── components/        # UI コンポーネント（shadcn/ui 含む）
    └── lib/               # クライアント向けユーティリティ（cn など）
```

- Workers entrypoint: `./src/worker/index.ts`（wrangler.json の `main` で指定）
- Static assets（build output）: `./dist/client`（SPA mode）
- 新規 API route は `src/worker/routes/` にファイルを追加し、`src/worker/index.ts` の Hono インスタンスに `.route()` でマウントする（method chain を維持すること。詳細は `docs/hono-rpc-types.md`）
- 新規ページは `src/react-app/routes/` にファイルを追加する（TanStack Router の file-based routing、`routeTree.gen.ts` は自動生成されるためコミット対象）
- story と MSW モックは対象ファイルの隣に `*.stories.tsx` / `*.mock.ts` として置く（vite.config.ts の `routeFileIgnorePattern` でルート生成から除外済み）
- MSW ハンドラは `createHandler`（`src/react-app/lib/msw-hono.ts`）で定義する。パス・メソッド・input・status・output が Hono の `AppType` から型付けされる（例: `src/react-app/routes/example-todo.mock.ts`）

### テックスタック

Cloudflare Workers / Hono 4 / React 19 + TypeScript + Vite 7 / TanStack Router（file-based routing）/ TanStack Form / TanStack Query / shadcn/ui（base UI）+ Tailwind CSS v4 / zod + @hono/zod-validator / Vitest + @cloudflare/vitest-pool-workers + Storybook 10（interaction test, MSW）/ oxlint + oxfmt

## HOW — このプロジェクトでの作業方法

### パッケージマネージャ

`pnpm` を使用（npm ではない）。ツールバージョンは `mise` で管理（Node 24, pnpm 11）。

### よく使うコマンド

```bash
pnpm dev              # Vite dev server（HMR, localhost:5173）
pnpm build            # tsc + vite build
pnpm deploy           # wrangler deploy
pnpm check            # tsc + vite build + wrangler deploy --dry-run
pnpm lint:fix         # oxlint --fix
pnpm fmt              # oxfmt
pnpm cf-typegen       # wrangler types 生成（worker-configuration.d.ts）
pnpm preview          # ビルド後 vite preview
pnpm test             # vitest run（worker テスト + storybook interaction test）
pnpm storybook        # Storybook UI（localhost:6006）
```

### コードスタイル

- oxlint と oxfmt の設定に従う（pre-commit で lefthook により自動実行）
- コミットメッセージは Conventional Commits に従う
- 型定義 `worker-configuration.d.ts` は `pnpm cf-typegen` で自動生成（手編集禁止）

### 環境変数

- 公開設定は `wrangler.json` の `vars`（コミット可）
- シークレットは `.dev.vars` / `wrangler secret put`（コミット不可）

### デプロイ

```bash
pnpm build && pnpm deploy
```

### テスト

`pnpm test` は 2 つの vitest プロジェクトを実行する。

- **worker**: `@cloudflare/vitest-pool-workers` で Workers runtime 上で `*.test.ts` を実行 → `testing` skill
- **storybook**: `@storybook/addon-vitest` が story の `play` を vitest browser mode（chromium）で実行（`src/react-app/**/*.stories.tsx`）→ `storybook-testing` skill

書き分けは以下の通り。

| 対象                                            | 書き方                                           |
| ----------------------------------------------- | ------------------------------------------------ |
| Hono route                                      | `src/worker/**/*.test.ts`                        |
| コンポーネント・ページの描画 / 操作 / 状態分岐  | `*.stories.tsx` の `play`（API は MSW でモック） |
| util 関数・複雑な計算ロジック（DOM に触らない） | 対象の隣に `*.test.ts`                           |

UI のために `render()` する専用テストファイルは作らず story にする。逆に純粋なロジックは
UI 経由ではなく `*.test.ts` で直接テストしてよい。ただし `src/react-app/**/*.test.ts` も
Workers runtime で走るため `document` / `window` は使えない（DOM が要るなら story にする）。

### 型安全な Hono RPC の型付け

API 実装は以下2つのパターンで型安全を達成する。詳細は `docs/hono-rpc-types.md` を参照。

- **フロントエンド（レスポンス受信）**: `InferResponseType<typeof client.api.xxx.$get, 200>` で route のレスポンス型を直接導出する
- **Worker（リクエストバリデーション）**: `zValidator` + zod スキーマを使い、`c.req.valid("json")` で型安全に受け取る

## 詳細情報

特定技術の詳細は agent skills を使用する（`cloudflare`, `hono`, `workers-best-practices`, `wrangler`, `durable-objects`, `testing`, `storybook-testing`, `shadcn-ui`）。
