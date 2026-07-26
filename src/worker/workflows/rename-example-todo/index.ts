/**
 * Todo を改題するワークフロー。
 *
 * 既存の Todo を読む必要があるが、ワークフロー自身は repository を知らない。
 * `FindExampleTodo` を高階関数で受け取ることで、テストは D1 なしで書ける。
 */
import { ok } from '@/worker/lib/result';
import { applyRename, loadExampleTodo, validateCommand } from './steps';
import type { FindExampleTodo, RenameExampleTodoWorkflow } from './types';

export const renameExampleTodoWorkflow =
  <E>(findExampleTodo: FindExampleTodo<E>): RenameExampleTodoWorkflow<E> =>
  (command) =>
    ok(command)
      .andThen(validateCommand)
      .asyncAndThen(loadExampleTodo(findExampleTodo))
      .map(applyRename);

export type * from './types';
