import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb } from '@/worker/db';
import * as authSchema from '@/worker/db/auth-schema';
import { authOptions } from './options';

/**
 * Workers では env がリクエストスコープなので、モジュールトップで auth を作らず
 * ハンドラの中で `createAuth(c.env)` として都度生成する。
 */
export function createAuth(env: Env) {
  return betterAuth({
    ...authOptions,
    database: drizzleAdapter(createDb(env), {
      provider: 'sqlite',
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSessionData = Auth['$Infer']['Session'];
export type AuthUser = AuthSessionData['user'];
export type AuthSession = AuthSessionData['session'];
