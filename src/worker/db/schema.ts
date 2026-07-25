import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const exampleTodos = sqliteTable(
  'example_todos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    // SQLite の current_timestamp は秒精度で、同一秒内に作られた行の並び順が定まらない。
    // ミリ秒の unix time で持つ（better-auth 生成の auth-schema とも表現を揃えている）
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  // 一覧の並び替えに使う列なのでインデックスを張る
  (table) => [index('example_todos_created_at_idx').on(table.createdAt)],
);

export * from './auth-schema';
