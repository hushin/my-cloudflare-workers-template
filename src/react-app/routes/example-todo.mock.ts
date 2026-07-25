import { HttpResponse, type RequestHandler, delay, http } from 'msw';
import { createHandler } from '@/react-app/lib/msw-hono';

export type ExampleTodo = { id: string; title: string };

export const exampleTodoFixtures: ExampleTodo[] = [
  { id: 'todo-1', title: 'Storybook を導入する' },
  { id: 'todo-2', title: 'MSW でデータをモックする' },
];

// ハンドラが共有するインメモリストア。
// 追加・更新・削除が GET の結果に反映されるので、interaction test で
// 一連の操作をそのまま検証できる。
let todos = new Map<string, ExampleTodo>();
let createdCount = 0;

/** story ごとにストアを初期化する（`beforeEach` から呼ぶ） */
export function resetExampleTodos(initialTodos: ExampleTodo[] = exampleTodoFixtures): void {
  todos = new Map(initialTodos.map((todo) => [todo.id, todo]));
  createdCount = 0;
}

resetExampleTodos();

const successHandlers = [
  createHandler({ path: '/api/example-todo', method: '$get' })(() => ({
    status: 200,
    output: [...todos.values()],
  })),

  createHandler({ path: '/api/example-todo', method: '$post' })(({ input }) => {
    createdCount += 1;
    const todo: ExampleTodo = { id: `todo-new-${createdCount}`, title: input.json.title };
    todos.set(todo.id, todo);
    return { status: 201, output: todo };
  }),

  createHandler({ path: '/api/example-todo/:id', method: '$put' })(({ input }) => {
    const existing = todos.get(input.param.id);
    if (!existing) {
      return { status: 404, output: { error: 'Not Found' } };
    }
    const updated: ExampleTodo = { ...existing, title: input.json.title };
    todos.set(updated.id, updated);
    return { status: 200, output: updated };
  }),

  createHandler({ path: '/api/example-todo/:id', method: '$delete' })(({ input }) => {
    const { id } = input.param;
    if (!todos.delete(id)) {
      return { status: 404, output: { error: 'Not Found' } };
    }
    return { status: 200, output: { id } };
  }),
];

/** GET が返ってこないケース（ローディング表示の確認用） */
const loadingHandlers = [
  createHandler({ path: '/api/example-todo', method: '$get' })(async () => {
    await delay('infinite');
    return { status: 200, output: [] };
  }),
];

/**
 * GET が失敗するケース。route の型に存在しない status を返すため、
 * ここだけは msw の http をそのまま使う。
 */
const errorHandlers = [
  http.get('/api/example-todo', () => new HttpResponse(null, { status: 500 })),
];

/** story から使うハンドラ一式 */
export const exampleTodoHandlers = {
  success: successHandlers,
  loading: loadingHandlers,
  error: errorHandlers,
} as const satisfies Record<string, RequestHandler[]>;
