import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>().get('/api/', (c) => c.json({ name: 'Cloudflare' }));

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

export type AppType = typeof app;
