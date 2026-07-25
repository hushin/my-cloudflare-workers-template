---
name: storybook-testing
description: Use when writing or reviewing Storybook stories and interaction tests (play function) for the React app. Covers story/mock colocation, MSW handlers via createHandler, Testing Library query priority, findBy/waitFor usage, what to assert (behavior over implementation details), and running them with vitest browser mode. Trigger when the user mentions storybook, story, *.stories.tsx, interaction test, play function, MSW, or asks to test a React component/page.
---

# Storybook Testing Skill

**UI のテスト**は Storybook の story として書き、`@storybook/addon-vitest` が
vitest browser mode（chromium）で実行する。Worker 側のテストは別（`testing` skill）。

## story と .test.ts の使い分け

| 対象                                                      | 書き方                        |
| --------------------------------------------------------- | ----------------------------- |
| コンポーネント・ページ（描画、操作、状態分岐）            | `*.stories.tsx` の `play`     |
| util 関数・複雑な計算ロジック（DOM に触らない純粋な処理） | `*.test.ts`（対象の隣に置く） |

- 「レンダリングして操作する」ものは story にする。UI のために `render()` する専用テストファイルを作らない
- 逆に、日付整形・金額計算・並び替え・パース処理のような **純粋なロジックは `*.test.ts` で直接テストする**。
  UI 経由で間接的に確かめるより、入出力を直接 table 的に並べたほうが速く網羅できる
- 迷ったら「この関数は DOM を必要とするか？」で分ける

### react-app 配下の `*.test.ts` の実行環境に注意

`src/react-app/**/*.test.ts` は storybook プロジェクトではなく **worker プロジェクト
（`@cloudflare/vitest-pool-workers` / Workers runtime）** で実行される。`describe` / `it` /
`expect` はグローバルで使える（`globals: true`）が、**`document` / `window` は存在しない**
（`navigator.userAgent` は `Cloudflare-Workers`）。

- DOM や React に依存しない純粋な関数だけを `*.test.ts` にする
- DOM が要るなら story にするか、hooks なら story 用の小さなラッパーコンポーネントを作って story で検証する

## 構成と配置

```
.storybook/main.ts        # framework: @storybook/tanstack-react, addons
.storybook/preview.tsx    # QueryClientProvider decorator, mswLoader, a11y
vitest.config.ts          # storybook プロジェクト（browser mode, fileParallelism: false）
src/react-app/**/xxx.tsx          # 対象
src/react-app/**/xxx.stories.tsx  # story（隣に置く）
src/react-app/**/xxx.mock.ts      # MSW ハンドラ（隣に置く）
```

- story と mock は対象ファイルの隣に colocation する。`vite.config.ts` の
  `routeFileIgnorePattern` で `*.stories.tsx` / `*.mock.ts` はルート生成から除外済み。
- route の story を書くときは、`createFileRoute` に渡す component を **named export** して
  それを import する（`export function ExampleTodoPage()` のように）。Route オブジェクト自体は
  story にしない。

```bash
pnpm test          # worker + storybook の両プロジェクトを実行
pnpm storybook     # Storybook UI（localhost:6006）で story を見ながら開発
```

## story の基本形

```tsx
import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, waitFor } from 'storybook/test';
import { Button } from './button';

const meta = {
  component: Button,
  args: { children: 'Click me' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Click me' })).toBeDisabled();
  },
};
```

- 型は `satisfies Meta<typeof X>` + `StoryObj<typeof meta>`（args が型付けされる）
- テストユーティリティは **`storybook/test`** から import する（`@testing-library/*` を直接入れない）
- `canvas` / `userEvent` / `args` / `step` は play の引数から受け取る。`within(canvasElement)` や
  `userEvent.setup()` を自前で呼ばない
- play を書かなくても story は「レンダリングが落ちないこと」のスモークテストになる。
  バリアント違いだけの story に無理に play を足さない

## 何をテストするか

Kent C. Dodds の [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) と
[Testing Library の指針](https://testing-library.com/docs/guiding-principles)に従う。

> テストがソフトウェアの使われ方に似ているほど、テストは確信を与えてくれる。

**テストする**（ユーザーから見える振る舞い）

- 画面に何が表示されるか（テキスト、role、状態表示）
- 操作の結果どう変わるか（追加したら一覧に出る、削除したら消える、送信したらフォームが空になる）
- 表示状態の分岐（loading / empty / error / success）
- ユーザーに関係する属性（`aria-invalid`、`disabled`、`href`）

**テストしない**（実装の詳細）

- state 変数の中身、hooks の呼び出し回数、内部関数が呼ばれたか
- CSS クラス名（`toHaveClass('bg-primary')` のような検証。見た目の回帰は Chromatic/a11y addon の仕事）
- ライブラリ（TanStack Query / Form）自体の挙動
- リクエストが飛んだこと自体。検証するのは「その結果 UI がどうなったか」

実装の詳細に依存したテストは、リファクタで壊れる（false negative）一方、壊れたコードで通る
（false positive）ため、リファクタの安全網にならない。

## 要素の取り方（クエリの優先順位）

[Testing Library の priority](https://testing-library.com/docs/queries/about#priority) に従い、
上から順に使えるものを使う。

1. `getByRole`（+ `{ name }`）— 第一候補。アクセシビリティツリー経由なので実際の使われ方に最も近い
2. `getByLabelText` — フォーム項目
3. `getByPlaceholderText` — label がない入力（本来は label を付けるのが望ましい）
4. `getByText` — 非インタラクティブな表示テキスト
5. `getByDisplayValue` — 入力済みの値
6. `getByTestId` — **最後の手段**。上のどれでも取れないときだけ

役割で取れないなら、多くの場合テストではなくマークアップ側（label 不足、見出しレベル、
button ではなく div）に問題がある。テストのために `data-testid` を足す前に、まずマークアップを直す。

### getBy / queryBy / findBy

| 用途                   | 使うもの                               |
| ---------------------- | -------------------------------------- |
| 今あるはず             | `getBy*`（無ければその場で失敗）       |
| 非同期で現れるのを待つ | `await findBy*`                        |
| 無いことを検証する     | `queryBy*` + `not.toBeInTheDocument()` |

- **`waitFor` の中で `getBy*` を使わない。`findBy*` を使う**（`findBy` は内部で waitFor している）
- `await expect(await canvas.findByText('x')).toBeVisible()` のように、
  非同期取得は `findBy` で待ってから assert する
- 「消えること」の検証だけは `await waitFor(() => expect(canvas.queryByText('x')).not.toBeInTheDocument())`
- `waitFor` のコールバックには assertion を1つだけ置き、副作用（クリックや入力）を入れない
- `userEvent.*` はすべて `await` する

```tsx
// ❌ 現れるのを待つのに waitFor + getBy
await waitFor(() => expect(canvas.getByText('done')).toBeVisible());

// ✅
await expect(await canvas.findByText('done')).toBeVisible();
```

## API のモック（MSW）

`.storybook/preview.tsx` で `mswLoader` を有効化済み。ハンドラは story の
`parameters.msw.handlers` に渡す。

ハンドラは **`createHandler`（`@/react-app/shared/lib`）で定義する**。パス・メソッド・
input（param/query/json）・status・output がすべて Hono の `AppType` から型付けされるため、
API を変えるとモックが型エラーになる。route の型に存在しない status（500 など）を返したいときだけ
msw の `http` を直接使う。手本は `src/react-app/pages/example-todo/ui/ExampleTodoPage.mock.ts`。

```ts
export const exampleTodoHandlers = {
  success: successHandlers,
  loading: loadingHandlers, // await delay('infinite') で loading 表示を固定
  error: errorHandlers,
} as const satisfies Record<string, RequestHandler[]>;
```

### モックはインメモリストアで状態を持たせる

固定レスポンスを返すだけだと「追加したら一覧に出る」が検証できない。mock 側に `Map` を持ち、
POST/PUT/DELETE を反映させると、一連の操作をそのまま検証できる。

state を持つなら **必ずリセット関数を export し、`beforeEach` で呼ぶ**（story の実行順に
依存させない）。初期データを引数で差し替えられるようにしておくと Empty story も書ける。

```tsx
const meta = {
  component: ExampleTodoPage,
  beforeEach: () => {
    resetExampleTodos();
  },
  parameters: { msw: { handlers: exampleTodoHandlers.success } },
} satisfies Meta<typeof ExampleTodoPage>;

export const Empty: Story = {
  beforeEach: () => {
    resetExampleTodos([]);
  },
};
```

`beforeEach` はクリーンアップ関数を返せる（例: `MockDate.set()` → `return () => MockDate.reset()`）。
日時に依存する表示は `mockdate` で固定する。

## コールバックの検証には fn() を使う

props として渡すコールバックは `storybook/test` の `fn()` を args に置く。Storybook が自動で
spy にしてくれる（Actions パネルにも出る）。

```tsx
const meta = {
  component: TodoItem,
  args: { onDelete: fn() },
} satisfies Meta<typeof TodoItem>;

export const Delete: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).toHaveBeenCalledWith('todo-1');
  },
};
```

ただし page レベルでは、コールバックが呼ばれたことより **その結果 UI がどうなったか** を検証する。

## story の切り方

状態ごとに分ける。1つの story に何もかも詰め込まない。

- **表示状態**: `Default` / `Empty` / `Loading` / `FetchError`
- **操作**: `AddTodo` / `EditTodo` / `CancelEditTodo` / `DeleteTodo` / `AddTodoValidationError`

操作系の story は「ユーザーの一連の流れ」を1本として書いてよい（入力 → 送信 → 反映 → フォームリセット）。
1 assertion / 1 story にこだわって流れを分断しない。

## 重複と抽象化（AHA Testing）

[AHA Testing](https://kentcdodds.com/blog/aha-testing) の通り、**重複よりも誤った抽象化のほうが高くつく**。

- 各 story は単体で読んで何をしているか分かること。play の中身を共通ヘルパーに寄せすぎない
- 同じ3行が並ぶのは許容する。抽象化するのは「セットアップ」であって「アサーション」ではない
- 共有したいのは fixture / mock / reset 関数（`*.mock.ts`）のレベルまで

## 落とし穴

- **`retry` は preview.tsx で off 済み**。エラー表示の story が遅くならないため。QueryClient は
  story ごとに新規作成される（キャッシュが漏れない）
- **Router のラップは不要**。`@storybook/tanstack-react` が memory router で自動的にラップする。
  自前の RouterProvider decorator を足さない
- **初回実行のフレーキー**: コールドキャッシュ時に落ちることがある既知の上流問題。
  対策（`fileParallelism: false`、`optimizeDeps.include`）は入っている。再発時は
  `docs/storybook-vitest-first-run-flake.md` を読む。**失敗は確率的なので、1回通っただけで
  直った判断をしない**
- **a11y addon は `test: 'todo'`**（違反を表示するが CI は落とさない）。CI で落としたくなったら
  `.storybook/preview.tsx` を `'error'` にする
- Tailwind は `.storybook/main.ts` の `viteFinal` でも明示的に追加している（vitest 実行時に
  root の vite.config.ts だけでは効かないため）。消さないこと
