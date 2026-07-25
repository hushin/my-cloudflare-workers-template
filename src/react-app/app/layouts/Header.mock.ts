import { HttpResponse, type RequestHandler, http } from 'msw';
import { authClient } from '@/react-app/shared/api';

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

/**
 * better-auth の `useSession` はモジュールスコープの nanostore にセッションをキャッシュし、
 * 購読が 0 になっても約 1 秒は store を生かしたままにする。story は連続で実行されるため、
 * 何もしないと 2 本目以降が 1 本目のセッションを再利用して msw のモックを無視する。
 * `$sessionSignal` を notify すると再取得が走る。
 *
 * msw のハンドラは preview の `mswLoader`（global loader）で差し替わるので、
 * これは **loader として** 呼ぶ（global loader の後に実行される）。
 */
export const refetchSession = () => {
  authClient.$store.notify('$sessionSignal');
};
