import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createDb } from '@/worker/db';
import { exampleTodoRepository } from '@/worker/repositories/example-todo';
import {
  exampleTodoCreateSchema,
  exampleTodoIdParamSchema,
  exampleTodoUpdateSchema,
} from '@/shared/schemas/example-todo';

// method chain を切ると RPC の型が失われるので、必ず繋げたまま書く
const app = new Hono<{ Bindings: Env }>()
  .get('/', async (c) => {
    const todos = await exampleTodoRepository.list(createDb(c.env));
    return c.json(todos);
  })
  .post('/', zValidator('json', exampleTodoCreateSchema), async (c) => {
    const { title } = c.req.valid('json');
    const todo = await exampleTodoRepository.create(createDb(c.env), title);
    return c.json(todo, 201);
  })
  .put(
    '/:id',
    zValidator('param', exampleTodoIdParamSchema),
    zValidator('json', exampleTodoUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { title } = c.req.valid('json');
      const updated = await exampleTodoRepository.update(createDb(c.env), id, title);
      if (!updated) return c.json({ error: 'Not Found' }, 404);
      return c.json(updated);
    },
  )
  .delete('/:id', zValidator('param', exampleTodoIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const deleted = await exampleTodoRepository.remove(createDb(c.env), id);
    if (!deleted) return c.json({ error: 'Not Found' }, 404);
    return c.json({ id: deleted.id });
  });

export default app;
