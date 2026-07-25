import { defineConfig } from 'drizzle-kit';

/**
 * migration の出力先 `out` は wrangler.json の `d1_databases[].migrations_dir` と
 * 一致させる。ここがズレると drizzle-kit が作った SQL を wrangler が適用しない。
 *
 * `drizzle-kit generate`（migration の生成）だけなら認証情報は不要。
 * `drizzle-kit studio` / `push` でリモートの D1 を直接触りたい場合のみ、
 * 以下を追加して CLOUDFLARE_* を環境変数に設定する:
 *
 *   driver: 'd1-http',
 *   dbCredentials: {
 *     accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
 *     databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
 *     token: process.env.CLOUDFLARE_D1_TOKEN!,
 *   },
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/worker/db/schema.ts',
  out: './drizzle',
});
