/**
 * Todo を新規作成するワークフロー。
 *
 * 外部の IO を必要としないので高階関数での DI は無く、そのまま純粋関数として export する
 * （IO 依存が要るワークフローの例は rename-example-todo / change-example-todo-status を参照）。
 */
import { ok } from '@/worker/lib/result';
import { toCreatedEvent, validateCommand } from './steps';
import type { CreateExampleTodoWorkflow } from './types';

export const createExampleTodoWorkflow: CreateExampleTodoWorkflow = (command) =>
  ok(command).andThen(validateCommand).map(toCreatedEvent);

export type * from './types';
