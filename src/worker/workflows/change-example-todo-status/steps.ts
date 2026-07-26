import {
  type ExampleTodo,
  ExampleTodoId,
  type ExampleTodoStatus,
  complete,
  reopen,
} from '@/worker/domain/example-todo';
import { ValidationError } from '@/worker/domain/errors';
import { type Result, type ResultAsync, err, ok } from '@/worker/lib/result';
import type {
  ChangeExampleTodoStatusCommand,
  FindExampleTodo,
  LoadedExampleTodo,
  ValidatedChangeExampleTodoStatusCommand,
} from './types';

const toDomainStatus = (raw: string): Result<ExampleTodoStatus, ValidationError> => {
  switch (raw) {
    case 'active':
      return ok('Active');
    case 'completed':
      return ok('Completed');
    default:
      return err(new ValidationError(`不正な status です: ${raw}`));
  }
};

export const validateCommand = (
  command: ChangeExampleTodoStatusCommand,
): Result<ValidatedChangeExampleTodoStatusCommand, ValidationError> =>
  ExampleTodoId(command.id).andThen((id) =>
    toDomainStatus(command.status).map((status) => ({ id, status, at: command.at })),
  );

export const loadExampleTodo =
  <E>(findExampleTodo: FindExampleTodo<E>) =>
  (command: ValidatedChangeExampleTodoStatusCommand): ResultAsync<LoadedExampleTodo, E> =>
    findExampleTodo(command.id).map((todo) => ({
      todo,
      status: command.status,
      at: command.at,
    }));

/**
 * 状態遷移を適用する。すでに目的の状態なら何もしない（冪等）。
 * `complete` は Active しか受け取らないので、二重完了は型の時点で書けない。
 */
export const applyStatusChange = ({ todo, status, at }: LoadedExampleTodo): ExampleTodo => {
  if (status === 'Completed') {
    return todo.status === 'Completed' ? todo : complete(todo, at);
  }
  return todo.status === 'Active' ? todo : reopen(todo);
};
