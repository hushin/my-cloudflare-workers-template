import { Hono } from 'hono';
import { createAuth } from './auth';
import { type AuthEnv, sessionMiddleware } from './auth/middleware';
import exampleTodoRoute from './routes/example-todo';

const app = new Hono<AuthEnv>()
  .basePath('/api')
  // auth 自身のエンドポイントはセッション解決前に処理させる
  .on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))
  .use('*', sessionMiddleware)
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/example-todo', exampleTodoRoute);

// run_worker_first: ["/api/*"] により /api/* だけが Worker に到達する
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    // run_worker_first の設定上ここには到達しないが防御的に 404 を返す
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export { app };
export type AppType = typeof app;
