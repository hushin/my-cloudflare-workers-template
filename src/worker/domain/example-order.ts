/**
 * ExampleOrder 集約。DMMF の Place Order ワークフローを最小化した題材。
 *
 * IO を一切含まない。drizzle / hono / @cloudflare/* を import してはいけない。
 * 型定義と、その型に適用する関数を同じファイルに置く。
 */
import { type Result, err, ok } from '@/worker/lib/result';
import { OrderLimitExceeded, ValidationError } from './errors';

// --- 値オブジェクト ---
// brand 用の symbol は export しない（生成はこのファイルのコンストラクタ経由だけになる）。

const orderIdBrand = Symbol();
export type OrderId = string & { [orderIdBrand]: unknown };

export const OrderId = (raw: string): Result<OrderId, ValidationError> =>
  raw.length > 0
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as OrderId)
    : err(new ValidationError('注文 id を指定してください'));

const productCodeBrand = Symbol();
export type ProductCode = string & { [productCodeBrand]: unknown };

const PRODUCT_CODE_PATTERN = /^[A-Z0-9-]{1,20}$/;

export const ProductCode = (raw: string): Result<ProductCode, ValidationError> =>
  PRODUCT_CODE_PATTERN.test(raw)
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as ProductCode)
    : err(new ValidationError(`商品コードの形式が不正です: ${raw}`));

const quantityBrand = Symbol();
/** 明細 1 行の数量。1〜99 なので 0 を表現できない（在庫数には使えない） */
export type Quantity = number & { [quantityBrand]: unknown };

export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;

export const Quantity = (raw: number): Result<Quantity, ValidationError> =>
  Number.isInteger(raw) && raw >= QUANTITY_MIN && raw <= QUANTITY_MAX
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as Quantity)
    : err(new ValidationError(`数量は${QUANTITY_MIN}〜${QUANTITY_MAX}の整数にしてください`));

const stockCountBrand = Symbol();
/** 在庫数。0 を取りうるので Quantity とは別の型にする */
export type StockCount = number & { [stockCountBrand]: unknown };

export const StockCount = (raw: number): Result<StockCount, ValidationError> =>
  Number.isInteger(raw) && raw >= 0
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as StockCount)
    : err(new ValidationError(`在庫数は 0 以上の整数にしてください: ${raw}`));

const moneyBrand = Symbol();
/** 金額（円）。小数を持たない */
export type Money = number & { [moneyBrand]: unknown };

export const Money = (raw: number): Result<Money, ValidationError> =>
  Number.isInteger(raw) && raw >= 0
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- brand 付与
      ok(raw as Money)
    : err(new ValidationError(`金額は 0 以上の整数にしてください: ${raw}`));

// --- 明細 ---

/** まだ値付けされていない明細。DraftOrder が持つ */
export type OrderLine = {
  readonly productCode: ProductCode;
  readonly quantity: Quantity;
};

/** 値付け済みの明細。単価は注文時点の値を焼き付ける */
export type PricedOrderLine = OrderLine & {
  readonly unitPrice: Money;
  readonly lineAmount: Money;
};

/** 商品マスタの読み取り結果。集約ではないので id を持たない */
export type Product = {
  readonly code: ProductCode;
  readonly name: string;
  readonly unitPrice: Money;
  readonly stock: StockCount;
};

// --- エンティティ ---
// Draft は永続化しない中間状態。Placed / Cancelled が行に対応する。
// cancelledAt は Cancelled のときにしか存在しないので Placed 側には持たせない。

export type DraftOrder = {
  readonly status: 'Draft';
  readonly id: OrderId;
  readonly lines: readonly OrderLine[];
};

export type PlacedOrder = {
  readonly status: 'Placed';
  readonly id: OrderId;
  readonly lines: readonly PricedOrderLine[];
  readonly totalAmount: Money;
  readonly placedAt: Date;
};

export type CancelledOrder = Omit<PlacedOrder, 'status'> & {
  readonly status: 'Cancelled';
  readonly cancelledAt: Date;
};

export type ExampleOrder = DraftOrder | PlacedOrder | CancelledOrder;

/**
 * 行として存在しうる状態。Draft は永続化しないので含まない。
 * repository の戻り値をこの型にしておくと、「読み出したら Draft だった」場合の
 * ありえない分岐を route に書かなくて済む。
 */
export type PersistedExampleOrder = PlacedOrder | CancelledOrder;

export type ExampleOrderStatus = ExampleOrder['status'];

// --- 集約の不変条件 ---

/** 1 注文の合計数量の上限。明細ごとの Quantity とは別次元の制約なので専用のエラー型にする */
export const ORDER_TOTAL_QUANTITY_MAX = 100;

export const draftOrder = (
  id: OrderId,
  lines: readonly OrderLine[],
): Result<DraftOrder, ValidationError | OrderLimitExceeded> => {
  if (lines.length === 0) {
    return err(new ValidationError('明細を 1 行以上指定してください'));
  }
  const codes = new Set(lines.map((line) => line.productCode));
  if (codes.size !== lines.length) {
    return err(new ValidationError('同じ商品コードの明細が重複しています'));
  }
  const totalQuantity = lines.reduce<number>((sum, line) => sum + line.quantity, 0);
  if (totalQuantity > ORDER_TOTAL_QUANTITY_MAX) {
    return err(
      new OrderLimitExceeded(
        `1 注文の合計数量は${ORDER_TOTAL_QUANTITY_MAX}までです: ${totalQuantity}`,
      ),
    );
  }
  return ok({ status: 'Draft', id, lines });
};

// --- 状態遷移 ---
// 遷移前の状態が引数に、遷移後の状態が戻り値に現れる。ミューテーションはしない。

/** 明細に単価を当てて金額を確定する。数量 × 単価なので 0 以上に収まる */
export const priceLine = (
  line: OrderLine,
  unitPrice: Money,
): Result<PricedOrderLine, ValidationError> =>
  Money(unitPrice * line.quantity).map((lineAmount) => ({ ...line, unitPrice, lineAmount }));

/** 在庫が数量を満たしているか。満たさない行は呼び出し側（ワークフロー）がエラーにする */
export const hasEnoughStock = (product: Product, quantity: Quantity): boolean =>
  product.stock >= quantity;

/** 値付け済みの明細から注文を確定する。合計金額はここで一度だけ計算する */
export const place = (
  draft: DraftOrder,
  lines: readonly PricedOrderLine[],
  at: Date,
): Result<PlacedOrder, ValidationError> =>
  Money(lines.reduce<number>((sum, line) => sum + line.lineAmount, 0)).map((totalAmount) => ({
    status: 'Placed',
    id: draft.id,
    lines,
    totalAmount,
    placedAt: at,
  }));

/** 取り消す。PlacedOrder しか受け取らないので「二重キャンセル」は型で書けない。 */
export const cancel = (order: PlacedOrder, at: Date): CancelledOrder => ({
  ...order,
  status: 'Cancelled',
  cancelledAt: at,
});
