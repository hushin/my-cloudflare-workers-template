/**
 * repository のテスト。ワークフローを通さず直接呼び、
 * 「アプリ側の在庫チェックをすり抜けた場合」の振る舞い（DB の CHECK 制約）を確かめる。
 */
import { env } from 'cloudflare:test';
import { createContext } from '@/worker/context';
import {
  Money,
  OrderId,
  ProductCode,
  Quantity,
  draftOrder,
  place,
  priceLine,
} from '@/worker/domain/example-order';
import type { PlaceExampleOrderEvent } from '@/worker/workflows/place-example-order';
import { saveOrderPlacement } from './example-order';

const code = ProductCode('WIDGET-A')._unsafeUnwrap();
const at = new Date('2026-02-03T04:05:06.000Z');

/** 在庫チェックを通さずに「在庫 1 に対して 5 個」の注文イベントを組み立てる */
const overselling = (): readonly PlaceExampleOrderEvent[] => {
  const line = { productCode: code, quantity: Quantity(5)._unsafeUnwrap() };
  const draft = draftOrder(OrderId('order-1')._unsafeUnwrap(), [line])._unsafeUnwrap();
  const priced = priceLine(line, Money(1200)._unsafeUnwrap())._unsafeUnwrap();
  const order = place(draft, [priced], at)._unsafeUnwrap();
  return [
    { kind: 'ExampleOrderPlaced', order },
    { kind: 'StockReserved', productCode: code, quantity: line.quantity },
  ];
};

describe('saveOrderPlacement', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM example_order_lines');
    await env.DB.exec('DELETE FROM example_orders');
    await env.DB.exec('DELETE FROM example_products');
    await env.DB.exec(
      "INSERT INTO example_products (code, name, unit_price, stock) VALUES ('WIDGET-A', 'Widget A', 1200, 1)",
    );
  });

  it('在庫を割り込む更新は CHECK 制約で止まり InsufficientStock になる', async () => {
    const ctx = createContext(env);

    const result = await saveOrderPlacement(ctx)(overselling());

    expect(result._unsafeUnwrapErr().type).toBe('InsufficientStock');
  });

  it('batch なので注文・明細・在庫のどれも書かれていない', async () => {
    const ctx = createContext(env);

    await saveOrderPlacement(ctx)(overselling());

    const orders = await env.DB.prepare('SELECT count(*) as c FROM example_orders').first<{
      c: number;
    }>();
    const lines = await env.DB.prepare('SELECT count(*) as c FROM example_order_lines').first<{
      c: number;
    }>();
    const product = await env.DB.prepare(
      "SELECT stock FROM example_products WHERE code = 'WIDGET-A'",
    ).first<{ stock: number }>();

    expect(orders?.c).toBe(0);
    expect(lines?.c).toBe(0);
    expect(product?.stock).toBe(1);
  });
});
