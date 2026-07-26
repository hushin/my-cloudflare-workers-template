import type { ExampleTodo, ExampleTodoId, ExampleTodoTitle } from '@/worker/domain/example-todo';
import type { ValidationError } from '@/worker/domain/errors';
import type { ResultAsync } from '@/worker/lib/result';

export type RenameExampleTodoCommand = {
  readonly id: string;
  readonly title: string;
};

export type ValidatedRenameExampleTodoCommand = {
  readonly id: ExampleTodoId;
  readonly title: ExampleTodoTitle;
};

/**
 * ワークフローが必要とする IO 依存。実体は repository だが、ワークフローは
 * この関数型しか知らない（高階関数で受け取るので本体は純粋なまま）。
 *
 * エラー型 `E` は型引数にする。ワークフローは「自分が出すエラー」だけを宣言し、
 * 依存側のエラー（EntityNotFound や、D1 を使うなら D1Error）はそのまま通す。
 * こうしておくと repository の実装を差し替えてもワークフローを触らずに済む。
 */
export type FindExampleTodo<E> = (id: ExampleTodoId) => ResultAsync<ExampleTodo, E>;

/** このワークフロー自身が出しうるエラー + 依存側のエラー */
export type RenameExampleTodoError<E> = ValidationError | E;

/** 出力は遷移後の状態。永続化は route 側で行う。 */
export type RenameExampleTodoWorkflow<E> = (
  command: RenameExampleTodoCommand,
) => ResultAsync<ExampleTodo, RenameExampleTodoError<E>>;
