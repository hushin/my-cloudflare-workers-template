/**
 * ドメイン層のテスト。IO を含まないので env も D1 も要らない。
 */
import {
  Money,
  ORDER_TOTAL_QUANTITY_MAX,
  OrderId,
  ProductCode,
  Quantity,
  StockCount,
  cancel,
  draftOrder,
  hasEnoughStock,
  place,
  priceLine,
  type Product,
} from './example-order';

const id = OrderId('order-1')._unsafeUnwrap();
const codeA = ProductCode('WIDGET-A')._unsafeUnwrap();
const codeB = ProductCode('WIDGET-B')._unsafeUnwrap();
const at = new Date('2026-02-03T04:05:06.000Z');

const line = (code = codeA, quantity = 2) => ({
  productCode: code,
  quantity: Quantity(quantity)._unsafeUnwrap(),
});

describe('値オブジェクト', () => {
  it('ProductCode は英数と - のみ', () => {
    expect(ProductCode('WIDGET-A').isOk()).toBe(true);
    expect(ProductCode('widget a')._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(ProductCode('')._unsafeUnwrapErr().type).toBe('ValidationError');
  });

  it('Quantity は 1〜99 の整数', () => {
    expect(Quantity(1).isOk()).toBe(true);
    expect(Quantity(99).isOk()).toBe(true);
    expect(Quantity(0)._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(Quantity(100)._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(Quantity(1.5)._unsafeUnwrapErr().type).toBe('ValidationError');
  });

  it('StockCount は 0 を許すが Quantity は許さない', () => {
    expect(StockCount(0).isOk()).toBe(true);
    expect(StockCount(-1).isErr()).toBe(true);
  });

  it('Money は 0 以上の整数', () => {
    expect(Money(0).isOk()).toBe(true);
    expect(Money(-1).isErr()).toBe(true);
    expect(Money(1.5).isErr()).toBe(true);
  });
});

describe('draftOrder', () => {
  it('明細が空なら ValidationError', () => {
    expect(draftOrder(id, [])._unsafeUnwrapErr().type).toBe('ValidationError');
  });

  it('商品コードが重複していたら ValidationError', () => {
    const result = draftOrder(id, [line(codeA, 1), line(codeA, 2)]);
    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
  });

  it('合計数量が上限を超えたら OrderLimitExceeded（明細ごとの Quantity とは別の型）', () => {
    // 1 行の上限（99）は超えないが、合計は 100 を超える組み合わせ
    const result = draftOrder(id, [line(codeA, 60), line(codeB, 60)]);
    expect(result._unsafeUnwrapErr().type).toBe('OrderLimitExceeded');
  });

  it('合計数量が上限ぴったりなら通る', () => {
    const result = draftOrder(id, [line(codeA, 50), line(codeB, ORDER_TOTAL_QUANTITY_MAX - 50)]);
    expect(result._unsafeUnwrap().status).toBe('Draft');
  });
});

describe('値付けと確定', () => {
  it('priceLine は 単価 × 数量 を金額にする', () => {
    const priced = priceLine(line(codeA, 3), Money(1200)._unsafeUnwrap())._unsafeUnwrap();
    expect(priced.lineAmount).toBe(3600);
  });

  it('place は明細の金額を合計する', () => {
    const draft = draftOrder(id, [line(codeA, 2), line(codeB, 1)])._unsafeUnwrap();
    const lines = [
      priceLine(line(codeA, 2), Money(1200)._unsafeUnwrap())._unsafeUnwrap(),
      priceLine(line(codeB, 1), Money(3400)._unsafeUnwrap())._unsafeUnwrap(),
    ];

    const order = place(draft, lines, at)._unsafeUnwrap();

    expect(order.status).toBe('Placed');
    expect(order.totalAmount).toBe(2 * 1200 + 3400);
    expect(order.placedAt).toEqual(at);
  });
});

describe('hasEnoughStock', () => {
  const product = (stock: number): Product => ({
    code: codeA,
    name: 'Widget A',
    unitPrice: Money(1200)._unsafeUnwrap(),
    stock: StockCount(stock)._unsafeUnwrap(),
  });

  it('在庫が数量以上なら true（同数はちょうど足りる）', () => {
    expect(hasEnoughStock(product(2), line(codeA, 2).quantity)).toBe(true);
    expect(hasEnoughStock(product(1), line(codeA, 2).quantity)).toBe(false);
  });
});

describe('cancel', () => {
  it('Placed → Cancelled で cancelledAt が入り、placedAt は動かない', () => {
    const draft = draftOrder(id, [line(codeA, 1)])._unsafeUnwrap();
    const placed = place(
      draft,
      [priceLine(line(codeA, 1), Money(1200)._unsafeUnwrap())._unsafeUnwrap()],
      at,
    )._unsafeUnwrap();
    const cancelledAt = new Date('2026-03-04T00:00:00.000Z');

    const cancelled = cancel(placed, cancelledAt);

    expect(cancelled.status).toBe('Cancelled');
    expect(cancelled.cancelledAt).toEqual(cancelledAt);
    expect(cancelled.placedAt).toEqual(at);
    // 元のオブジェクトは変わらない（ミューテーションしない）
    expect(placed.status).toBe('Placed');
  });
});
