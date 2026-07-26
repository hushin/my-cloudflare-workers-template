import { createExampleTodoWorkflow } from './index';

describe('createExampleTodoWorkflow', () => {
  it('検証を通ると ExampleTodoCreated イベントを返す', () => {
    const result = createExampleTodoWorkflow({ title: 'Buy milk' });

    expect(result._unsafeUnwrap()).toEqual({ kind: 'ExampleTodoCreated', title: 'Buy milk' });
  });

  it('空タイトルは ValidationError', () => {
    const result = createExampleTodoWorkflow({ title: '' });

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
  });

  it('201文字以上は ValidationError', () => {
    const result = createExampleTodoWorkflow({ title: 'a'.repeat(201) });

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
  });
});
