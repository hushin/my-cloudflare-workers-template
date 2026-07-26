---
name: add-dmmf
description: Use when the worker's business logic outgrows thin CRUD routes — restructures src/worker into the Domain Modeling Made Functional layering（domain / workflows / repositories / context、neverthrow の Result、branded 型、判別可能ユニオンでの状態遷移、D1 の batch まで）. Requires the add-d1-drizzle skill to be applied first. Trigger when the user mentions DMMF, Domain Modeling Made Functional, ドメインモデリング, 関数型スタイル, neverthrow, Result 型, ワークフロー, 値オブジェクト, branded type, or asks to move logic out of Hono routes.
---

# add-dmmf — worker を DMMF スタイルに再編する

このテンプレートの **main は薄い CRUD route の最小構成**（route の中にロジックが直接書いてある）。
状態遷移やドメインルールが増えてきたアプリでだけこの skill を適用する。

Domain Modeling Made Functional（Scott Wlaschin）の考え方に沿って、
**IO サンドイッチ**（IO でロード → 純粋なドメイン層で状態遷移 → IO で保存）に組み替える。

**前提: `add-d1-drizzle` skill が適用済みであること。** ドメインモデルを組むアプリは
永続化が要るので D1 前提で書いてある（`src/worker/db/` と `drizzle/` がある状態）。
`add-better-auth` は任意（適用済みなら手順 4 の注記を見る）。

適用後の構造:

```
src/worker/
├── index.ts              # app の合成と .route() のマウントのみ
├── context.ts            # ApplicationContext（env → drizzle client）と middleware
├── domain/               # 純粋。IO ゼロ。集約ごとにファイル
│   ├── errors.ts         #   ValidationError / EntityNotFound
│   └── <aggregate>.ts    #   型 + その型に適用する関数（同じファイルに置く）
├── workflows/            # ユースケース 1つ = 1ディレクトリ
│   └── <use-case>/
│       ├── types.ts      #   command / 中間状態 / domain event / error
│       ├── steps.ts      #   サブステップ（純粋関数、Result を返す）
│       └── index.ts      #   合成。IO 依存は高階関数で DI
├── repositories/         # context を受けて ResultAsync を返す関数
├── db/errors.ts          # D1Error（インフラのエラー。domain からは参照しない）
├── routes/               # IO 境界。load → workflow → save → match だけ
│   └── error.ts          #   エラー型 → HTTP ステータスの一元マッピング
└── lib/result.ts         # neverthrow の再 export + 共通ヘルパ
```

## 設計原則

1. **関数型スタイルを適用するのは `domain/` と `workflows/` だけ。** `routes/` `repositories/`
   `db/` は従来どおりの手続き的な作りでよい。全体としては普通のオニオンアーキテクチャ
2. **`class` は使わない。** ドメインオブジェクトは `type` で構造を定義し、振る舞いは別の関数にする
   （エラーだけは stack trace が欲しいので `Error` 継承の class）
3. **エラーは例外ではなく `Result`。** 同期は `Result`、非同期は `ResultAsync`（`neverthrow`）
4. **状態変更は「関数適用による状態遷移」**。遷移前が引数に、遷移後が戻り値に現れる。ミューテーション禁止
5. **ありえない状態を型で作れなくする。** 判別可能ユニオンを積極的に使う
6. **型定義とその型に適用する関数は同じファイル**（`types.ts` / `functions.ts` に機械的に割らない）
7. **中間状態の型は、実際に分岐が発生する箇所だけ**作る（全ステップ分は冗長）

## 手順

### 1. 依存を追加

`add-pnpm-package` skill の手順に従って追加する。

```bash
pnpm add neverthrow
```

### 2. lint / tsconfig を調整

`.oxlintrc.json` の `rules` に追加する（neverthrow がテスト用に提供する API を許可する）。

```jsonc
"no-underscore-dangle": ["error", { "allow": ["_unsafeUnwrap", "_unsafeUnwrapErr"] }]
```

`tsconfig.app.json` の `lib` を `ES2023` に上げる。

```jsonc
"lib": ["ES2023", "DOM", "DOM.Iterable"],
```

`src/react-app/shared/lib/msw-hono.ts` が `@/worker` の型を読むため、**worker のソースは
tsconfig.app のプログラムにも入る**。worker 側（`tsconfig.node.json` の `lib`）と揃えないと
`toSorted` などが解決できない。

### 3. ファイルを配置

`assets/src/` をそのまま `src/` にコピーする（`context.ts` `repositories/example-todo.ts`
`routes/example-todo.ts` `routes/example-todo.test.ts` `shared/schemas/example-todo.ts` と
react-app の 3 ファイルは既存を上書き）。

| ファイル                                  | 役割                                                           |
| ----------------------------------------- | -------------------------------------------------------------- |
| `src/worker/lib/result.ts`                | neverthrow の再 export + `okOr`                                |
| `src/worker/domain/errors.ts`             | `ValidationError` / `EntityNotFound`（`type` タグ付き）        |
| `src/worker/domain/example-todo.ts`       | 値オブジェクト・判別可能ユニオン・状態遷移の実例               |
| `src/worker/workflows/*/`                 | create / rename / change-status の 3 ユースケース              |
| `src/worker/repositories/example-todo.ts` | `(ctx) => (args) => ResultAsync` の形。行 ↔ ドメイン変換もここ |
| `src/worker/db/errors.ts`                 | `D1Error`                                                      |
| `src/worker/context.ts`                   | `ApplicationContext`（`{ db, now }`）と `contextMiddleware`    |
| `src/worker/routes/error.ts`              | エラー型 → HTTP の一元マッピング                               |
| `src/shared/schemas/example-todo.ts`      | `status` の DTO スキーマを追加（**brand は付けない**）         |
| `src/react-app/pages/example-todo/ui/*`   | 追加した `status` への追従と完了トグル                         |

### 4. index.ts に middleware を足す

`src/worker/index.ts` は auth の有無で形が変わるので assets には含めていない。
method chain は切らないこと（切ると RPC の型が失われる）。

```ts
import { type AppEnv, contextMiddleware } from './context';

const app = new Hono<AppEnv>()
  .basePath('/api')
  // リクエストごとに ApplicationContext を組み立てて c.var.context に載せる
  .use('*', contextMiddleware)
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/example-todo', exampleTodoRoute);
```

`add-better-auth` 適用済みなら Variables を合成し、`sessionMiddleware` → `contextMiddleware`
の順に置く。

```ts
type RootEnv = { Bindings: Env; Variables: AuthEnv['Variables'] & ContextVariables };
```

### 5. スキーマにドメインの状態を映す

`src/worker/db/schema.ts` の `exampleTodos` に、判別可能ユニオンに対応する列を足す。

```ts
    status: text('status', { enum: ['active', 'completed'] })
      .notNull()
      .default('active'),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
```

**DB はドメインの制約をすべては表現できない**（「completed なら completed_at が非 NULL」は
`CHECK` で書けても、ユニオンの網羅性までは守れない）。だから行 → ドメインの変換
（repository の `toExampleTodo`）が `Result` を返し、そこで検証して弾く。

```bash
pnpm db:generate && pnpm db:migrate:local
```

### 6. 確認

```bash
pnpm check && pnpm test
```

## 書き方の型

### 値オブジェクト（branded 型）

brand 用の symbol は **export しない**。こうすると型を作れるのは同じファイルのコンストラクタ
経由だけになり、生の `string` を紛れ込ませられなくなる。

```ts
const exampleTodoTitleBrand = Symbol();
export type ExampleTodoTitle = string & { [exampleTodoTitleBrand]: unknown };

// 型と同名のコンストラクタ。生成の失敗は Result で返す（throw しない）
export const ExampleTodoTitle = (raw: string): Result<ExampleTodoTitle, ValidationError> =>
  raw.length > 0 && raw.length <= 200
    ? ok(raw as ExampleTodoTitle)
    : err(new ValidationError('タイトルは1〜200文字にしてください'));
```

brand 付与の `as` は oxlint の `typescript/no-unsafe-type-assertion` に引っかかるので、
**コンストラクタの中だけ**行単位で disable する（それ以外の場所で `as` を書かないことが目的）。

### エンティティと状態遷移

```ts
export type ActiveExampleTodo = Base & { readonly status: 'Active' };
export type CompletedExampleTodo = Base & {
  readonly status: 'Completed';
  readonly completedAt: Date;
};
export type ExampleTodo = ActiveExampleTodo | CompletedExampleTodo;

// Active しか受け取らないので「二重完了」は型の時点で書けない
export const complete = (todo: ActiveExampleTodo, at: Date): CompletedExampleTodo => ({
  ...todo,
  status: 'Completed',
  completedAt: at,
});
```

`completedAt` は Completed のときにしか存在しないので Active 側に持たせない。

### ワークフロー

IO 依存は高階関数で DI し、本体は純粋に保つ。**エラー型は型引数で受け流す**。

```ts
// 依存の型。E を型引数にすると、repository が D1Error を足してもここを触らずに済む
export type FindExampleTodo<E> = (id: ExampleTodoId) => ResultAsync<ExampleTodo, E>;

export const renameExampleTodoWorkflow =
  <E>(findExampleTodo: FindExampleTodo<E>): RenameExampleTodoWorkflow<E> =>
  (command) =>
    ok(command)
      .andThen(validateCommand)
      .asyncAndThen(loadExampleTodo(findExampleTodo))
      .map(applyRename);
```

- 出力は「保存済みのオブジェクト」ではなく **ドメインイベント、または遷移後の状態**。
  永続化はワークフローの外（route）で行う
- 時刻は `ctx.now()` を route がコマンドに詰める（ワークフローに時計を持ち込まない）
- テストは D1 なしで書ける。依存はスタブを渡すだけ

### repository

```ts
export const findExampleTodoById =
  ({ db }: ApplicationContext) =>
  (id: ExampleTodoId): ResultAsync<ExampleTodo | null, ValidationError | D1Error> =>
    ResultAsync.fromPromise(
      db.select().from(exampleTodos).where(eq(exampleTodos.id, id)).get(),
      (e) => new D1Error(e),
    ).andThen((row) => (row ? toExampleTodo(row) : ok(null)));
```

**戻り値のエラー型に `ValidationError` が混ざるのは正しい**。行をドメインのコンストラクタに
通すので、DB に不正な行があれば失敗する。「なければエラー」版（`getXxx`）は `find` の上に薄く重ねる。

### route

```ts
.patch('/:id/status', zValidator('param', ...), zValidator('json', ...), async (c) => {
  const ctx = c.var.context;
  const workflow = changeExampleTodoStatusWorkflow(getExampleTodoById(ctx));

  const result = await ok({ id: c.req.valid('param').id, status: c.req.valid('json').status, at: ctx.now() })
    .asyncAndThen(workflow)
    .andThen(saveExampleTodo(ctx));

  return result.match(
    (todo) => c.json(toDto(todo)),
    (e) => {
      const { body, status } = toErrorResponse(e);
      return c.json(body, status);
    },
  );
})
```

- **DTO への変換（`toDto`）で brand を剥がす**。branded 型をレスポンスに載せると
  react-app 側がその型を作れなくなる
- **`shared/schemas` に branded 型を持ち込まない**。DTO → ドメイン型の変換は
  `workflows/*/steps.ts` の validate ステップに閉じ込める
- エラー型 → HTTP は `routes/error.ts` に集約し、各ハンドラで分岐を書かない

## D1 にトランザクションが無い問題

**D1 にインタラクティブトランザクションは無い**（`begin` / `commit` が使えない）。使えるのは
`db.batch()` だけで、これは複数のステートメントを 1 つの SQL transaction として実行し、
失敗すると全体が rollback される。そのため「複数の集約をまたぐ更新」は次の形にする。

1. ワークフローは**ドメインイベント（または遷移後の状態）の配列**を返す。永続化はしない
2. route がそれを drizzle のステートメントに変換し、**1 回の `db.batch()`** に流す

repository 関数が個別に `await` してしまうと、途中で失敗したときに部分適用の状態が残る。
example-todo は 1 テーブル 1 書き込みなので `batch` は使っていない。

## 新しい集約を足すとき

1. `domain/<aggregate>.ts` に型と状態遷移（IO ゼロ）
2. `db/schema.ts` にテーブル。`WHERE` / `ORDER BY` に使う列には `index()` を張る
3. `repositories/<name>.ts` にデータアクセスと行 ↔ ドメイン変換。一覧には `.limit()`
4. ユースケースがあれば `workflows/<use-case>/`（IO 依存は高階関数で受け取る）
5. `routes/<name>.ts` を作り `index.ts` に `.route()` でマウント
6. `pnpm db:generate && pnpm db:migrate:local`、テストの `beforeEach` に `DELETE FROM` を追加

## ハマりどころ

- **route のレスポンス型に union を増やすと react-app が壊れる** — 一覧 API のように
  クライアントが `res.json()` をそのまま使っている経路にエラー分岐を足すと、
  `{ error }` が混ざって `.map()` が型エラーになる。**データ不整合のようにクライアントに
  選択肢が無い失敗は `throwUnexpected` で 500 に落とし、レスポンス形式を増やさない**
- **middleware は `index.ts` で登録するので、route 単体に `app.request()` すると context が無い** —
  route のテストはマウント済みの app 経由（`/api/example-todo`）で書く
- **`tsc -b` はインクリメンタルでスキップされる** — 型エラーの有無を確かめるときは `tsc -b --force`
- **`Result` の失敗を確かめるテストは `_unsafeUnwrapErr().type` まで見る** —
  `isErr()` だけだと意図と違う理由で失敗しても通ってしまう
- **`.returning()` を忘れると作成 / 更新後の行が取れない** — `UPDATE` は対象が無くてもエラーに
  ならないので、`saveXxx` は `.returning()` の結果が空なら `EntityNotFound` を返す
- **`UNIQUE` 制約違反は `D1Error` になって 500 に落ちる** — 409 にしたいなら repository で
  `e.message.includes('UNIQUE constraint failed')` を見て専用のエラー型に写し、
  `routes/error.ts` にマッピングを足す（`assertNever` があるので漏れは型エラーになる）
