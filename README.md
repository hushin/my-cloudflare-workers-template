# [プロジェクト名]

<!-- TODO: アプリのテンプレートなので書き換える -->

[このアプリの概要説明を書く]

## Tech Stack

| カテゴリ       | 技術                                                     |
| -------------- | -------------------------------------------------------- |
| フロントエンド | React 19, TypeScript                                     |
| ルーティング   | TanStack Router（file-based routing）                    |
| フォーム       | TanStack Form                                            |
| データ取得     | TanStack Query                                           |
| バックエンド   | Hono 4（Workers 上で動作）, zod, @hono/zod-validator     |
| ビルドツール   | Vite 7, @cloudflare/vite-plugin, @tanstack/router-plugin |
| デプロイ       | Wrangler 4, Cloudflare Workers                           |
| Lint / Format  | oxlint, oxfmt                                            |
| テスト         | Vitest, @cloudflare/vitest-pool-workers                  |
| Git hooks      | lefthook                                                 |
| パッケージ管理 | pnpm                                                     |
| バージョン管理 | mise                                                     |

## ディレクトリ構造

```
.
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
│       └── assets/
├── public/              # 静的アセット
├── dist/                # ビルド出力
├── docs/                # ドキュメント
├── wrangler.json        # Wrangler 設定
├── vite.config.ts
├── tsconfig.*.json
└── mise.toml            # ツールバージョン管理
```

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

# テスト
pnpm test             # vitest run（テスト実行）

# その他
pnpm cf-typegen       # Wrangler の型定義を再生成
npx wrangler tail     # Workers のリアルタイムログ
```
