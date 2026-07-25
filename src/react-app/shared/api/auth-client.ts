import { createAuthClient } from 'better-auth/react';

// SPA と Worker は同一オリジンなので baseURL は不要。basePath だけ worker 側と合わせる。
export const authClient = createAuthClient({
  basePath: '/api/auth',
});

export const { signIn, signOut, useSession } = authClient;
