import {
  type OrderLine,
  OrderId,
  type PlacedOrder,
  type PricedOrderLine,
  ProductCode,
  Quantity,
  draftOrder,
  hasEnoughStock,
  place,
  priceLine,
} from '@/worker/domain/example-order';
import {
  InsufficientStock,
  type OrderLimitExceeded,
  ProductNotFound,
  ValidationError,
} from '@/worker/domain/errors';
import { Result, type ResultAsync, err, ok, okOr } from '@/worker/lib/result';
import type {
  FindProducts,
  PlaceExampleOrderCommand,
  PlaceExampleOrderEvent,
  ResolvedOrder,
  ValidatedPlaceExampleOrderCommand,
} from './types';

/** DTO 由来の生の値をドメインの値オブジェクトに変換する。brand が付くのはここだけ。 */
export const validateCommand = (
  command: PlaceExampleOrderCommand,
): Result<ValidatedPlaceExampleOrderCommand, ValidationError | OrderLimitExceeded> =>
  Result.combine(
    command.lines.map((line): Result<OrderLine, ValidationError> =>
      ProductCode(line.productCode).andThen((productCode) =>
        Quantity(line.quantity).map((quantity) => ({ productCode, quantity })),
      ),
    ),
  )
    .andThen((lines) => OrderId(command.orderId).andThen((id) => draftOrder(id, lines)))
    .map((draft) => ({ draft, at: command.at }));

/**
 * 明細の商品コードで商品マスタを引く。
 * 1 行ずつ引かず、コードをまとめて 1 クエリに渡す（N+1 を作らない）。
 */
export const resolveProducts =
  <E>(findProducts: FindProducts<E>) =>
  (command: ValidatedPlaceExampleOrderCommand): ResultAsync<ResolvedOrder, E | ProductNotFound> => {
    const codes = command.draft.lines.map((line) => line.productCode);
    return findProducts(codes).andThen((products) => {
      const byCode = new Map(products.map((product) => [product.code, product]));
      const missing = codes.filter((code) => !byCode.has(code));
      return missing.length > 0
        ? err(new ProductNotFound(`商品が見つかりません: ${missing.join(', ')}`))
        : ok({ draft: command.draft, products: byCode, at: command.at });
    });
  };

/**
 * 在庫を検査する。最初に足りなかった行で打ち切る。
 * `products` の欠けは resolveProducts が弾いているので、ここでは取れた行だけを見る。
 */
export const checkStock = (resolved: ResolvedOrder): Result<ResolvedOrder, InsufficientStock> => {
  for (const line of resolved.draft.lines) {
    const product = resolved.products.get(line.productCode);
    if (product && !hasEnoughStock(product, line.quantity)) {
      return err(
        new InsufficientStock(
          `在庫が不足しています: ${line.productCode}（在庫 ${product.stock} / 注文 ${line.quantity}）`,
        ),
      );
    }
  }
  return ok(resolved);
};

/** 商品マスタの単価を明細に焼き付け、注文を確定する。 */
export const priceOrder = ({
  draft,
  products,
  at,
}: ResolvedOrder): Result<PlacedOrder, ValidationError> =>
  Result.combine(
    draft.lines.map((line): Result<PricedOrderLine, ValidationError> =>
      okOr(
        products.get(line.productCode),
        () => new ValidationError(`商品が解決されていません: ${line.productCode}`),
      ).andThen((product) => priceLine(line, product.unitPrice)),
    ),
  ).andThen((lines) => place(draft, lines, at));

export const toEvents = (order: PlacedOrder): readonly PlaceExampleOrderEvent[] => [
  { kind: 'ExampleOrderPlaced', order },
  ...order.lines.map((line): PlaceExampleOrderEvent => ({
    kind: 'StockReserved',
    productCode: line.productCode,
    quantity: line.quantity,
  })),
];
