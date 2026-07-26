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
pnpm lint             # oxlint（.oxlintrc.json の typeCheck で型エラーも出る）+ steiger（FSD の構造 lint）
pnpm build            # tsc -b + vite build
pnpm storybook        # Storybook UI（localhost:6006）
pnpm build && pnpm deploy   # デプロイ
pnpm cf-typegen       # worker-configuration.d.ts 再生成
pnpm skills:check     # add-on skill の assets と参照実装ブランチのズレを検出
```

## 構造

```
src/
├── worker/            # Hono（Workers entrypoint は index.ts、wrangler.json の main）
│   ├── routes/        # 機能ごとの route。index.ts に .route() でマウント
│   └── repositories/  # データアクセス
├── react-app/         # React SPA（build 出力 ./dist/client、SPA mode）Feature-Sliced Design 採用
│   ├── app/           # FSD app レイヤー：bootstrap（provider・router 初期化）、layouts（RootLayout, Header）
│   ├── routes/        # TanStack Router file-based routes（route 定義のみの薄いファイル。app/pages を参照）
│   ├── pages/         # FSD pages レイヤー（画面本体、URL セグメント単位のスライス）
│   └── shared/        # FSD shared レイヤー：ui（shadcn/ui）、lib（cn, msw-hono）、api（hc クライアント）
└── shared/            # worker/react-app 共通コード（FSD の shared レイヤーとは別概念。混同注意）
    └── schemas/       # zod スキーマ（zValidator と併用、react-app からもそのまま import）
```

- 新規 API route → `src/worker/routes/` に追加し `src/worker/index.ts` に `.route()` でマウント
- 新規ページ → `src/react-app/pages/<page-name>/ui/` に画面本体を実装し、`src/react-app/routes/` に薄い route 定義ファイルを追加して参照する（詳細は `fsd` skill）
- `pages/<slice>/` の構成は FSD に従い、`steiger` (`pnpm lint` に含む) が構造違反を検出する
- story / MSW モックは画面本体ファイルの隣（`pages/<slice>/ui/`）に `*.stories.tsx` / `*.mock.ts`
- UI キット・共通ユーティリティ・API クライアントは `src/react-app/shared/` に置き、`index.ts`（public API）経由で import する
- サーバ・クライアント共通のロジック（zod スキーマ、型、定数など）は `src/shared/` に置く（react-app の FSD shared レイヤーとは別物）

## オプション構成（add-on）

**DB も認証もこのテンプレートには含まれていない**（要らないアプリがあるため既定では入れない）。
必要になったら add-on skill で追加する。skill には手順と貼り付け用の実ファイル（`assets/`）が入っている。

| 追加したいもの              | 適用する skill    | 前提                    |
| --------------------------- | ----------------- | ----------------------- |
| Cloudflare D1 + Drizzle ORM | `add-d1-drizzle`  | なし                    |
| Better Auth（GitHub OAuth） | `add-better-auth` | `add-d1-drizzle` 適用済 |

- 「データを永続化したい」「テーブルを追加したい」なら、まず `add-d1-drizzle` が適用済みか確認する。
  未適用なら手作りせず skill から適用する
- 適用済みかどうかは `src/worker/db/` と `wrangler.json` の `d1_databases` の有無で判断できる
- skill の手順が腐っていないことは、両方を適用しきった **参照実装ブランチ `example/d1-auth`** で担保する。
  main を更新したらこのブランチを rebase して `pnpm check && pnpm test` を通す
- `pnpm skills:check` で `assets/` と参照実装ブランチのズレを検出できる（skill を編集したら実行する）

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
| react-app のレイヤー構成（Feature-Sliced Design）       | `fsd` skill                                                                 |
| D1 + Drizzle ORM の追加                                 | `add-d1-drizzle` skill                                                      |
| 認証（Better Auth / GitHub OAuth）の追加                | `add-better-auth` skill                                                     |
