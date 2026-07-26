import type { ExampleTodoTitle } from '@/worker/domain/example-todo';
import type { ValidationError } from '@/worker/domain/errors';
import type { Result } from '@/worker/lib/result';

/** route が DTO から組み立てる、まだ検証されていないコマンド */
export type CreateExampleTodoCommand = {
  readonly title: string;
};

/** 検証済みコマンド。ここから先は branded 型しか流れない */
export type ValidatedCreateExampleTodoCommand = {
  readonly title: ExampleTodoTitle;
};

/** ワークフローの出力。永続化はこのイベントを受けて route 側で行う */
export type ExampleTodoCreated = {
  readonly kind: 'ExampleTodoCreated';
  readonly title: ExampleTodoTitle;
};

export type CreateExampleTodoError = ValidationError;

export type CreateExampleTodoWorkflow = (
  command: CreateExampleTodoCommand,
) => Result<ExampleTodoCreated, CreateExampleTodoError>;
