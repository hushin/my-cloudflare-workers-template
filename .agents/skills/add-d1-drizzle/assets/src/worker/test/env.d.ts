import type { D1Migration } from '@cloudflare/vitest-pool-workers';

// `cloudflare:test` の `env` は `Cloudflare.Env` 型（0.18 で `ProvidedEnv` は廃止）。
// テスト専用のバインディングはこの namespace にマージして足す。
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
