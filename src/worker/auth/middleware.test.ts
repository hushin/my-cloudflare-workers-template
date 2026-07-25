import { Hono } from 'hono';
import { env } from 'cloudflare:test';
import { type AuthEnv, requireAuth, sessionMiddleware } from './middleware';

const app = new Hono<AuthEnv>()
  .use('*', sessionMiddleware)
  .get('/public', (c) => c.json({ user: c.get('user') }))
  .use('*', requireAuth)
  .get('/private', (c) => c.json({ id: c.get('user')!.id }));

describe('auth middleware', () => {
  it('sessionMiddleware sets user to null without a session cookie', async () => {
    const res = await app.request('/public', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it('requireAuth returns 401 without a session cookie', async () => {
    const res = await app.request('/private', {}, env);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('requireAuth returns 401 with an invalid session cookie', async () => {
    const res = await app.request(
      '/private',
      { headers: { Cookie: 'better-auth.session_token=invalid-token' } },
      env,
    );
    expect(res.status).toBe(401);
  });
});
