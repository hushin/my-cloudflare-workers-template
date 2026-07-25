import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/worker/db';
import { exampleTodos } from '@/worker/db/schema';

export type ExampleTodo = {
  id: string;
  title: string;
};

/** API のレスポンスに含める列。created_at は内部の並び順専用で外に出さない。 */
const columns = {
  id: exampleTodos.id,
  title: exampleTodos.title,
};

/**
 * 一覧の既定の上限。D1 は読み取り行数で課金されるうえ Worker のメモリ上限もあるので、
 * 一覧系のクエリには必ず上限を掛ける（件数が増えるならページングを入れる）。
 */
const LIST_LIMIT = 100;

export const exampleTodoRepository = {
  // created_at が同値のときのために id でタイブレークする
  list(db: Db, limit: number = LIST_LIMIT): Promise<ExampleTodo[]> {
    return db
      .select(columns)
      .from(exampleTodos)
      .orderBy(asc(exampleTodos.createdAt), asc(exampleTodos.id))
      .limit(limit);
  },

  async create(db: Db, title: string): Promise<ExampleTodo> {
    const [created] = await db.insert(exampleTodos).values({ title }).returning(columns);
    return created;
  },

  async update(db: Db, id: string, title: string): Promise<ExampleTodo | undefined> {
    const [updated] = await db
      .update(exampleTodos)
      .set({ title })
      .where(eq(exampleTodos.id, id))
      .returning(columns);
    return updated;
  },

  async remove(db: Db, id: string): Promise<ExampleTodo | undefined> {
    const [deleted] = await db
      .delete(exampleTodos)
      .where(eq(exampleTodos.id, id))
      .returning(columns);
    return deleted;
  },
};
