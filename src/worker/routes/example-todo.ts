import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  exampleTodoCreateSchema,
  exampleTodoIdParamSchema,
  exampleTodoUpdateSchema,
} from '@/shared/schemas/example-todo';

type ExampleTodo = {
  id: string;
  title: string;
};

const todos = new Map<string, ExampleTodo>();

const app = new Hono<{ Bindings: Env }>()
  .get('/', (c) => {
    return c.json([...todos.values()]);
  })
  .post('/', zValidator('json', exampleTodoCreateSchema), (c) => {
    const { title } = c.req.valid('json');
    const todo: ExampleTodo = { id: crypto.randomUUID(), title };
    todos.set(todo.id, todo);
    return c.json(todo, 201);
  })
  .put(
    '/:id',
    zValidator('param', exampleTodoIdParamSchema),
    zValidator('json', exampleTodoUpdateSchema),
    (c) => {
      const { id } = c.req.valid('param');
      const { title } = c.req.valid('json');
      const existing = todos.get(id);
      if (!existing) return c.json({ error: 'Not Found' }, 404);
      const updated: ExampleTodo = { ...existing, title };
      todos.set(id, updated);
      return c.json(updated);
    },
  )
  .delete('/:id', zValidator('param', exampleTodoIdParamSchema), (c) => {
    const { id } = c.req.valid('param');
    const deleted = todos.delete(id);
    if (!deleted) return c.json({ error: 'Not Found' }, 404);
    return c.json({ id });
  });

// テスト用: todos Map を初期化する
export function resetTodos(): void {
  todos.clear();
}

export default app;
