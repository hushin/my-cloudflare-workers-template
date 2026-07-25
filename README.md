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

## ディレクトリ構造

```
.
├── .storybook/          # Storybook 設定（main.ts / preview.tsx）
├── src/
│   ├── worker/          # Hono Worker（API routes）
│   │   ├── index.ts
│   │   ├── routes/      # Hono route（method chain）
│   │   ├── schemas/     # zod スキーマ
│   │   └── repositories/# データアクセス
│   └── react-app/       # React フロントエンド
│       ├── main.tsx
│       ├── client.ts    # hc クライアント
│       ├── routes/      # TanStack Router file-based routes
│       ├── components/  # UI コンポーネント（shadcn/ui 含む）
│       └── lib/         # クライアント向けユーティリティ（cn など）
├── public/              # 静的アセット
├── dist/                # ビルド出力
├── docs/                # ドキュメント
├── wrangler.json        # Wrangler 設定
├── vite.config.ts
├── vitest.config.ts     # worker / storybook の 2 プロジェクト構成
├── tsconfig.*.json
└── mise.toml            # ツールバージョン管理
```

story（`*.stories.tsx`）と MSW モック（`*.mock.ts`）は対象ファイルの隣に置く。

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
  API は MSW でモックし、ハンドラは `src/react-app/lib/msw-hono.ts` の `createHandler` で
  Hono の `AppType` から型付けして書く
- **util 関数・複雑な計算ロジック** — 対象の隣に `*.test.ts` を置いて直接テストする。
  ただし react-app 配下でも worker プロジェクト（Workers runtime）で実行されるため、
  `document` / `window` は使えない（DOM が要るものは story にする）
- **Hono route** — `src/worker/**/*.test.ts`

書き方の指針は `.agents/skills/storybook-testing/SKILL.md` にまとめてある。
初回実行がフレーキーになる既知の問題については `docs/storybook-vitest-first-run-flake.md` を参照。
