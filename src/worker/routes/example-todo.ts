/**
 * example-todo の IO 境界。
 *
 * ここにビジネスロジックは書かない。zValidator で受けて DTO をコマンドに変換し、
 * ワークフローを呼び、結果を保存して match で HTTP レスポンスに落とすだけ。
 * method chain を切ると Hono RPC の型が失われるので、繋げたまま書く。
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '@/worker/context';
import { type ExampleTodo, ExampleTodoId } from '@/worker/domain/example-todo';
import { ok } from '@/worker/lib/result';
import {
  createExampleTodo,
  deleteExampleTodo,
  getExampleTodoById,
  listExampleTodos,
  saveExampleTodo,
} from '@/worker/repositories/example-todo';
import { changeExampleTodoStatusWorkflow } from '@/worker/workflows/change-example-todo-status';
import { createExampleTodoWorkflow } from '@/worker/workflows/create-example-todo';
import { renameExampleTodoWorkflow } from '@/worker/workflows/rename-example-todo';
import {
  type ExampleTodoStatusDto,
  exampleTodoCreateSchema,
  exampleTodoIdParamSchema,
  exampleTodoStatusUpdateSchema,
  exampleTodoUpdateSchema,
} from '@/shared/schemas/example-todo';
import { throwUnexpected, toErrorResponse } from './error';

type ExampleTodoDto = {
  id: string;
  title: string;
  status: ExampleTodoStatusDto;
};

/** ドメインオブジェクト → DTO。brand はここで剥がす（react-app に漏らさない）。 */
const toDto = (todo: ExampleTodo): ExampleTodoDto => ({
  id: todo.id,
  title: todo.title,
  status: todo.status === 'Completed' ? 'completed' : 'active',
});

const app = new Hono<AppEnv>()
  .get('/', async (c) => {
    const ctx = c.var.context;

    const result = await listExampleTodos(ctx)();

    // 一覧の失敗はユーザー入力起因ではなくデータ不整合なので、
    // レスポンス形式を増やさずに 500 へ落とす（RPC の型を 200 だけに保つ意図もある）
    return result.match((todos) => c.json(todos.map(toDto)), throwUnexpected);
  })
  .post('/', zValidator('json', exampleTodoCreateSchema), async (c) => {
    const ctx = c.var.context;

    const result = await ok(c.req.valid('json'))
      .andThen(createExampleTodoWorkflow)
      .asyncAndThen((event) => createExampleTodo(ctx)(event.title));

    return result.match(
      (todo) => c.json(toDto(todo), 201),
      (e) => {
        const { body, status } = toErrorResponse(e);
        return c.json(body, status);
      },
    );
  })
  .put(
    '/:id',
    zValidator('param', exampleTodoIdParamSchema),
    zValidator('json', exampleTodoUpdateSchema),
    async (c) => {
      const ctx = c.var.context;
      const workflow = renameExampleTodoWorkflow(getExampleTodoById(ctx));

      const result = await ok({
        id: c.req.valid('param').id,
        title: c.req.valid('json').title,
      })
        .asyncAndThen(workflow)
        .andThen(saveExampleTodo(ctx));

      return result.match(
        (todo) => c.json(toDto(todo)),
        (e) => {
          const { body, status } = toErrorResponse(e);
          return c.json(body, status);
        },
      );
    },
  )
  .patch(
    '/:id/status',
    zValidator('param', exampleTodoIdParamSchema),
    zValidator('json', exampleTodoStatusUpdateSchema),
    async (c) => {
      const ctx = c.var.context;
      const workflow = changeExampleTodoStatusWorkflow(getExampleTodoById(ctx));

      const result = await ok({
        id: c.req.valid('param').id,
        status: c.req.valid('json').status,
        at: ctx.now(),
      })
        .asyncAndThen(workflow)
        .andThen(saveExampleTodo(ctx));

      return result.match(
        (todo) => c.json(toDto(todo)),
        (e) => {
          const { body, status } = toErrorResponse(e);
          return c.json(body, status);
        },
      );
    },
  )
  // 削除はドメインの状態遷移を伴わないので、ワークフローを挟まず repository を直接呼ぶ
  .delete('/:id', zValidator('param', exampleTodoIdParamSchema), async (c) => {
    const ctx = c.var.context;

    const result = await ExampleTodoId(c.req.valid('param').id).asyncAndThen(
      deleteExampleTodo(ctx),
    );

    return result.match(
      (id) => {
        const deleted: { id: string } = { id };
        return c.json(deleted);
      },
      (e) => {
        const { body, status } = toErrorResponse(e);
        return c.json(body, status);
      },
    );
  });

export default app;
