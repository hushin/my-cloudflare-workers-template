import type { ExampleTodo, ExampleTodoId, ExampleTodoStatus } from '@/worker/domain/example-todo';
import type { ValidationError } from '@/worker/domain/errors';
import type { ResultAsync } from '@/worker/lib/result';

export type ChangeExampleTodoStatusCommand = {
  readonly id: string;
  /** DTO 側の表現。ドメインの 'Active' / 'Completed' への変換は validate ステップで行う */
  readonly status: string;
  /** 完了時刻。`ctx.now()` を route が詰める（ワークフローに時計を持ち込まない） */
  readonly at: Date;
};

export type ValidatedChangeExampleTodoStatusCommand = {
  readonly id: ExampleTodoId;
  readonly status: ExampleTodoStatus;
  readonly at: Date;
};

/** 遷移対象を読み終えた中間状態。ここから先が実際の分岐（完了 / 再開 / 変化なし）になる */
export type LoadedExampleTodo = {
  readonly todo: ExampleTodo;
  readonly status: ExampleTodoStatus;
  readonly at: Date;
};

/**
 * ワークフローが必要とする IO 依存。エラー型 `E` は型引数にして、
 * 依存側のエラー（EntityNotFound や D1Error）をそのまま通す。
 */
export type FindExampleTodo<E> = (id: ExampleTodoId) => ResultAsync<ExampleTodo, E>;

/** このワークフロー自身が出しうるエラー + 依存側のエラー */
export type ChangeExampleTodoStatusError<E> = ValidationError | E;

export type ChangeExampleTodoStatusWorkflow<E> = (
  command: ChangeExampleTodoStatusCommand,
) => ResultAsync<ExampleTodo, ChangeExampleTodoStatusError<E>>;
