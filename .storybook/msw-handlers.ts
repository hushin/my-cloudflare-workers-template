import { http, HttpResponse } from 'msw';

type ExampleTodoBody = { title: string };

export const mswHandlers = {
  exampleTodos: [
    http.get('/api/example-todo', () =>
      HttpResponse.json([
        { id: 'todo-1', title: 'Storybook を導入する' },
        { id: 'todo-2', title: 'MSW でデータをモックする' },
      ]),
    ),
    http.post<never, ExampleTodoBody>('/api/example-todo', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ id: 'todo-new', title: body.title }, { status: 201 });
    }),
    http.put<{ id: string }, ExampleTodoBody>(
      '/api/example-todo/:id',
      async ({ params, request }) => {
        const body = await request.json();
        return HttpResponse.json({ id: params.id, title: body.title });
      },
    ),
    http.delete('/api/example-todo/:id', ({ params }) => HttpResponse.json({ id: params.id })),
  ],
};
