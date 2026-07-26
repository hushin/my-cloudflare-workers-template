/**
 * Todo の完了 / 再開ワークフロー。
 *
 * 出力は遷移後の状態。永続化はワークフローの外（route）で行う。
 */
import { ok } from '@/worker/lib/result';
import { applyStatusChange, loadExampleTodo, validateCommand } from './steps';
import type { ChangeExampleTodoStatusWorkflow, FindExampleTodo } from './types';

export const changeExampleTodoStatusWorkflow =
  <E>(findExampleTodo: FindExampleTodo<E>): ChangeExampleTodoStatusWorkflow<E> =>
  (command) =>
    ok(command)
      .andThen(validateCommand)
      .asyncAndThen(loadExampleTodo(findExampleTodo))
      .map(applyStatusChange);

export type * from './types';
