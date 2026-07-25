import type { BetterAuthOptions } from 'better-auth';

/**
 * DB / secret / provider の資格情報を除いた、実行時と CLI（スキーマ生成）で共通の設定。
 *
 * plugin を足すときはここに書く。こうしておくと `@better-auth/cli generate` が
 * plugin のテーブルも含めたスキーマを吐いてくれる。
 */
export const authOptions = {
  basePath: '/api/auth',
  plugins: [],
} satisfies BetterAuthOptions;
