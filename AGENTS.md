# [プロジェクト名]

<!-- TODO: アプリのテンプレートなので書き換える -->

個人用の Cloudflare Workers Web アプリのテンプレートリポジトリ。
[このアプリの概要説明]

Cloudflare Workers / Hono 4 / React 19 + Vite 7 / TanStack Router・Form・Query /
shadcn/ui（base UI）+ Tailwind v4 / zod / Vitest + Storybook 10 / oxlint + oxfmt

## 作業のルール

- パッケージマネージャは **pnpm**（npm ではない）。ツールは mise 管理（Node 24 / pnpm 11）
- **変更が一区切りしたら `pnpm check` と `pnpm test` を通す**（oxlint が型チェックも行うので、これで型エラーまで拾える）
- `worker-configuration.d.ts` は `pnpm cf-typegen` の生成物（手編集禁止）
- lint / format は lefthook が pre-commit で自動実行するので、整形のために手を入れない
- コミットメッセージは Conventional Commits
- シークレットは `.dev.vars` / `wrangler secret put`（コミット禁止）。公開設定は `wrangler.json` の `vars`

## コマンド

```bash
pnpm dev              # Vite dev server（localhost:5173）
pnpm check            # lint（型チェック込み）+ fmt:check + vite build + deploy --dry-run
pnpm test             # vitest run（worker + storybook）
pnpm lint             # oxlint（.oxlintrc.json の typeCheck で型エラーも出る）
pnpm build            # tsc -b + vite build
pnpm storybook        # Storybook UI（localhost:6006）
pnpm build && pnpm deploy   # デプロイ
pnpm cf-typegen       # worker-configuration.d.ts 再生成
```

## 構造

```
src/
├── worker/            # Hono（Workers entrypoint は index.ts、wrangler.json の main）
│   ├── routes/        # 機能ごとの route。index.ts に .route() でマウント
│   ├── schemas/       # zod スキーマ（zValidator と併用）
│   └── repositories/  # データアクセス
└── react-app/         # React SPA（build 出力 ./dist/client、SPA mode）
    ├── routes/        # TanStack Router file-based routes
    ├── components/    # UI（shadcn/ui は components/ui/）
    └── lib/           # cn / msw-hono など
```

- 新規 API route → `src/worker/routes/` に追加し `src/worker/index.ts` に `.route()` でマウント
- 新規ページ → `src/react-app/routes/` にファイル追加（file-based routing）
- story / MSW モックは対象ファイルの隣に `*.stories.tsx` / `*.mock.ts`

## テストの書き分け

| 対象                                            | 書き方                    |
| ----------------------------------------------- | ------------------------- |
| Hono route                                      | `src/worker/**/*.test.ts` |
| コンポーネント・ページの描画 / 操作 / 状態分岐  | `*.stories.tsx` の `play` |
| util 関数・複雑な計算ロジック（DOM に触らない） | 対象の隣に `*.test.ts`    |

UI のために `render()` する専用テストファイルは作らず story にする。

## ハマりどころ

- **Hono の method chain を切ると RPC の型が失われる**。route も `.route()` でのマウントも繋げたまま書く
- react-app 配下の `*.test.ts` も **Workers runtime で実行される**（`document` / `window` なし）。DOM が要るものは story にする
- `routeTree.gen.ts` は自動生成だが**コミット対象**（手編集はしない）
- Storybook のテストはコールドキャッシュの初回だけ落ちることがある（上流の既知問題。対策済み）

## 詳細情報

| 知りたいこと                                            | 参照先                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Hono RPC の型付け（`InferResponseType` / `zValidator`） | `docs/hono-rpc-types.md`, `writing-hono-rpc-routes` skill                   |
| Worker のテスト                                         | `testing` skill                                                             |
| story / interaction test / MSW                          | `storybook-testing` skill                                                   |
| UI コンポーネント追加                                   | `shadcn-ui` skill, `docs/shadcn-ui-setup.md`                                |
| Storybook テストの初回フレーキー                        | `docs/storybook-vitest-first-run-flake.md`                                  |
| Cloudflare 全般                                         | `cloudflare`, `workers-best-practices`, `wrangler`, `durable-objects` skill |
