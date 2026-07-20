# [プロジェクト名]

## WHAT — プロジェクトの目的と構造

<!-- TODO: アプリのテンプレートなので書き換える -->

個人用の Cloudflare Workers のWebアプリのテンプレートリポジトリ
[このアプリの概要説明]

```
src/
├── worker/index.ts     # Hono API routes、Workers entrypoint
└── react-app/          # React SPA
    ├── main.tsx
    ├── App.tsx
    └── assets/
```

- Workers entrypoint: `./src/worker/index.ts`（wrangler.json の `main` で指定）
- Static assets（build output）: `./dist/client`（SPA mode）
- 新規 API route は `src/worker/index.ts` の Hono インスタンスに追加する
- 新規 React コンポーネントは `src/react-app/` 以下に配置する

### テックスタック

Cloudflare Workers / Hono 4 / React 19 + TypeScript + Vite 7 / oxlint + oxfmt

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

### 型安全な Hono RPC の型付け

API 実装は以下2つのパターンで型安全を達成する。詳細は `docs/hono-rpc-types.md` を参照。

- **フロントエンド（レスポンス受信）**: `InferResponseType<typeof client.api.xxx.$get, 200>` で route のレスポンス型を直接導出する
- **Worker（リクエストバリデーション）**: `zValidator` + zod スキーマを使い、`c.req.valid("json")` で型安全に受け取る

## 詳細情報

特定技術の詳細は agent skills を使用する（`cloudflare`, `hono`, `workers-best-practices`, `wrangler`, `durable-objects`）。
