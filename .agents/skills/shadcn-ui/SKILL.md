---
name: shadcn-ui
description: Use when adding or modifying shadcn/ui components in this project. Covers base UI primitives, Tailwind v4 theming, component locations under src/react-app/shared, and the render prop pattern for links. Trigger when the user mentions shadcn/ui, tailwind, button, card, input, or UI components.
---

# shadcn/ui Skill — base UI + Tailwind v4

このプロジェクトの shadcn/ui に関する規約。FSD の `shared` レイヤーに配置する（詳細は `fsd` skill）。

## 構成

```
src/react-app/shared/
  ui/            # shadcn CLI で追加したコンポーネント + index.ts（public API）
  lib/utils.ts   # cn() ユーティリティ（lib/index.ts で公開）
src/react-app/index.css  # Tailwind v4 + OKLch テーマ変数
components.json           # shadcn CLI 設定
```

## コンポーネントの追加

```bash
pnpm shadcn add button
```

- 生成先は `src/react-app/shared/ui/`
- `components.json` の aliases は `@/react-app/shared/...` を指す
- ルート `tsconfig.json` に `baseUrl` と `paths` が必要
- 追加後、`src/react-app/shared/ui/index.ts` に export を追加する（FSD の public API 規約。`fsd` skill 参照）

## base UI の特徴

- `@base-ui/react` primitives を使用
- `asChild` は使えない。代わりに `render` prop を使う
- 例：リンクとして使う

```tsx
import { Link } from '@tanstack/react-router';
import { Button } from '@/react-app/shared/ui';

<Button render={<Link to="/example-todo" />}>Go</Button>;
```

## スタイリング

- Tailwind CSS v4。`tailwind.config.*` は存在しない
- テーマトークンは `src/react-app/index.css` の CSS 変数で定義
- `dark` クラスでダークモード切り替え
- ユーティリティ：`cn(...)` で `clsx` + `tailwind-merge`（`@/react-app/shared/lib` から import）

## 禁止・注意

- コンポーネントを `src/components/ui` や `src/react-app/components` などに移動しない（`shared/ui` に統一）
- shadcn CLI 生成後、import パスが `src/react-app/lib/utils` のような旧パスになっていないか確認し、必要なら `@/react-app/shared/lib` に修正
- スライス（`pages/` 配下など）から `shared/ui` の内部ファイルに直接 import せず、`@/react-app/shared/ui`（index.ts 経由）を使う
