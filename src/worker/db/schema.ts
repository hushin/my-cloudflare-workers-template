import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
    // ドメインの ActiveExampleTodo | CompletedExampleTodo に対応する列。
    // 「completed なのに completed_at が無い」行は作れてしまうので、
    // 行 → ドメインの変換（repository）で検証して弾く
    status: text('status', { enum: ['active', 'completed'] })
      .notNull()
      .default('active'),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  // 一覧の並び替えに使う列なのでインデックスを張る
  (table) => [index('example_todos_created_at_idx').on(table.createdAt)],
);

/**
 * 商品マスタ。注文ワークフローが単価と在庫を引くための読み取り元。
 * code をそのまま主キーにする（ドメインの ProductCode に対応）。
 */
export const exampleProducts = sqliteTable(
  'example_products',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    /** 単価（円）。小数を持たせないため integer */
    unitPrice: integer('unit_price').notNull(),
    /** 在庫数。ドメインの StockCount（0 以上）に対応 */
    stock: integer('stock').notNull().default(0),
  },
  // 在庫の減算はアプリ側でも検査するが、同時実行で検査をすり抜けた分はここで落とす。
  // batch（= トランザクション）内で制約違反になるので、注文ごと巻き戻る
  (table) => [check('example_products_stock_non_negative', sql`${table.stock} >= 0`)],
);

/**
 * 注文。ドメインの PlacedOrder | CancelledOrder に対応する。
 * DraftOrder は永続化しない（ワークフロー内の中間状態で、place まで 1 リクエストで完結する）。
 *
 * id は DB の default に任せず route が `ctx.newId()` で採番する。
 * example_order_lines を同じ batch で insert するには id が先に確定している必要があるため。
 */
export const exampleOrders = sqliteTable(
  'example_orders',
  {
    id: text('id').primaryKey(),
    status: text('status', { enum: ['placed', 'cancelled'] })
      .notNull()
      .default('placed'),
    /** 明細の合計金額。明細から再計算できるが、一覧で読むために非正規化して持つ */
    totalAmount: integer('total_amount').notNull(),
    placedAt: integer('placed_at', { mode: 'timestamp_ms' }).notNull(),
    // 「cancelled なのに cancelled_at が無い」行は作れてしまうので、
    // 行 → ドメインの変換（repository）で検証して弾く
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('example_orders_placed_at_idx').on(table.placedAt)],
);

/**
 * 注文明細。単価と金額は注文時点の値を焼き付ける（商品マスタの単価が後で変わっても動かない）。
 */
export const exampleOrderLines = sqliteTable(
  'example_order_lines',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => exampleOrders.id, { onDelete: 'cascade' }),
    productCode: text('product_code').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    lineAmount: integer('line_amount').notNull(),
  },
  (table) => [index('example_order_lines_order_id_idx').on(table.orderId)],
);

export * from './auth-schema';
