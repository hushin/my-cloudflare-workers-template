/**
 * ExampleTodo のデータアクセス。
 *
 * クラスやインターフェースではなく「context を受け取って関数を返す関数」にする。
 * 行 ↔ ドメインオブジェクトの相互変換もここに置く。ドメインのコンストラクタを
 * 通すので、戻り値のエラー型に ValidationError が混ざるのは正しい。
 *
 * ここは IO 層なので関数型スタイルに寄せすぎず、drizzle の呼び出しは素直に書いて
 * `ResultAsync.fromPromise` で包む。
 */
import { asc, eq } from 'drizzle-orm';
import type { ApplicationContext } from '@/worker/context';
import { D1Error } from '@/worker/db/errors';
import { exampleTodos } from '@/worker/db/schema';
import {
  type ActiveExampleTodo,
  type ExampleTodo,
  ExampleTodoId,
  ExampleTodoTitle,
} from '@/worker/domain/example-todo';
import { EntityNotFound, ValidationError } from '@/worker/domain/errors';
import { Result, ResultAsync, err, ok, okOr } from '@/worker/lib/result';

type ExampleTodoRow = typeof exampleTodos.$inferSelect;

/**
 * 一覧の既定の上限。D1 は読み取り行数で課金されるうえ Worker のメモリ上限もあるので、
 * 一覧系のクエリには必ず上限を掛ける（件数が増えるならページングを入れる）。
 */
const LIST_LIMIT = 100;

const toExampleTodo = (row: ExampleTodoRow): Result<ExampleTodo, ValidationError> =>
  ExampleTodoId(row.id).andThen((id) =>
    ExampleTodoTitle(row.title).andThen((title): Result<ExampleTodo, ValidationError> => {
      const base = { id, title, createdAt: row.createdAt };
      switch (row.status) {
        case 'active':
          return ok({ ...base, status: 'Active' });
        case 'completed':
          return row.completedAt == null
            ? err(new ValidationError(`completed の行に completed_at がありません: ${row.id}`))
            : ok({ ...base, status: 'Completed', completedAt: row.completedAt });
        default:
          return err(new ValidationError(`不正な status です: ${String(row.status)}`));
      }
    }),
  );

/** ドメイン → 行。id と created_at は採番済みなので更新対象に含めない。 */
const toUpdateValues = (todo: ExampleTodo) => ({
  title: todo.title as string,
  status: todo.status === 'Completed' ? ('completed' as const) : ('active' as const),
  completedAt: todo.status === 'Completed' ? todo.completedAt : null,
});

/** 一覧。created_at 昇順、同値は id でタイブレーク。 */
export const listExampleTodos =
  ({ db }: ApplicationContext) =>
  (limit: number = LIST_LIMIT): ResultAsync<ExampleTodo[], ValidationError | D1Error> =>
    ResultAsync.fromPromise(
      db
        .select()
        .from(exampleTodos)
        .orderBy(asc(exampleTodos.createdAt), asc(exampleTodos.id))
        .limit(limit),
      (e) => new D1Error(e),
    ).andThen((rows) => Result.combine(rows.map(toExampleTodo)));

export const findExampleTodoById =
  ({ db }: ApplicationContext) =>
  (id: ExampleTodoId): ResultAsync<ExampleTodo | null, ValidationError | D1Error> =>
    ResultAsync.fromPromise(
      db.select().from(exampleTodos).where(eq(exampleTodos.id, id)).get(),
      (e) => new D1Error(e),
    ).andThen((row) => (row ? toExampleTodo(row) : ok(null)));

/** 「なければエラー」版。find の上に薄く重ねる。 */
export const getExampleTodoById =
  (ctx: ApplicationContext) =>
  (id: ExampleTodoId): ResultAsync<ExampleTodo, ValidationError | EntityNotFound | D1Error> =>
    findExampleTodoById(ctx)(id).andThen((todo) =>
      okOr(todo, () => new EntityNotFound(`example todo not found: ${id}`)),
    );

/**
 * 新規作成。id と created_at の採番は DB の default（drizzle の $defaultFn）に任せる。
 * `.returning()` を付けないと作成後の行が取れない点に注意。
 */
export const createExampleTodo =
  ({ db }: ApplicationContext) =>
  (title: ExampleTodoTitle): ResultAsync<ActiveExampleTodo, ValidationError | D1Error> =>
    ResultAsync.fromPromise(
      db.insert(exampleTodos).values({ title, status: 'active' }).returning().get(),
      (e) => new D1Error(e),
    )
      .andThen(toExampleTodo)
      .andThen((todo) =>
        todo.status === 'Active'
          ? ok(todo)
          : err(new ValidationError('作成直後の todo が Active ではありません')),
      );

/** 遷移後の状態をそのまま永続化する。ワークフローの外（route）から呼ぶ。 */
export const saveExampleTodo =
  ({ db }: ApplicationContext) =>
  <T extends ExampleTodo>(todo: T): ResultAsync<T, EntityNotFound | D1Error> =>
    ResultAsync.fromPromise(
      db
        .update(exampleTodos)
        .set(toUpdateValues(todo))
        .where(eq(exampleTodos.id, todo.id))
        .returning({ id: exampleTodos.id })
        .get(),
      (e) => new D1Error(e),
    ).andThen((updated) =>
      updated ? ok(todo) : err(new EntityNotFound(`example todo not found: ${todo.id}`)),
    );

export const deleteExampleTodo =
  ({ db }: ApplicationContext) =>
  (id: ExampleTodoId): ResultAsync<ExampleTodoId, EntityNotFound | D1Error> =>
    ResultAsync.fromPromise(
      db
        .delete(exampleTodos)
        .where(eq(exampleTodos.id, id))
        .returning({ id: exampleTodos.id })
        .get(),
      (e) => new D1Error(e),
    ).andThen((deleted) =>
      deleted ? ok(id) : err(new EntityNotFound(`example todo not found: ${id}`)),
    );
