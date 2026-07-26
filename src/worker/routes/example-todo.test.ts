import { z } from 'zod';
import { env } from 'cloudflare:test';
import { app } from '@/worker/index';

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed']),
});
const todosSchema = z.array(todoSchema);

const BASE = '/api/example-todo';

// ApplicationContext を載せる middleware は index.ts で登録しているので、
// route 単体ではなくマウント済みの app 経由でリクエストする。
const createTodo = (title: string) =>
  app.request(
    BASE,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
    env,
  );

const changeStatus = (id: string, status: string) =>
  app.request(
    `${BASE}/${id}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
    env,
  );

describe('example-todo routes', () => {
  // D1 はテスト間で共有されるので、毎テスト前に行を消す。
  // migration 自体は setupFiles（src/worker/test/apply-migrations.ts）で適用済み。
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM example_todos');
  });

  it('GET / returns empty array initially', async () => {
    const res = await app.request(BASE, {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST / creates a todo and returns 201', async () => {
    const res = await createTodo('Buy milk');
    expect(res.status).toBe(201);
    const todo = todoSchema.parse(await res.json());
    expect(todo.title).toBe('Buy milk');
    expect(todo.status).toBe('active');
  });

  it('POST / with empty title returns 400', async () => {
    const res = await createTodo('');
    expect(res.status).toBe(400);
  });

  it('POST / with missing title returns 400', async () => {
    const res = await app.request(
      BASE,
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
      const res = await createTodo('Original title');
      todoId = todoSchema.parse(await res.json()).id;
    });

    it('GET / returns array with the todo', async () => {
      const res = await app.request(BASE, {}, env);
      expect(res.status).toBe(200);
      const todos = todosSchema.parse(await res.json());
      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe(todoId);
      expect(todos[0].title).toBe('Original title');
    });

    it('PUT /:id updates the todo', async () => {
      const res = await app.request(
        `${BASE}/${todoId}`,
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
      const getRes = await app.request(BASE, {}, env);
      const todos = todosSchema.parse(await getRes.json());
      expect(todos[0].title).toBe('Updated title');
    });

    it('PUT /:id with non-existent id returns 404', async () => {
      const res = await app.request(
        `${BASE}/non-existent-id`,
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
        `${BASE}/${todoId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '' }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it('PATCH /:id/status completes and reopens the todo', async () => {
      const completeRes = await changeStatus(todoId, 'completed');
      expect(completeRes.status).toBe(200);
      expect(todoSchema.parse(await completeRes.json()).status).toBe('completed');

      // 一覧にも反映される
      const listed = todosSchema.parse(await (await app.request(BASE, {}, env)).json());
      expect(listed[0].status).toBe('completed');

      const reopenRes = await changeStatus(todoId, 'active');
      expect(reopenRes.status).toBe(200);
      expect(todoSchema.parse(await reopenRes.json()).status).toBe('active');
    });

    it('PATCH /:id/status is idempotent', async () => {
      await changeStatus(todoId, 'completed');
      const res = await changeStatus(todoId, 'completed');

      expect(res.status).toBe(200);
      expect(todoSchema.parse(await res.json()).status).toBe('completed');
    });

    it('PATCH /:id/status with unknown status returns 400', async () => {
      const res = await changeStatus(todoId, 'archived');
      expect(res.status).toBe(400);
    });

    it('PATCH /:id/status with non-existent id returns 404', async () => {
      const res = await changeStatus('non-existent-id', 'completed');
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not Found' });
    });

    it('DELETE /:id deletes the todo', async () => {
      const res = await app.request(`${BASE}/${todoId}`, { method: 'DELETE' }, env);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: todoId });

      // 消えていることを確認
      const getRes = await app.request(BASE, {}, env);
      expect(await getRes.json()).toEqual([]);
    });

    it('DELETE /:id with non-existent id returns 404', async () => {
      const res = await app.request(`${BASE}/non-existent-id`, { method: 'DELETE' }, env);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not Found' });
    });

    it('full CRUD flow', async () => {
      // Create → List → Update → List → Complete → Delete → List
      const createRes = await createTodo('CRUD test');
      expect(createRes.status).toBe(201);
      const created = todoSchema.parse(await createRes.json());

      const list1 = todosSchema.parse(await (await app.request(BASE, {}, env)).json());
      expect(list1).toHaveLength(2); // original + new

      await app.request(
        `${BASE}/${created.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'CRUD updated' }),
        },
        env,
      );

      const list2 = todosSchema.parse(await (await app.request(BASE, {}, env)).json());
      expect(list2.find((t) => t.id === created.id)!.title).toBe('CRUD updated');

      await changeStatus(created.id, 'completed');
      const list3 = todosSchema.parse(await (await app.request(BASE, {}, env)).json());
      expect(list3.find((t) => t.id === created.id)!.status).toBe('completed');

      await app.request(`${BASE}/${created.id}`, { method: 'DELETE' }, env);

      const list4 = todosSchema.parse(await (await app.request(BASE, {}, env)).json());
      expect(list4).toHaveLength(1); // only original remains
    });
  });
});
