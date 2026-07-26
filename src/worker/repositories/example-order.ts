/**
 * ExampleOrder / ExampleProduct のデータアクセス。
 *
 * ExampleTodo と同じく「context を受け取って関数を返す関数」。行 ↔ ドメインの変換もここ。
 *
 * 注文の永続化はワークフローが出したドメインイベント列を受け取り、
 * 注文・明細・在庫の更新を **1 回の `db.batch()`**（= 1 トランザクション）にまとめる。
 */
import { eq, inArray, sql } from 'drizzle-orm';
import type { ApplicationContext } from '@/worker/context';
import { D1Error } from '@/worker/db/errors';
import { exampleOrderLines, exampleOrders, exampleProducts } from '@/worker/db/schema';
import {
  type CancelledOrder,
  Money,
  OrderId,
  type PlacedOrder,
  type PersistedExampleOrder,
  type PricedOrderLine,
  ProductCode,
  Quantity,
  StockCount,
  type Product,
} from '@/worker/domain/example-order';
import { EntityNotFound, InsufficientStock, ValidationError } from '@/worker/domain/errors';
import { Result, ResultAsync, err, errAsync, ok, okAsync, okOr } from '@/worker/lib/result';
import type { CancelExampleOrderEvent } from '@/worker/workflows/cancel-example-order';
import type { PlaceExampleOrderEvent } from '@/worker/workflows/place-example-order';

type ProductRow = typeof exampleProducts.$inferSelect;
type OrderRow = typeof exampleOrders.$inferSelect;
type OrderLineRow = typeof exampleOrderLines.$inferSelect;

const toProduct = (row: ProductRow): Result<Product, ValidationError> =>
  Result.combine([ProductCode(row.code), Money(row.unitPrice), StockCount(row.stock)]).map(
    ([code, unitPrice, stock]) => ({ code, name: row.name, unitPrice, stock }),
  );

const toPricedOrderLine = (row: OrderLineRow): Result<PricedOrderLine, ValidationError> =>
  Result.combine([
    ProductCode(row.productCode),
    Quantity(row.quantity),
    Money(row.unitPrice),
    Money(row.lineAmount),
  ]).map(([productCode, quantity, unitPrice, lineAmount]) => ({
    productCode,
    quantity,
    unitPrice,
    lineAmount,
  }));

const toExampleOrder = (
  row: OrderRow,
  lineRows: readonly OrderLineRow[],
): Result<PersistedExampleOrder, ValidationError> =>
  Result.combine([OrderId(row.id), Money(row.totalAmount)]).andThen(([id, totalAmount]) =>
    Result.combine(lineRows.map(toPricedOrderLine)).andThen(
      (lines): Result<PersistedExampleOrder, ValidationError> => {
        const base = { id, lines, totalAmount, placedAt: row.placedAt };
        switch (row.status) {
          case 'placed':
            return ok({ ...base, status: 'Placed' });
          case 'cancelled':
            // 「cancelled なのに cancelled_at が無い」行は DB では作れてしまうので弾く
            return row.cancelledAt == null
              ? err(new ValidationError(`cancelled の行に cancelled_at がありません: ${row.id}`))
              : ok({ ...base, status: 'Cancelled', cancelledAt: row.cancelledAt });
          default:
            return err(new ValidationError(`不正な status です: ${String(row.status)}`));
        }
      },
    ),
  );

/**
 * 明細の商品コードをまとめて 1 クエリで引く（行ごとに引くと N+1 になる）。
 * 見つからなかったコードの扱いはワークフロー側の判断なので、ここでは黙って落とす。
 */
export const findProducts =
  ({ db }: ApplicationContext) =>
  (codes: readonly ProductCode[]): ResultAsync<readonly Product[], ValidationError | D1Error> =>
    codes.length === 0
      ? okAsync<readonly Product[], ValidationError | D1Error>([])
      : ResultAsync.fromPromise(
          db
            .select()
            .from(exampleProducts)
            .where(inArray(exampleProducts.code, [...codes])),
          (e) => new D1Error(e),
        ).andThen((rows) => Result.combine(rows.map(toProduct)));

export const findExampleOrderById =
  ({ db }: ApplicationContext) =>
  (id: OrderId): ResultAsync<PersistedExampleOrder | null, ValidationError | D1Error> =>
    ResultAsync.fromPromise(
      db.select().from(exampleOrders).where(eq(exampleOrders.id, id)).get(),
      (e) => new D1Error(e),
    ).andThen((row) =>
      row == null
        ? ok(null)
        : ResultAsync.fromPromise(
            db.select().from(exampleOrderLines).where(eq(exampleOrderLines.orderId, row.id)),
            (e) => new D1Error(e),
          ).andThen((lineRows) => toExampleOrder(row, lineRows)),
    );

/** 「なければエラー」版。find の上に薄く重ねる。 */
export const getExampleOrderById =
  (ctx: ApplicationContext) =>
  (id: OrderId): ResultAsync<PersistedExampleOrder, ValidationError | EntityNotFound | D1Error> =>
    findExampleOrderById(ctx)(id).andThen((order) =>
      okOr(order, () => new EntityNotFound(`example order not found: ${id}`)),
    );

/**
 * 在庫の CHECK 制約（stock >= 0）違反を InsufficientStock に読み替える。
 *
 * 在庫はワークフローでも検査しているが、検査と更新の間に別リクエストが在庫を
 * 減らしていた場合はここで初めて分かる。batch なので注文ごと巻き戻っている。
 */
const toStockAwareError = (e: unknown): InsufficientStock | D1Error => {
  const message = e instanceof Error ? e.message : String(e);
  return /CONSTRAINT|constraint/.test(message)
    ? new InsufficientStock('在庫が不足しています（在庫が同時に更新されました）')
    : new D1Error(e);
};

/**
 * 注文の確定を永続化する。
 * 注文 1 件 + 明細 N 件 + 在庫 N 件の更新を 1 回の batch で書く。
 */
export const saveOrderPlacement =
  ({ db, newId }: ApplicationContext) =>
  (
    events: readonly PlaceExampleOrderEvent[],
  ): ResultAsync<PlacedOrder, ValidationError | InsufficientStock | D1Error> => {
    const placed = events.find((event) => event.kind === 'ExampleOrderPlaced');
    if (placed === undefined) {
      return errAsync(new ValidationError('ExampleOrderPlaced イベントがありません'));
    }
    const { order } = placed;

    const insertOrder = db.insert(exampleOrders).values({
      id: order.id,
      status: 'placed',
      totalAmount: order.totalAmount,
      placedAt: order.placedAt,
    });
    const insertLines = order.lines.map((line) =>
      db.insert(exampleOrderLines).values({
        id: newId(),
        orderId: order.id,
        productCode: line.productCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineAmount: line.lineAmount,
      }),
    );
    const reserveStock = events
      .filter((event) => event.kind === 'StockReserved')
      .map((event) =>
        db
          .update(exampleProducts)
          .set({ stock: sql`${exampleProducts.stock} - ${event.quantity}` })
          .where(eq(exampleProducts.code, event.productCode)),
      );

    return ResultAsync.fromPromise(
      db.batch([insertOrder, ...insertLines, ...reserveStock]),
      toStockAwareError,
    ).map(() => order);
  };

/**
 * 注文の取消を永続化する。注文の status 更新 + 在庫の戻しを 1 回の batch で書く。
 * 明細は書き換えない（注文時点の値を保つ）。
 */
export const saveOrderCancellation =
  ({ db }: ApplicationContext) =>
  (
    events: readonly CancelExampleOrderEvent[],
  ): ResultAsync<CancelledOrder, ValidationError | EntityNotFound | D1Error> => {
    const cancelled = events.find((event) => event.kind === 'ExampleOrderCancelled');
    if (cancelled === undefined) {
      return errAsync(new ValidationError('ExampleOrderCancelled イベントがありません'));
    }
    const { order } = cancelled;

    const updateOrder = db
      .update(exampleOrders)
      .set({ status: 'cancelled', cancelledAt: order.cancelledAt })
      .where(eq(exampleOrders.id, order.id))
      .returning({ id: exampleOrders.id });
    const releaseStock = events
      .filter((event) => event.kind === 'StockReleased')
      .map((event) =>
        db
          .update(exampleProducts)
          .set({ stock: sql`${exampleProducts.stock} + ${event.quantity}` })
          .where(eq(exampleProducts.code, event.productCode)),
      );

    return ResultAsync.fromPromise(
      db.batch([updateOrder, ...releaseStock]),
      (e) => new D1Error(e),
    ).andThen(([updated]) =>
      updated.length > 0
        ? ok(order)
        : err(new EntityNotFound(`example order not found: ${order.id}`)),
    );
  };
