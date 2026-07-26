/**
 * example-order の IO 境界。
 *
 * ここにビジネスロジックは書かない。zValidator で受けて DTO をコマンドに変換し、
 * ワークフローを呼び、返ってきたドメインイベント列を repository に渡して永続化し、
 * match で HTTP レスポンスに落とすだけ。
 * method chain を切ると Hono RPC の型が失われるので、繋げたまま書く。
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '@/worker/context';
import { OrderId, type PersistedExampleOrder } from '@/worker/domain/example-order';
import { ok } from '@/worker/lib/result';
import {
  findProducts,
  getExampleOrderById,
  saveOrderCancellation,
  saveOrderPlacement,
} from '@/worker/repositories/example-order';
import { cancelExampleOrderWorkflow } from '@/worker/workflows/cancel-example-order';
import { placeExampleOrderWorkflow } from '@/worker/workflows/place-example-order';
import {
  type ExampleOrderStatusDto,
  exampleOrderIdParamSchema,
  exampleOrderPlaceSchema,
} from '@/shared/schemas/example-order';
import { toErrorResponse } from './error';

type ExampleOrderDto = {
  id: string;
  status: ExampleOrderStatusDto;
  totalAmount: number;
  lines: {
    productCode: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
  }[];
};

/** ドメインオブジェクト → DTO。brand はここで剥がす（react-app に漏らさない）。 */
const toDto = (order: PersistedExampleOrder): ExampleOrderDto => ({
  id: order.id,
  status: order.status === 'Cancelled' ? 'cancelled' : 'placed',
  totalAmount: order.totalAmount,
  lines: order.lines.map((line) => ({
    productCode: line.productCode,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineAmount: line.lineAmount,
  })),
});

const app = new Hono<AppEnv>()
  .get('/:id', zValidator('param', exampleOrderIdParamSchema), async (c) => {
    const ctx = c.var.context;

    const result = await OrderId(c.req.valid('param').id).asyncAndThen(getExampleOrderById(ctx));

    return result.match(
      (order) => c.json(toDto(order)),
      (e) => {
        const { body, status } = toErrorResponse(e);
        return c.json(body, status);
      },
    );
  })
  // 注文の確定。id は DB の default ではなく ctx.newId() で採番する
  // （注文と明細を 1 回の batch で insert するには id が先に必要）
  .post('/', zValidator('json', exampleOrderPlaceSchema), async (c) => {
    const ctx = c.var.context;
    const workflow = placeExampleOrderWorkflow(findProducts(ctx));

    const result = await ok({
      orderId: ctx.newId(),
      lines: c.req.valid('json').lines,
      at: ctx.now(),
    })
      .asyncAndThen(workflow)
      .andThen(saveOrderPlacement(ctx));

    return result.match(
      (order) => c.json(toDto(order), 201),
      (e) => {
        const { body, status } = toErrorResponse(e);
        return c.json(body, status);
      },
    );
  })
  .post('/:id/cancel', zValidator('param', exampleOrderIdParamSchema), async (c) => {
    const ctx = c.var.context;
    const workflow = cancelExampleOrderWorkflow(getExampleOrderById(ctx));

    const result = await ok({ id: c.req.valid('param').id, at: ctx.now() })
      .asyncAndThen(workflow)
      .andThen(saveOrderCancellation(ctx));

    return result.match(
      (order) => c.json(toDto(order)),
      (e) => {
        const { body, status } = toErrorResponse(e);
        return c.json(body, status);
      },
    );
  });

export default app;
