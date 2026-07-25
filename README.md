# [プロジェクト名]

<!-- TODO: アプリのテンプレートなので書き換える -->

[このアプリの概要説明を書く]

## Tech Stack

| カテゴリ       | 技術                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| フロントエンド | React 19, TypeScript, shadcn/ui（base UI）, Tailwind CSS v4                                   |
| ルーティング   | TanStack Router（file-based routing）                                                         |
| フォーム       | TanStack Form                                                                                 |
| データ取得     | TanStack Query                                                                                |
| バックエンド   | Hono 4（Workers 上で動作）, zod, @hono/zod-validator                                          |
| ビルドツール   | Vite 7, @cloudflare/vite-plugin, @tanstack/router-plugin                                      |
| デプロイ       | Wrangler 4, Cloudflare Workers                                                                |
| Lint / Format  | oxlint, oxfmt                                                                                 |
| UI カタログ    | Storybook 10（@storybook/tanstack-react）, MSW                                                |
| テスト         | Vitest, @cloudflare/vitest-pool-workers, @storybook/addon-vitest（browser mode / Playwright） |
| Git hooks      | lefthook                                                                                      |
| パッケージ管理 | pnpm                                                                                          |
| バージョン管理 | mise                                                                                          |

## オプション構成（add-on）

**データベースと認証は既定では含まれていない。** 要らないアプリがあるため main は最小構成に保ち、
必要なアプリでだけ add-on として追加する。手順と貼り付け用の実ファイルは
`.agents/skills/<name>/` にまとまっているので、Claude Code に skill を適用させる。

| 追加したいもの              | skill             | 前提                    |
| --------------------------- | ----------------- | ----------------------- |
| Cloudflare D1 + Drizzle ORM | `add-d1-drizzle`  | なし                    |
| Better Auth（GitHub OAuth） | `add-better-auth` | `add-d1-drizzle` 適用済 |

これらの手順が腐らないよう、両方を適用しきった状態を `example/d1-auth` ブランチで維持している
（参照用。直接 merge して使うものではない）。

## ディレクトリ構造

```
.
├── .storybook/            # Storybook 設定（main.ts / preview.tsx）
├── .agents/skills/        # プロジェクト固有の skill（.claude/skills はここへの symlink）
├── src/
│   ├── worker/            # Hono Worker（API routes）
│   │   ├── index.ts       # Workers entrypoint（wrangler.json の main）
│   │   ├── routes/        # Hono route（method chain）
│   │   └── repositories/  # データアクセス（add-d1-drizzle 適用後）
│   ├── react-app/         # React SPA（Feature-Sliced Design）
│   │   ├── main.tsx
│   │   ├── app/           # provider / router 初期化、layouts
│   │   ├── routes/        # TanStack Router file-based routes（薄い route 定義）
│   │   ├── pages/         # 画面本体（URL セグメント単位のスライス）
│   │   └── shared/        # ui（shadcn/ui）, lib（cn, msw-hono）, api（hc クライアント）
│   └── shared/            # worker / react-app 共通コード
│       └── schemas/       # zod スキーマ
├── public/                # 静的アセット
├── dist/                  # ビルド出力
├── docs/                  # ドキュメント
├── wrangler.json          # Wrangler 設定
├── vite.config.ts
├── vitest.config.ts       # worker / storybook の 2 プロジェクト構成
├── steiger.config.ts      # FSD の構造 lint
├── tsconfig.*.json
└── mise.toml              # ツールバージョン管理
```

story（`*.stories.tsx`）と MSW モック（`*.mock.ts`）は対象ファイルの隣に置く。
`src/react-app/` のレイヤー構成の詳細は `.agents/skills/fsd/SKILL.md` を参照。

## よく使うコマンド

```bash
# 環境セットアップ
mise install          # Node, pnpm などのバージョンを揃える
mise run setup        # pnpm install + lefthook install

# 開発
pnpm dev              # 開発サーバー起動（localhost:5173）

# ビルド & デプロイ
pnpm build            # プロダクションビルド
pnpm preview          # ビルドしたものをローカルプレビュー
pnpm deploy           # Cloudflare Workers にデプロイ
pnpm check            # 型チェック + ビルド + dry-run

# Lint / Format
pnpm lint             # lint チェック
pnpm lint:fix         # lint 自動修正
pnpm fmt              # フォーマット
pnpm fmt:check        # フォーマットチェック

# テスト / Storybook
pnpm test             # vitest run（worker テスト + storybook interaction test）
pnpm test:watch       # vitest watch
pnpm storybook        # Storybook UI（localhost:6006）
pnpm build-storybook  # Storybook の静的ビルド

# その他
pnpm cf-typegen       # Wrangler の型定義を再生成
npx wrangler tail     # Workers のリアルタイムログ
```

## テスト

`pnpm test` は vitest の 2 プロジェクトをまとめて実行する。

| プロジェクト | 対象                             | 実行環境                                             |
| ------------ | -------------------------------- | ---------------------------------------------------- |
| worker       | `src/**/*.test.ts`               | `@cloudflare/vitest-pool-workers`（Workers runtime） |
| storybook    | `src/react-app/**/*.stories.tsx` | vitest browser mode（Playwright / chromium）         |

書き分けの方針:

- **UI（コンポーネント・ページ）** — 専用のテストファイルを作らず、**story の `play` 関数がそのまま
  interaction test** になる（[Storybook: Interaction testing](https://storybook.js.org/docs/writing-tests/interaction-testing)）。
  API は MSW でモックし、ハンドラは `src/react-app/shared/lib/msw-hono.ts` の `createHandler` で
  Hono の `AppType` から型付けして書く
- **util 関数・複雑な計算ロジック** — 対象の隣に `*.test.ts` を置いて直接テストする。
  ただし react-app 配下でも worker プロジェクト（Workers runtime）で実行されるため、
  `document` / `window` は使えない（DOM が要るものは story にする）
- **Hono route** — `src/worker/**/*.test.ts`

書き方の指針は `.agents/skills/storybook-testing/SKILL.md` にまとめてある。
初回実行がフレーキーになる既知の問題については `docs/storybook-vitest-first-run-flake.md` を参照。
