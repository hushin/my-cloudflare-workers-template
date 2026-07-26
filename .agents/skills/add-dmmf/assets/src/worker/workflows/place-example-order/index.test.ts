/**
 * ワークフローのテスト。IO 依存は高階関数で差し込むので D1 も Worker の env も要らない。
 */
import { Money, ProductCode, StockCount, type Product } from '@/worker/domain/example-order';
import { D1Error } from '@/worker/db/errors';
import { errAsync, okAsync } from '@/worker/lib/result';
import { placeExampleOrderWorkflow } from './index';
import type { FindProducts } from './types';

const product = (code: string, unitPrice: number, stock: number): Product => ({
  code: ProductCode(code)._unsafeUnwrap(),
  name: code,
  unitPrice: Money(unitPrice)._unsafeUnwrap(),
  stock: StockCount(stock)._unsafeUnwrap(),
});

const catalog = [product('WIDGET-A', 1200, 10), product('WIDGET-B', 3400, 1)];

const findStub =
  (products: readonly Product[] = catalog): FindProducts<never> =>
  (codes) =>
    okAsync(products.filter((p) => codes.includes(p.code)));

const at = new Date('2026-02-03T04:05:06.000Z');

const command = (lines: readonly { productCode: string; quantity: number }[]) => ({
  orderId: 'order-1',
  lines,
  at,
});

describe('placeExampleOrderWorkflow', () => {
  it('注文が確定し、確定イベントと明細ごとの在庫確保イベントを返す', async () => {
    const workflow = placeExampleOrderWorkflow(findStub());

    const result = await workflow(
      command([
        { productCode: 'WIDGET-A', quantity: 2 },
        { productCode: 'WIDGET-B', quantity: 1 },
      ]),
    );

    const events = result._unsafeUnwrap();
    expect(events.map((e) => e.kind)).toEqual([
      'ExampleOrderPlaced',
      'StockReserved',
      'StockReserved',
    ]);
    const placed = events[0];
    expect(placed.kind === 'ExampleOrderPlaced' && placed.order.totalAmount).toBe(2 * 1200 + 3400);
    expect(placed.kind === 'ExampleOrderPlaced' && placed.order.placedAt).toEqual(at);
  });

  it('注文時点の単価が明細に焼き付く', async () => {
    const workflow = placeExampleOrderWorkflow(findStub());

    const result = await workflow(command([{ productCode: 'WIDGET-A', quantity: 3 }]));

    const placed = result._unsafeUnwrap()[0];
    expect(placed.kind === 'ExampleOrderPlaced' && placed.order.lines[0]).toMatchObject({
      unitPrice: 1200,
      lineAmount: 3600,
    });
  });

  it('商品コードの形式が不正なら ValidationError（IO を呼ばずに落ちる）', async () => {
    let called = 0;
    const workflow = placeExampleOrderWorkflow((codes) => {
      called += 1;
      return okAsync(catalog.filter((p) => codes.includes(p.code)));
    });

    const result = await workflow(command([{ productCode: 'widget a', quantity: 1 }]));

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(called).toBe(0);
  });

  it('合計数量が上限を超えたら OrderLimitExceeded（IO を呼ばずに落ちる）', async () => {
    let called = 0;
    const workflow = placeExampleOrderWorkflow((codes) => {
      called += 1;
      return okAsync(catalog.filter((p) => codes.includes(p.code)));
    });

    const result = await workflow(
      command([
        { productCode: 'WIDGET-A', quantity: 60 },
        { productCode: 'WIDGET-B', quantity: 60 },
      ]),
    );

    expect(result._unsafeUnwrapErr().type).toBe('OrderLimitExceeded');
    expect(called).toBe(0);
  });

  it('商品マスタに無いコードは ProductNotFound', async () => {
    const workflow = placeExampleOrderWorkflow(findStub());

    const result = await workflow(command([{ productCode: 'NOPE', quantity: 1 }]));

    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe('ProductNotFound');
    expect(error.message).toContain('NOPE');
  });

  it('在庫が足りなければ InsufficientStock', async () => {
    const workflow = placeExampleOrderWorkflow(findStub());

    const result = await workflow(command([{ productCode: 'WIDGET-B', quantity: 2 }]));

    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe('InsufficientStock');
    expect(error.message).toContain('WIDGET-B');
  });

  it('依存側のエラー（D1Error）はそのまま通り抜ける', async () => {
    const workflow = placeExampleOrderWorkflow<D1Error>(() =>
      errAsync(new D1Error(new Error('boom'))),
    );

    const result = await workflow(command([{ productCode: 'WIDGET-A', quantity: 1 }]));

    expect(result._unsafeUnwrapErr().type).toBe('D1Error');
  });

  it('明細の商品コードは 1 回のクエリでまとめて引く（N+1 にしない）', async () => {
    const calls: string[][] = [];
    const workflow = placeExampleOrderWorkflow((codes) => {
      calls.push([...codes]);
      return okAsync(catalog.filter((p) => codes.includes(p.code)));
    });

    await workflow(
      command([
        { productCode: 'WIDGET-A', quantity: 1 },
        { productCode: 'WIDGET-B', quantity: 1 },
      ]),
    );

    expect(calls).toEqual([['WIDGET-A', 'WIDGET-B']]);
  });
});
