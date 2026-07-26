/**
 * ApplicationContext — リクエストごとに組み立てる IO の入り口。
 *
 * Workers は `env` がリクエストごとに渡ってくるので DI コンテナは使わず、
 * middleware で毎リクエスト生成して `c.var.context` に載せる。
 */
import { createMiddleware } from 'hono/factory';
import { type Db, createDb } from './db';

export type ApplicationContext = {
  readonly db: Db;
  /** 現在時刻。ドメイン層・ワークフロー層に `new Date()` を持ち込まないための境界 */
  readonly now: () => Date;
  /**
   * id の採番。`crypto.randomUUID()` を持ち込まないための境界。
   * 親子（注文と明細）を 1 回の `db.batch()` で insert するには、
   * DB の default に任せず insert 前に id を確定させる必要がある。
   */
  readonly newId: () => string;
};

/** context を載せる Hono の Variables。auth などと合成できるよう切り出してある */
export type ContextVariables = { context: ApplicationContext };

export type AppEnv = {
  Bindings: Env;
  Variables: ContextVariables;
};

export const createContext = (env: Env): ApplicationContext => ({
  db: createDb(env),
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
});

export const contextMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('context', createContext(c.env));
  await next();
});
