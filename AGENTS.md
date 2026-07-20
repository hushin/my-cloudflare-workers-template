# AGENTS.md

## Tech Stack

- **Runtime**: Cloudflare Workers (Wrangler 4)
- **Backend**: Hono 4
- **Frontend**: React 19 + TypeScript + Vite 7
- **Plugin**: @cloudflare/vite-plugin (dev/build/prod を統合)
- **Lint/Format**: oxlint + oxfmt (pre-commit で lefthook により自動実行)
- **Package Manager**: pnpm
- **Version Manager**: mise (Node 24, pnpm 11)

## ディレクトリ構造

```
src/
├── worker/index.ts     # Hono API routes、Workers entrypoint
└── react-app/          # React SPA
    ├── main.tsx
    ├── App.tsx
    └── assets/
```

- Workers entrypoint: `./src/worker/index.ts` (wrangler.json の `main` で指定)
- Static assets (build output): `./dist/client` (SPA mode)

## よく使うコマンド

```bash
pnpm dev              # Vite dev server (HMR)
pnpm build            # tsc + vite build
pnpm deploy           # wrangler deploy
pnpm check            # tsc + vite build + wrangler deploy --dry-run
pnpm lint:fix         # oxlint --fix
pnpm fmt              # oxfmt
pnpm cf-typegen       # wrangler types 生成
pnpm preview          # ビルド後 vite preview
```

## ファイル構成ルール

- 新規 API route は `src/worker/index.ts` の Hono インスタンスに追加する
- 新規 React コンポーネントは `src/react-app/` 以下に配置する
- 型定義: `worker-configuration.d.ts` は `pnpm cf-typegen` で自動生成（手編集禁止）

## デプロイ

```bash
pnpm build && pnpm deploy
```

## コードスタイル

- oxlint と oxfmt の設定に従う（pre-commit で自動チェック）
- TypeScript strict mode
- コミットメッセージは Conventional Commits に従う
