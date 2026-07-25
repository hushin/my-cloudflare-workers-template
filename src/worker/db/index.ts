import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Workers では env がリクエストスコープなので、モジュールトップで db インスタンスを
 * 作らずハンドラの中で `createDb(c.env)` として都度生成する。
 */
export function createDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof createDb>;

export { schema };
