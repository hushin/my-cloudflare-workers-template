import {
  type ExampleTodo,
  ExampleTodoId,
  ExampleTodoTitle,
  rename,
} from '@/worker/domain/example-todo';
import type { ValidationError } from '@/worker/domain/errors';
import { type Result, type ResultAsync } from '@/worker/lib/result';
import type {
  FindExampleTodo,
  RenameExampleTodoCommand,
  ValidatedRenameExampleTodoCommand,
} from './types';

export const validateCommand = (
  command: RenameExampleTodoCommand,
): Result<ValidatedRenameExampleTodoCommand, ValidationError> =>
  ExampleTodoId(command.id).andThen((id) =>
    ExampleTodoTitle(command.title).map((title) => ({ id, title })),
  );

/** IO を伴う依存は引数で受け取り、部分適用してステップの形に揃える。 */
export const loadExampleTodo =
  <E>(findExampleTodo: FindExampleTodo<E>) =>
  (
    command: ValidatedRenameExampleTodoCommand,
  ): ResultAsync<{ todo: ExampleTodo; title: ExampleTodoTitle }, E> =>
    findExampleTodo(command.id).map((todo) => ({ todo, title: command.title }));

export const applyRename = ({
  todo,
  title,
}: {
  todo: ExampleTodo;
  title: ExampleTodoTitle;
}): ExampleTodo => rename(todo, title);
