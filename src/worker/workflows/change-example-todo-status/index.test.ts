/**
 * ワークフローのテスト。IO 依存は高階関数で差し込むので D1 も Worker の env も要らない。
 */
import {
  type ActiveExampleTodo,
  type ExampleTodo,
  ExampleTodoId,
  ExampleTodoTitle,
  complete,
} from '@/worker/domain/example-todo';
import { EntityNotFound } from '@/worker/domain/errors';
import { errAsync, okAsync } from '@/worker/lib/result';
import { changeExampleTodoStatusWorkflow } from './index';
import type { FindExampleTodo } from './types';

const id = ExampleTodoId('todo-1')._unsafeUnwrap();
const title = ExampleTodoTitle('Buy milk')._unsafeUnwrap();
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const at = new Date('2026-02-03T04:05:06.000Z');

const active: ActiveExampleTodo = { id, title, createdAt, status: 'Active' };

const findStub =
  (todo: ExampleTodo): FindExampleTodo<never> =>
  () =>
    okAsync(todo);

const notFoundStub: FindExampleTodo<EntityNotFound> = () =>
  errAsync(new EntityNotFound('not found'));

describe('changeExampleTodoStatusWorkflow', () => {
  it('active → completed で completedAt が入る', async () => {
    const workflow = changeExampleTodoStatusWorkflow(findStub(active));

    const result = await workflow({ id: 'todo-1', status: 'completed', at });

    const todo = result._unsafeUnwrap();
    expect(todo.status).toBe('Completed');
    expect(todo.status === 'Completed' && todo.completedAt).toEqual(at);
  });

  it('completed → active で completedAt が消える', async () => {
    const workflow = changeExampleTodoStatusWorkflow(findStub(complete(active, at)));

    const result = await workflow({ id: 'todo-1', status: 'active', at: new Date() });

    const todo = result._unsafeUnwrap();
    expect(todo.status).toBe('Active');
    expect(todo).not.toHaveProperty('completedAt');
  });

  it('すでに completed のものを completed にしても completedAt は動かない（冪等）', async () => {
    const completed = complete(active, at);
    const workflow = changeExampleTodoStatusWorkflow(findStub(completed));

    const result = await workflow({
      id: 'todo-1',
      status: 'completed',
      at: new Date('2026-12-31T00:00:00.000Z'),
    });

    const todo = result._unsafeUnwrap();
    expect(todo.status === 'Completed' && todo.completedAt).toEqual(at);
  });

  it('不正な status は ValidationError（IO を呼ばずに落ちる）', async () => {
    let called = 0;
    const workflow = changeExampleTodoStatusWorkflow(() => {
      called += 1;
      return okAsync(active);
    });

    const result = await workflow({ id: 'todo-1', status: 'archived', at });

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(called).toBe(0);
  });

  it('存在しない id は EntityNotFound', async () => {
    const workflow = changeExampleTodoStatusWorkflow(notFoundStub);

    const result = await workflow({ id: 'missing', status: 'completed', at });

    expect(result._unsafeUnwrapErr().type).toBe('EntityNotFound');
  });
});
