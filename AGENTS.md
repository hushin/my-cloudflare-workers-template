# [プロジェクト名]

## WHAT — プロジェクトの目的と構造

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

Cloudflare Workers / Hono 4 / React 19 + TypeScript + Vite 7 / oxlint + oxfmt / [追加パッケージ]

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
- TypeScript strict mode
- コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/ja/) に従う
- 型定義 `worker-configuration.d.ts` は `pnpm cf-typegen` で自動生成（手編集禁止）

### 環境変数

- 公開設定は `wrangler.json` の `vars`（コミット可）
- シークレットは `.dev.vars` / `wrangler secret put`（コミット不可）

### デプロイ

```bash
pnpm build && pnpm deploy
```

## 詳細情報（Progressive Disclosure）

タスクに応じて以下のファイルを読むこと。すべての情報を事前に知る必要はない。

| ファイル            | 内容                         | 必要なタスク           |
| ------------------- | ---------------------------- | ---------------------- |
| `docs/`             | [プロジェクト固有の設計資料] | 初めて触る領域の変更   |

特定技術の詳細は agent skills を使用する（`cloudflare`, `hono`, `workers-best-practices`, `wrangler`, `durable-objects`）。
