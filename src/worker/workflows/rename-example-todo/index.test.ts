import {
  type ActiveExampleTodo,
  ExampleTodoId,
  ExampleTodoTitle,
  complete,
} from '@/worker/domain/example-todo';
import { EntityNotFound } from '@/worker/domain/errors';
import { errAsync, okAsync } from '@/worker/lib/result';
import { renameExampleTodoWorkflow } from './index';

const id = ExampleTodoId('todo-1')._unsafeUnwrap();
const title = ExampleTodoTitle('Buy milk')._unsafeUnwrap();
const createdAt = new Date('2026-01-01T00:00:00.000Z');

const active: ActiveExampleTodo = { id, title, createdAt, status: 'Active' };

describe('renameExampleTodoWorkflow', () => {
  it('タイトルを差し替えた状態を返す', async () => {
    const workflow = renameExampleTodoWorkflow(() => okAsync(active));

    const result = await workflow({ id: 'todo-1', title: 'Buy coffee' });

    expect(result._unsafeUnwrap().title).toBe('Buy coffee');
  });

  it('完了済みのものを改題しても完了状態は保たれる', async () => {
    const at = new Date('2026-02-03T00:00:00.000Z');
    const workflow = renameExampleTodoWorkflow(() => okAsync(complete(active, at)));

    const result = await workflow({ id: 'todo-1', title: 'Buy coffee' });

    const todo = result._unsafeUnwrap();
    expect(todo.status === 'Completed' && todo.completedAt).toEqual(at);
  });

  it('空タイトルは ValidationError（IO を呼ばずに落ちる）', async () => {
    let called = 0;
    const workflow = renameExampleTodoWorkflow(() => {
      called += 1;
      return okAsync(active);
    });

    const result = await workflow({ id: 'todo-1', title: '' });

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(called).toBe(0);
  });

  it('存在しない id は EntityNotFound', async () => {
    const workflow = renameExampleTodoWorkflow(() => errAsync(new EntityNotFound('not found')));

    const result = await workflow({ id: 'missing', title: 'Buy coffee' });

    expect(result._unsafeUnwrapErr().type).toBe('EntityNotFound');
  });
});
