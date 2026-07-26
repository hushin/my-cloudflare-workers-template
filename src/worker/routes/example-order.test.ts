import { z } from 'zod';
import { env } from 'cloudflare:test';
import { app } from '@/worker/index';

const orderSchema = z.object({
  id: z.string(),
  status: z.enum(['placed', 'cancelled']),
  totalAmount: z.number(),
  lines: z.array(
    z.object({
      productCode: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      lineAmount: z.number(),
    }),
  ),
});

const BASE = '/api/example-order';

// ApplicationContext を載せる middleware は index.ts で登録しているので、
// route 単体ではなくマウント済みの app 経由でリクエストする。
const placeOrder = (lines: readonly { productCode: string; quantity: number }[]) =>
  app.request(
    BASE,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    },
    env,
  );

const cancelOrder = (id: string) => app.request(`${BASE}/${id}/cancel`, { method: 'POST' }, env);

const stockOf = async (code: string) => {
  const row = await env.DB.prepare('SELECT stock FROM example_products WHERE code = ?')
    .bind(code)
    .first<{ stock: number }>();
  return row?.stock ?? null;
};

const countRows = async (table: string) => {
  const row = await env.DB.prepare(`SELECT count(*) as c FROM ${table}`).first<{ c: number }>();
  return row?.c ?? 0;
};

describe('example-order routes', () => {
  // D1 はテスト間で共有されるので、毎テスト前に行を消して商品マスタを作り直す。
  // migration 自体は setupFiles（src/worker/test/apply-migrations.ts）で適用済み。
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM example_order_lines');
    await env.DB.exec('DELETE FROM example_orders');
    await env.DB.exec('DELETE FROM example_products');
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO example_products (code, name, unit_price, stock) VALUES ('WIDGET-A', 'Widget A', 1200, 10)",
      ),
      env.DB.prepare(
        "INSERT INTO example_products (code, name, unit_price, stock) VALUES ('WIDGET-B', 'Widget B', 3400, 1)",
      ),
    ]);
  });

  it('POST / places an order and returns 201', async () => {
    const res = await placeOrder([
      { productCode: 'WIDGET-A', quantity: 2 },
      { productCode: 'WIDGET-B', quantity: 1 },
    ]);

    expect(res.status).toBe(201);
    const order = orderSchema.parse(await res.json());
    expect(order.status).toBe('placed');
    expect(order.totalAmount).toBe(2 * 1200 + 3400);
    expect(order.lines).toHaveLength(2);
  });

  it('POST / writes order, lines and stock in one batch', async () => {
    await placeOrder([{ productCode: 'WIDGET-A', quantity: 3 }]);

    expect(await countRows('example_orders')).toBe(1);
    expect(await countRows('example_order_lines')).toBe(1);
    expect(await stockOf('WIDGET-A')).toBe(7);
  });

  it('POST / with unknown product code returns 400 and writes nothing', async () => {
    const res = await placeOrder([{ productCode: 'NOPE', quantity: 1 }]);

    expect(res.status).toBe(400);
    expect(await countRows('example_orders')).toBe(0);
  });

  it('POST / with insufficient stock returns 409 and leaves stock untouched', async () => {
    const res = await placeOrder([{ productCode: 'WIDGET-B', quantity: 2 }]);

    expect(res.status).toBe(409);
    expect(await stockOf('WIDGET-B')).toBe(1);
    expect(await countRows('example_orders')).toBe(0);
  });

  it('POST / over the order quantity limit returns 400', async () => {
    await env.DB.exec('UPDATE example_products SET stock = 999');

    const res = await placeOrder([
      { productCode: 'WIDGET-A', quantity: 60 },
      { productCode: 'WIDGET-B', quantity: 60 },
    ]);

    expect(res.status).toBe(400);
  });

  it('POST / with a duplicated product code returns 400', async () => {
    const res = await placeOrder([
      { productCode: 'WIDGET-A', quantity: 1 },
      { productCode: 'WIDGET-A', quantity: 1 },
    ]);

    expect(res.status).toBe(400);
  });

  it('POST / with an empty lines array returns 400 (zValidator)', async () => {
    const res = await placeOrder([]);

    expect(res.status).toBe(400);
  });

  it('GET /:id returns the placed order with its lines', async () => {
    const placed = orderSchema.parse(
      await (await placeOrder([{ productCode: 'WIDGET-A', quantity: 2 }])).json(),
    );

    const res = await app.request(`${BASE}/${placed.id}`, {}, env);

    expect(res.status).toBe(200);
    const order = orderSchema.parse(await res.json());
    expect(order).toEqual(placed);
  });

  it('GET /:id returns 404 for an unknown id', async () => {
    const res = await app.request(`${BASE}/missing`, {}, env);

    expect(res.status).toBe(404);
  });

  it('POST /:id/cancel cancels the order and restores stock', async () => {
    const placed = orderSchema.parse(
      await (await placeOrder([{ productCode: 'WIDGET-A', quantity: 3 }])).json(),
    );
    expect(await stockOf('WIDGET-A')).toBe(7);

    const res = await cancelOrder(placed.id);

    expect(res.status).toBe(200);
    const order = orderSchema.parse(await res.json());
    expect(order.status).toBe('cancelled');
    // 明細は注文時点の値のまま残る
    expect(order.lines).toEqual(placed.lines);
    expect(await stockOf('WIDGET-A')).toBe(10);
  });

  it('POST /:id/cancel twice returns 400 and does not restore stock twice', async () => {
    const placed = orderSchema.parse(
      await (await placeOrder([{ productCode: 'WIDGET-A', quantity: 3 }])).json(),
    );
    await cancelOrder(placed.id);

    const res = await cancelOrder(placed.id);

    expect(res.status).toBe(400);
    expect(await stockOf('WIDGET-A')).toBe(10);
  });

  it('POST /:id/cancel returns 404 for an unknown id', async () => {
    const res = await cancelOrder('missing');

    expect(res.status).toBe(404);
  });
});
