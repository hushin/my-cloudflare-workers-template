import { applyD1Migrations, env } from 'cloudflare:test';

// vitest.config.ts の miniflare.bindings で渡した migration を、
// テスト用の各 D1 インスタンスに適用する。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
