import { HttpResponse, type RequestHandler, http } from 'msw';

/**
 * better-auth のセッション取得は Hono の route ではなく `auth.handler` が直接処理するため、
 * `AppType` から型を引けない。ここだけは msw の `http` をそのまま使う。
 */
const signedInSession = {
  user: {
    id: 'user-1',
    name: 'テスト ユーザー',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  session: {
    id: 'session-1',
    userId: 'user-1',
    token: 'test-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

/** story から使うハンドラ一式 */
export const sessionHandlers = {
  signedIn: [http.get('/api/auth/get-session', () => HttpResponse.json(signedInSession))],
  // 未ログインのとき better-auth は 200 + null を返す
  signedOut: [http.get('/api/auth/get-session', () => HttpResponse.json(null))],
} as const satisfies Record<string, RequestHandler[]>;
