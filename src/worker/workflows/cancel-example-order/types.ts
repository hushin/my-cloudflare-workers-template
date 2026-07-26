import type {
  CancelledOrder,
  ExampleOrder,
  OrderId,
  ProductCode,
  Quantity,
} from '@/worker/domain/example-order';
import type { ValidationError } from '@/worker/domain/errors';
import type { ResultAsync } from '@/worker/lib/result';

export type CancelExampleOrderCommand = {
  readonly id: string;
  /** 取消時刻。`ctx.now()` を route が詰める */
  readonly at: Date;
};

export type ValidatedCancelExampleOrderCommand = {
  readonly id: OrderId;
  readonly at: Date;
};

/** 取消対象を読み終えた中間状態。ここから先が実際の分岐（Placed かどうか）になる */
export type LoadedExampleOrder = {
  readonly order: ExampleOrder;
  readonly at: Date;
};

export type ExampleOrderCancelled = {
  readonly kind: 'ExampleOrderCancelled';
  readonly order: CancelledOrder;
};

/** 明細ごとに 1 つ。route はこれを在庫の加算クエリに落とす */
export type StockReleased = {
  readonly kind: 'StockReleased';
  readonly productCode: ProductCode;
  readonly quantity: Quantity;
};

export type CancelExampleOrderEvent = ExampleOrderCancelled | StockReleased;

export type FindExampleOrder<E> = (id: OrderId) => ResultAsync<ExampleOrder, E>;

export type CancelExampleOrderError<E> = ValidationError | E;

export type CancelExampleOrderWorkflow<E> = (
  command: CancelExampleOrderCommand,
) => ResultAsync<readonly CancelExampleOrderEvent[], CancelExampleOrderError<E>>;
