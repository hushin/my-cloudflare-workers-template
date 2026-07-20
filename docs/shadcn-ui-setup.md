# shadcn/ui セットアップガイド

このプロジェクトでは shadcn/ui（base UI プリセット）+ Tailwind CSS v4 を使用している。

## 構成

```
src/react-app/
  components/ui/    # shadcn/ui コンポーネント
  lib/utils.ts      # cn() ユーティリティ
  index.css         # Tailwind v4 + テーマ変数
components.json     # shadcn CLI 設定
vite.config.ts      # @tailwindcss/vite プラグイン
```

## コンポーネントを追加する

```bash
npx shadcn@latest add button
```

エイリアスは `components.json` で `src/react-app/...` に向けているため、自動的に `src/react-app/components/ui/` 以下に生成される。

## base UI について

- Radix UI の代わりに `@base-ui/react` を使用
- `Button` などの primitive は `render` prop で要素を差し替える（Radix の `asChild` と同様）
- 例：`render={<Link to="/path" />}`

## 注意点

- `components.json` の alias は `@/` 形式で記述し、ルート `tsconfig.json` の `baseUrl` / `paths` と対応させる
- Tailwind v4 では `tailwind.config.*` は不要。テーマは `src/react-app/index.css` の CSS 変数で定義する
