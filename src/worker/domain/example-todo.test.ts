import {
  type ActiveExampleTodo,
  type CompletedExampleTodo,
  ExampleTodoId,
  ExampleTodoTitle,
  complete,
  rename,
  reopen,
} from './example-todo';

const id = ExampleTodoId('todo-1')._unsafeUnwrap();
const title = ExampleTodoTitle('Buy milk')._unsafeUnwrap();
const createdAt = new Date('2026-01-01T00:00:00.000Z');

const active: ActiveExampleTodo = { id, title, createdAt, status: 'Active' };

describe('ExampleTodoTitle', () => {
  it('1〜200文字なら Ok', () => {
    expect(ExampleTodoTitle('a').isOk()).toBe(true);
    expect(ExampleTodoTitle('a'.repeat(200)).isOk()).toBe(true);
  });

  // 失敗を期待するときは isErr() で止めず、どのエラーかまで確認する
  it('空文字と201文字以上は ValidationError（throw しない）', () => {
    expect(ExampleTodoTitle('')._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(ExampleTodoTitle('a'.repeat(201))._unsafeUnwrapErr().type).toBe('ValidationError');
  });
});

describe('ExampleTodoId', () => {
  it('空文字は ValidationError', () => {
    expect(ExampleTodoId('')._unsafeUnwrapErr().type).toBe('ValidationError');
  });
});

describe('状態遷移', () => {
  it('complete は completedAt を持つ Completed を返す', () => {
    const at = new Date('2026-02-03T04:05:06.000Z');
    const completed = complete(active, at);

    expect(completed.status).toBe('Completed');
    expect(completed.completedAt).toEqual(at);
    // 元のオブジェクトは変更されない
    expect(active.status).toBe('Active');
  });

  it('reopen は completedAt を落として Active に戻す', () => {
    const completed = complete(active, new Date());
    const reopened = reopen(completed);

    expect(reopened.status).toBe('Active');
    expect(reopened).not.toHaveProperty('completedAt');
    expect(reopened.id).toBe(active.id);
  });

  it('rename は状態を保ったままタイトルだけ差し替える', () => {
    const completed: CompletedExampleTodo = complete(active, new Date());
    const renamed = rename(completed, ExampleTodoTitle('Buy coffee')._unsafeUnwrap());

    expect(renamed.title).toBe('Buy coffee');
    // 戻り値の型も CompletedExampleTodo のまま
    expect(renamed.completedAt).toEqual(completed.completedAt);
  });
});
