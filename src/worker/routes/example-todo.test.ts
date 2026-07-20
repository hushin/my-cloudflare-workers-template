import { z } from 'zod';
import { env } from 'cloudflare:test';
import app, { resetTodos } from './example-todo';

const todoSchema = z.object({ id: z.string(), title: z.string() });
const todosSchema = z.array(todoSchema);

describe('example-todo routes', () => {
  beforeEach(() => {
    resetTodos();
  });

  it('GET / returns empty array initially', async () => {
    const res = await app.request('/', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST / creates a todo and returns 201', async () => {
    const res = await app.request(
      '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Buy milk' }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(await res.json());
    expect(todo.title).toBe('Buy milk');
  });

  it('POST / with empty title returns 400', async () => {
    const res = await app.request(
      '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('POST / with missing title returns 400', async () => {
    const res = await app.request(
      '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  describe('with an existing todo', () => {
    let todoId: string;

    beforeEach(async () => {
      resetTodos();
      const res = await app.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Original title' }),
        },
        env,
      );
      const todo = todoSchema.parse(await res.json());
      todoId = todo.id;
    });

    it('GET / returns array with the todo', async () => {
      const res = await app.request('/', {}, env);
      expect(res.status).toBe(200);
      const todos = todosSchema.parse(await res.json());
      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe(todoId);
      expect(todos[0].title).toBe('Original title');
    });

    it('PUT /:id updates the todo', async () => {
      const res = await app.request(
        `/${todoId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated title' }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const updated = todoSchema.parse(await res.json());
      expect(updated.id).toBe(todoId);
      expect(updated.title).toBe('Updated title');

      // 永続化を確認
      const getRes = await app.request('/', {}, env);
      const todos = todosSchema.parse(await getRes.json());
      expect(todos[0].title).toBe('Updated title');
    });

    it('PUT /:id with non-existent id returns 404', async () => {
      const res = await app.request(
        '/non-existent-id',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Nope' }),
        },
        env,
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not Found' });
    });

    it('PUT /:id with empty title returns 400', async () => {
      const res = await app.request(
        `/${todoId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '' }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it('DELETE /:id deletes the todo', async () => {
      const res = await app.request(`/${todoId}`, { method: 'DELETE' }, env);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: todoId });

      // 消えていることを確認
      const getRes = await app.request('/', {}, env);
      expect(await getRes.json()).toEqual([]);
    });

    it('DELETE /:id with non-existent id returns 404', async () => {
      const res = await app.request('/non-existent-id', { method: 'DELETE' }, env);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not Found' });
    });

    it('full CRUD flow', async () => {
      // Create → List → Update → List → Delete → List
      const createRes = await app.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'CRUD test' }),
        },
        env,
      );
      expect(createRes.status).toBe(201);
      const created = todoSchema.parse(await createRes.json());

      const list1 = todosSchema.parse(await (await app.request('/', {}, env)).json());
      expect(list1).toHaveLength(2); // original + new

      await app.request(
        `/${created.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'CRUD updated' }),
        },
        env,
      );

      const list2 = todosSchema.parse(await (await app.request('/', {}, env)).json());
      expect(list2.find((t) => t.id === created.id)!.title).toBe('CRUD updated');

      await app.request(`/${created.id}`, { method: 'DELETE' }, env);

      const list3 = todosSchema.parse(await (await app.request('/', {}, env)).json());
      expect(list3).toHaveLength(1); // only original remains
    });
  });
});
