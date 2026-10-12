# [プロジェクト名]

<!-- TODO: アプリのテンプレートなので書き換える -->

[このアプリの概要説明]

Cloudflare Workers / Hono 4 / React 19 + Vite 8 / TanStack Router・Form・Query /
shadcn/ui（base UI）+ Tailwind v4 / zod / Vitest + Storybook 10 / oxlint + oxfmt

## 作業のルール

- パッケージマネージャは pnpm（mise で Node 24 / pnpm 12 を固定）
- 変更が一区切りしたら `pnpm check` と `pnpm test` を通す。型チェックは oxlint が兼ねるので `pnpm check` で型エラーまで見える
- `worker-configuration.d.ts` は `pnpm cf-typegen` の生成物。手で編集しない
- コミットメッセージは Conventional Commits
- シークレットは `.dev.vars` / `wrangler secret put`（コミットしない）。公開してよい設定は `wrangler.json` の `vars`
- 整形は oxfmt、lint の自動修正は `pnpm lint:fix` が行う（pre-commit の lefthook も同じものを走らせる）

## コマンド

```bash
pnpm check       # 検証: lint（型チェック込み）+ fmt:check + vite build + deploy --dry-run
pnpm test        # 検証: vitest run（worker + storybook）
pnpm lint        # lint だけ（oxlint + steiger + dependency-cruiser）
pnpm fmt         # 整形（oxfmt）。lint の自動修正は pnpm lint:fix
pnpm dev         # 開発サーバー（localhost:5173）
pnpm storybook   # Storybook（localhost:6006）
pnpm cf-typegen  # worker-configuration.d.ts を再生成
```

## 構造

```
src/
├── worker/            # Hono。entrypoint は index.ts（wrangler.json の main）
│   └── routes/        # 機能ごとの route。index.ts に .route() でマウント
├── react-app/         # React SPA（Feature-Sliced Design。構造は steiger が検査）
│   ├── app/           # provider / router の初期化、layouts
│   ├── routes/        # TanStack Router の file-based route（薄い定義だけ）
│   ├── pages/         # 画面本体（URL セグメント単位のスライス）
│   └── shared/        # ui（shadcn/ui）/ lib / api（hc クライアント）
└── shared/            # worker と react-app の共通コード（zod スキーマなど）
```

- 新規 API route → `src/worker/routes/` に追加し、`src/worker/index.ts` に `.route()` でマウントする
- 新規ページ → `src/react-app/pages/<name>/ui/` に本体を書いて `src/react-app/routes/` に薄い route 定義を足す（詳細は `fsd` skill）
- `src/shared/` と `src/react-app/shared/` は別物。前者は worker と react-app が共有するスキーマ・型、後者は FSD の shared レイヤー

## 依存の向き

依存の向きは `.dependency-cruiser.mjs` が規約を持ち、`pnpm lint` が検査する。

- `src/react-app` から `src/worker` を import してよいのは `import type` だけ（Hono RPC の型）。値を import すると worker の実装がクライアントのバンドルに入る
- `src/shared` は worker / react-app の両方から読まれる土台なので、DTO と定数だけに保つ
- `src/worker/repositories` から `src/worker/routes` を参照しない（データアクセスが HTTP 層を知ってはいけない）

## テスト

- UI（描画・操作・状態分岐）は `*.stories.tsx` の `play` で書く。UI のために `render()` する専用テストは作らない
- DOM に触らないロジックは対象の隣に `*.test.ts`、Hono route は `src/worker/**/*.test.ts`（詳細は `testing` / `storybook-testing` skill）

## ハマりどころ

- Hono の method chain を切ると RPC の型が失われる。route 定義も `.route()` でのマウントも繋げたまま書く
- `src/react-app` 配下の `*.test.ts` も Workers runtime で動く（`document` / `window` なし）。DOM が要るものは story にする
- `routeTree.gen.ts` は自動生成だがコミット対象。手で編集しない

## DB・認証（add-on）

main は DB なし・認証なしの最小構成。必要になったら手で作らず skill を適用する。

- Cloudflare D1 + Drizzle ORM → `add-d1-drizzle` skill（`src/worker/db/` と `src/worker/repositories/` が増える）
- Better Auth（GitHub OAuth）→ `add-better-auth` skill（`add-d1-drizzle` の適用が前提）
- 適用済みかは `src/worker/db/` と `wrangler.json` の `d1_databases` の有無で分かる

## 外部スキル

外部リポジトリ由来の skill（`cloudflare`, `wrangler`, `hono` など）は `skills-lock.json` に固定し、実体は `.agents/skills/` に復元する（`mise run setup` に含まれる）。

- 追加 / 削除 / 更新 → `pnpm skills add <owner>/<repo> --skill <name> -a pi -y` / `pnpm skills remove <name> -y` / `pnpm skills update -p`
- リポジトリが保守する skill を足したら、`.gitignore` の許可リストに `!/.agents/skills/<name>/` も足す

## 参照

- Hono RPC の型付け（`InferResponseType` / `zValidator`）→ `docs/hono-rpc-types.md`
- skill（`fsd` / `testing` / `storybook-testing` / `shadcn-ui` / `add-*` / `cloudflare` など）は description を見て、必要になったら読む
- テンプレート本体のメンテ（参照実装ブランチ、`skills:check`、Dependabot、アプリへの展開）→ `template-maintenance` skill
