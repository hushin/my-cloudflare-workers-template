/**
 * ワークフローのテスト。IO 依存は高階関数で差し込むので D1 も Worker の env も要らない。
 */
import {
  Money,
  OrderId,
  type PersistedExampleOrder,
  type PlacedOrder,
  ProductCode,
  Quantity,
  cancel,
  draftOrder,
  place,
  priceLine,
} from '@/worker/domain/example-order';
import { EntityNotFound } from '@/worker/domain/errors';
import { errAsync, okAsync } from '@/worker/lib/result';
import { cancelExampleOrderWorkflow } from './index';
import type { FindExampleOrder } from './types';

const id = OrderId('order-1')._unsafeUnwrap();
const codeA = ProductCode('WIDGET-A')._unsafeUnwrap();
const placedAt = new Date('2026-02-03T04:05:06.000Z');
const at = new Date('2026-03-04T00:00:00.000Z');

const line = {
  productCode: codeA,
  quantity: Quantity(2)._unsafeUnwrap(),
};

const placed: PlacedOrder = place(
  draftOrder(id, [line])._unsafeUnwrap(),
  [priceLine(line, Money(1200)._unsafeUnwrap())._unsafeUnwrap()],
  placedAt,
)._unsafeUnwrap();

const findStub =
  (order: PersistedExampleOrder): FindExampleOrder<never> =>
  () =>
    okAsync(order);

describe('cancelExampleOrderWorkflow', () => {
  it('取消イベントと明細ごとの在庫戻しイベントを返す', async () => {
    const workflow = cancelExampleOrderWorkflow(findStub(placed));

    const result = await workflow({ id: 'order-1', at });

    const events = result._unsafeUnwrap();
    expect(events.map((e) => e.kind)).toEqual(['ExampleOrderCancelled', 'StockReleased']);
    const cancelled = events[0];
    expect(cancelled.kind === 'ExampleOrderCancelled' && cancelled.order.cancelledAt).toEqual(at);
    expect(events[1]).toEqual({ kind: 'StockReleased', productCode: codeA, quantity: 2 });
  });

  it('すでに取消済みなら ValidationError（二重キャンセルを止める）', async () => {
    const workflow = cancelExampleOrderWorkflow(findStub(cancel(placed, at)));

    const result = await workflow({ id: 'order-1', at: new Date() });

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
  });

  it('id が空なら ValidationError（IO を呼ばずに落ちる）', async () => {
    let called = 0;
    const workflow = cancelExampleOrderWorkflow(() => {
      called += 1;
      return okAsync(placed);
    });

    const result = await workflow({ id: '', at });

    expect(result._unsafeUnwrapErr().type).toBe('ValidationError');
    expect(called).toBe(0);
  });

  it('存在しない id は EntityNotFound', async () => {
    const workflow = cancelExampleOrderWorkflow<EntityNotFound>(() =>
      errAsync(new EntityNotFound('not found')),
    );

    const result = await workflow({ id: 'missing', at });

    expect(result._unsafeUnwrapErr().type).toBe('EntityNotFound');
  });
});
