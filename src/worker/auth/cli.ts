import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { authOptions } from './options';

/**
 * `@better-auth/cli generate` 専用のエントリ。実行時には使わない。
 *
 * CLI は Node 上で auth 設定を import するが、実行時の設定は Workers の `env` に依存するため
 * `createAuth(env)` をそのまま読み込めない。スキーマ生成に必要なのは adapter の種別と
 * plugin 構成だけなので、DB を持たない同じ形の設定をここで組み立てて export する。
 */
export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter({}, { provider: 'sqlite' }),
});
