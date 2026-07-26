import type {
  DraftOrder,
  PlacedOrder,
  Product,
  ProductCode,
  Quantity,
} from '@/worker/domain/example-order';
import type {
  InsufficientStock,
  OrderLimitExceeded,
  ProductNotFound,
  ValidationError,
} from '@/worker/domain/errors';
import type { ResultAsync } from '@/worker/lib/result';

/** route が DTO から組み立てる、まだ検証されていないコマンド */
export type PlaceExampleOrderCommand = {
  /** 注文 id。`ctx.newId()` を route が詰める（ワークフローに採番器を持ち込まない） */
  readonly orderId: string;
  readonly lines: readonly { readonly productCode: string; readonly quantity: number }[];
  /** 注文時刻。`ctx.now()` を route が詰める */
  readonly at: Date;
};

/** 検証済みコマンド。ここから先は branded 型しか流れない */
export type ValidatedPlaceExampleOrderCommand = {
  readonly draft: DraftOrder;
  readonly at: Date;
};

/**
 * 商品マスタを引き終えた中間状態。
 * ここから先の分岐（在庫チェック・値付け）は IO を必要としない。
 */
export type ResolvedOrder = {
  readonly draft: DraftOrder;
  readonly products: ReadonlyMap<ProductCode, Product>;
  readonly at: Date;
};

// --- 出力（ドメインイベント） ---
// 永続化はこのイベント列を受けて route 側で 1 回の db.batch() にまとめる。

export type ExampleOrderPlaced = {
  readonly kind: 'ExampleOrderPlaced';
  readonly order: PlacedOrder;
};

/** 明細ごとに 1 つ。route はこれを在庫の減算クエリに落とす */
export type StockReserved = {
  readonly kind: 'StockReserved';
  readonly productCode: ProductCode;
  readonly quantity: Quantity;
};

export type PlaceExampleOrderEvent = ExampleOrderPlaced | StockReserved;

/**
 * ワークフローが必要とする IO 依存。エラー型 `E` は型引数にして、
 * 依存側のエラー（D1Error など）をそのまま通す。
 * 「引けなかったコードがある＝エラー」の判断は repository ではなくワークフローが持つので、
 * ここでは見つかった Product だけを返す。
 */
export type FindProducts<E> = (codes: readonly ProductCode[]) => ResultAsync<readonly Product[], E>;

/** このワークフロー自身が出しうるエラー + 依存側のエラー */
export type PlaceExampleOrderError<E> =
  | ValidationError
  | OrderLimitExceeded
  | ProductNotFound
  | InsufficientStock
  | E;

export type PlaceExampleOrderWorkflow<E> = (
  command: PlaceExampleOrderCommand,
) => ResultAsync<readonly PlaceExampleOrderEvent[], PlaceExampleOrderError<E>>;
