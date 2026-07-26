/**
 * ExampleTodo 集約。
 *
 * IO を一切含まない。drizzle / hono / @cloudflare/* を import してはいけない。
 * 型定義と、その型に適用する関数を同じファイルに置く。
 */
import { type Result, err, ok } from '@/worker/lib/result';
import { ValidationError } from './errors';

// --- 値オブジェクト ---
// brand 用の symbol は export しない。こうすると型を作れるのは同じファイルの
// コンストラクタ経由だけになり、生の string を紛れ込ませられなくなる。

const exampleTodoIdBrand = Symbol();
export type ExampleTodoId = string & { [exampleTodoIdBrand]: unknown };

/**
 * 型と同名のコンストラクタ。生成の失敗は Result で返す（throw しない）。
 * brand を付ける type assertion はこのコンストラクタの中だけに閉じ込める。
 */
export const ExampleTodoId = (raw: string): Result<ExampleTodoId, ValidationError> =>
  raw.length > 0
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as ExampleTodoId)
    : err(new ValidationError('id を指定してください'));

const exampleTodoTitleBrand = Symbol();
export type ExampleTodoTitle = string & { [exampleTodoTitleBrand]: unknown };

export const TITLE_MAX_LENGTH = 200;

export const ExampleTodoTitle = (raw: string): Result<ExampleTodoTitle, ValidationError> =>
  raw.length > 0 && raw.length <= TITLE_MAX_LENGTH
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as ExampleTodoTitle)
    : err(new ValidationError(`タイトルは1〜${TITLE_MAX_LENGTH}文字にしてください`));

// --- エンティティ ---
// 状態を判別可能ユニオンで表現する。completedAt は Completed のときにしか
// 存在しないので、Active 側には持たせない（ありえない状態を作れなくする）。

type ExampleTodoBase = {
  readonly id: ExampleTodoId;
  readonly title: ExampleTodoTitle;
  readonly createdAt: Date;
};

export type ActiveExampleTodo = ExampleTodoBase & {
  readonly status: 'Active';
};

export type CompletedExampleTodo = ExampleTodoBase & {
  readonly status: 'Completed';
  readonly completedAt: Date;
};

export type ExampleTodo = ActiveExampleTodo | CompletedExampleTodo;

export type ExampleTodoStatus = ExampleTodo['status'];

// --- 状態遷移 ---
// 遷移前の状態が引数に、遷移後の状態が戻り値に現れる。ミューテーションはしない。

/** 完了する。Active なものしか受け取らないので「二重完了」は型で書けない。 */
export const complete = (todo: ActiveExampleTodo, at: Date): CompletedExampleTodo => ({
  ...todo,
  status: 'Completed',
  completedAt: at,
});

/** 未完了に戻す。completedAt は分解代入で落とす。 */
export const reopen = ({ id, title, createdAt }: CompletedExampleTodo): ActiveExampleTodo => ({
  id,
  title,
  createdAt,
  status: 'Active',
});

/** 改題する。完了状態は保たれるので、入力の状態をそのまま返す。 */
export const rename = <T extends ExampleTodo>(todo: T, title: ExampleTodoTitle): T => ({
  ...todo,
  title,
});
