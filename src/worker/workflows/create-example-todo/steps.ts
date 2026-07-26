import { ExampleTodoTitle } from '@/worker/domain/example-todo';
import type { ValidationError } from '@/worker/domain/errors';
import type { Result } from '@/worker/lib/result';
import type {
  CreateExampleTodoCommand,
  ExampleTodoCreated,
  ValidatedCreateExampleTodoCommand,
} from './types';

/** DTO 由来の生の値をドメインの値オブジェクトに変換する。brand が付くのはここだけ。 */
export const validateCommand = (
  command: CreateExampleTodoCommand,
): Result<ValidatedCreateExampleTodoCommand, ValidationError> =>
  ExampleTodoTitle(command.title).map((title) => ({ title }));

export const toCreatedEvent = (command: ValidatedCreateExampleTodoCommand): ExampleTodoCreated => ({
  kind: 'ExampleTodoCreated',
  title: command.title,
});
