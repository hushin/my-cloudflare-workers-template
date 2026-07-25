---
name: fsd
description: Use when adding, moving, or reviewing screens/components under src/react-app. Covers the Feature-Sliced Design (FSD) layering this project uses for the React SPA — app/pages/shared layers, slice segments and public APIs, route file thinness, story/mock colocation, and the steiger structural linter. Trigger when the user mentions FSD, Feature-Sliced Design, app layer, pages layer, shared layer, slice, segment, steiger, or adds a new page/route.
---

# FSD Skill — react-app のレイヤー構成

`src/react-app` は [Feature-Sliced Design](https://fsd.how/)（[公式 skill](https://github.com/feature-sliced/skills/blob/master/feature-sliced-design/SKILL.md) 準拠）で構成する。
ドキュメント参照は **fsd.how**（feature-sliced.design ではない）。

現状導入済みのレイヤーは **app / pages / shared** の最小構成。widgets / features / entities は未導入
（公式ガイドでも「シンプルに始める、必要になったら抽出する」が原則。複数箇所で実際に使われ、境界が安定するまで作らない）。
構造の逸脱は [`steiger`](https://github.com/feature-sliced/steiger) で検出する。`pnpm lint` に含まれる。

## レイヤーと依存方向

```
app/     (プロバイダー初期化、ルーター設定、root layout)
   ↓ 参照してよい
pages/   (画面全体。スライスは URL セグメント単位)
   ↓ 参照してよい
shared/  (UI キット、共通ユーティリティ、API クライアント。ビジネスロジックなし)
```

- 上位レイヤーは下位レイヤーを import してよいが、逆は禁止（`shared/` が `pages/` を import するなど）
- `pages/<slice>/` 同士は互いを import しない（スライス間の水平参照禁止）。共通ロジックが必要になったら `shared/` に上げる
- 複数ページで使う大きな UI ブロックや、複数箇所で使うユーザー操作・ドメインモデルが実際に出てきたら、その時点で `widgets/` `features/` `entities/` の導入を検討する（今は時期尚早なので作らない。詳細は本 skill 末尾）

### routes/ は FSD レイヤーではない

TanStack Router の file-based routing の制約上 `src/react-app/routes/` はディレクトリ名を変えられない。
FSD 的には **app 相当だが別物**として扱い、route 定義（`createFileRoute` / `createRootRoute`）だけを書く。
provider 初期化や root layout の実体は `app/` に置き、`routes/__root.tsx` や `main.tsx` はそこから import するだけにする。

## ディレクトリ構成

```
src/react-app/
├── main.tsx                     # エントリーポイント。app/bootstrap を呼ぶだけ
├── routes/                      # route 定義のみ（薄い）
│   ├── __root.tsx                #   app/layouts の RootLayout を参照
│   ├── example-todo.tsx           #   pages/example-todo の ExampleTodoPage を参照
│   └── index.tsx                  #   pages/home の HomePage を参照
├── app/
│   ├── bootstrap/                # provider 初期化（"providers" は steiger の禁止セグメント名なので不可）
│   │   ├── AppProviders.tsx        #   QueryClientProvider + RouterProvider
│   │   ├── router.ts               #   createRouter + Register 型拡張
│   │   └── index.ts
│   └── layouts/
│       ├── RootLayout.tsx          #   Header + Outlet
│       ├── Header.tsx
│       ├── Header.stories.tsx
│       └── index.ts
├── pages/
│   ├── example-todo/
│   │   ├── ui/
│   │   │   ├── ExampleTodoPage.tsx
│   │   │   ├── ExampleTodoPage.stories.tsx
│   │   │   └── ExampleTodoPage.mock.ts
│   │   └── index.ts               # public API
│   └── home/
│       ├── ui/HomePage.tsx
│       └── index.ts
└── shared/
    ├── ui/                       # shadcn/ui コンポーネント
    │   ├── button.tsx, card.tsx, ...
    │   └── index.ts
    ├── lib/                      # cn, msw-hono などの共通ユーティリティ
    │   ├── utils.ts, msw-hono.ts
    │   └── index.ts
    └── api/                      # Hono RPC クライアント
        ├── client.ts
        └── index.ts
```

- スライス名はページの役割で決める（root ページは `home`、それ以外は URL セグメントに合わせる。例: `/example-todo` → `example-todo`）
- 各スライス・segment は最低 1 つの segment（`ui/` など）を持つ。segment 直下にファイルを直接置くのは禁止（`steiger` の `no-segmentless-slices` が検出する）
- 今は `ui` segment のみで十分。API 呼び出しロジックや状態管理が複雑になってきたら `api/` `model/` を切り出す
- 各スライス・segment は `index.ts` で public API を明示する。外部からは `index.ts` 経由（`@/react-app/pages/<slice>`, `@/react-app/shared/ui` など）でのみ import し、内部ファイルパスに直接依存しない
- story / MSW モックは画面本体ファイルの隣（同じ `ui/` segment 内）に `*.stories.tsx` / `*.mock.ts` として置く（`storybook-testing` skill 参照）

## 命名の注意（steiger `segments-by-purpose`）

segment 名は「何であるか（本質）」ではなく「何のためか（目的）」で付ける。次のような技術的・フレームワーク由来の名前は禁止される。

- 汎用: `components`, `helpers`, `utils`, `constants`, `types`
- React 由来: `hooks`, `context`, `providers`（`provider` を含む名前も NG）

このプロジェクトで `app/providers/` ではなく `app/bootstrap/` を使っているのはこのため。新しい segment を作るときも目的ベースの名前にする。

## route ファイルの書き方

```tsx
// src/react-app/routes/example-todo.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ExampleTodoPage } from '@/react-app/pages/example-todo';

export const Route = createFileRoute('/example-todo')({
  component: ExampleTodoPage,
});
```

```tsx
// src/react-app/routes/__root.tsx
import { createRootRoute } from '@tanstack/react-router';
import { RootLayout } from '@/react-app/app/layouts';

export const Route = createRootRoute({
  component: RootLayout,
});
```

route ファイルに `Route` 以外の export を増やさない（増やすと TanStack Router の code-splitting が効かなくなる）。

## 新規ページ追加の手順

1. `src/react-app/pages/<slice-name>/ui/` を作成
2. `<PageName>.tsx` に画面本体を実装。UI は `@/react-app/shared/ui`、API 呼び出しは `@/react-app/shared/api` から import
3. `index.ts` に `export { <PageName> } from './ui/<PageName>';` を書く
4. `src/react-app/routes/<slice-name>.tsx` を作成し、`@/react-app/pages/<slice-name>` から component を import して `Route` を定義するだけにする
5. story / MSW モックが必要なら `pages/<slice-name>/ui/` に colocation する
6. `pnpm lint`（内部で `steiger ./src/react-app` を実行）で構造違反がないか確認する

## steiger（FSD 構造 lint）

- 設定ファイル: `steiger.config.ts`（プロジェクトルート、`fsd.configs.recommended` をそのまま使用。現状カスタムルールなし）
- 対象は `src/react-app` のみ（`src/worker` や `src/shared` は FSD の対象外。`src/shared` は worker/react-app 共通コードで FSD の shared レイヤーとは別概念）
- 実行: `pnpm lint`（`oxlint && steiger ./src/react-app`）。単体で見たい場合は `npx steiger ./src/react-app`、自動修正できるルールは `npx steiger ./src/react-app --fix`
- 新しいルール違反が出たら、まず本当に直すべきか検討する。既存のディレクトリ構成が FSD 標準レイヤー名と衝突して誤検知する場合や、segment 名が `segments-by-purpose` に引っかかる場合は、リネームで解決できないか先に検討し、それでも無理なら `steiger.config.ts` に `files`/`rules` で該当ルールだけ無効化する

## 判断に迷ったら（公式ガイドの黄金ルール）

- 単一ページでしか使わないコードは `pages/<slice>/` に置く。「将来使うかも」で `shared/` や `entities/` に先出ししない
- ビジネスロジックのない再利用可能なインフラ（UI キット、日付フォーマット、API クライアント設定）だけが `shared/` 行き
- 複数箇所で **実際に** 使われていて境界が安定して初めて、`widgets/` `features/` `entities/` への抽出を検討する
- ファイル名はドメイン中心にする（`types.ts` `utils.ts` ではなく `user.ts` `fetch-profile.ts` のように）

## 将来 widgets / features / entities を導入する場合

- `widgets/`: 複数ページで再利用される大きな UI ブロックが実際に出てきたら
- `features/`: 複数ページ・複数 widget から呼ばれる「操作」（例: フォーム送信、いいねボタン）が重複してきたら
- `entities/`: ドメインオブジェクト（例: Todo, User）ごとの型・API・表示ロジックをまとめる必要が出てきたら。ただし CRUD だけなら `shared/api/` で十分（entity を作る理由にはならない）
- どのレイヤーも「今困っているか」で判断し、先回りして空ディレクトリを作らない
