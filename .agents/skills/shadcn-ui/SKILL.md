---
name: shadcn-ui
description: Use when adding or modifying shadcn/ui components in this project. Covers base UI primitives, Tailwind v4 theming, component locations under src/react-app, and the render prop pattern for links. Trigger when the user mentions shadcn/ui, tailwind, button, card, input, or UI components.
---

# shadcn/ui Skill — base UI + Tailwind v4

このプロジェクトの shadcn/ui に関する規約。

## 構成

```
src/react-app/
  components/ui/    # shadcn CLI で追加したコンポーネント
  lib/utils.ts      # cn() ユーティリティ
  index.css         # Tailwind v4 + OKLch テーマ変数
components.json     # shadcn CLI 設定
```

## コンポーネントの追加

```bash
pnpm shadcn add button
```

- 生成先は `src/react-app/components/ui/`
- `components.json` の aliases は `@/react-app/...` を指す
- ルート `tsconfig.json` に `baseUrl` と `paths` が必要

## base UI の特徴

- `@base-ui/react` primitives を使用
- `asChild` は使えない。代わりに `render` prop を使う
- 例：リンクとして使う

```tsx
import { Link } from '@tanstack/react-router';
import { Button } from '@/react-app/components/ui/button';

<Button render={<Link to="/example-todo" />}>Go</Button>;
```

## スタイリング

- Tailwind CSS v4。`tailwind.config.*` は存在しない
- テーマトークンは `src/react-app/index.css` の CSS 変数で定義
- `dark` クラスでダークモード切り替え
- ユーティリティ：`cn(...)` で `clsx` + `tailwind-merge`

## 禁止・注意

- コンポーネントを `src/components/ui` などに移動しない
- shadcn CLI 生成後、import パスが `src/react-app/lib/utils` になっていないか確認し、必要なら `@/react-app/lib/utils` に修正
