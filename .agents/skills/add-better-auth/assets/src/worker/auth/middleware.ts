import { createMiddleware } from 'hono/factory';
import { type AuthSession, type AuthUser, createAuth } from './index';

/** 認証を使う Hono app の型引数。`new Hono<AuthEnv>()` のように使う。 */
export type AuthEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
};

/** セッションを取得して c.get('user') / c.get('session') で読めるようにする */
export const sessionMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  c.set('user', result?.user ?? null);
  c.set('session', result?.session ?? null);
  await next();
});

/**
 * 未ログインを 401 で弾く。`sessionMiddleware` の後に置く。
 *
 * 注意: middleware が返す 401 は Hono RPC の型には現れない。クライアント側では
 * 401 を「型に無いレスポンス」として扱う（`res.ok` で分岐する）。
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
