import {
  type CancelledOrder,
  OrderId,
  type PlacedOrder,
  cancel,
} from '@/worker/domain/example-order';
import { ValidationError } from '@/worker/domain/errors';
import { type Result, type ResultAsync, err, ok } from '@/worker/lib/result';
import type {
  CancelExampleOrderCommand,
  CancelExampleOrderEvent,
  FindExampleOrder,
  LoadedExampleOrder,
  ValidatedCancelExampleOrderCommand,
} from './types';

export const validateCommand = (
  command: CancelExampleOrderCommand,
): Result<ValidatedCancelExampleOrderCommand, ValidationError> =>
  OrderId(command.id).map((id) => ({ id, at: command.at }));

export const loadExampleOrder =
  <E>(findExampleOrder: FindExampleOrder<E>) =>
  (command: ValidatedCancelExampleOrderCommand): ResultAsync<LoadedExampleOrder, E> =>
    findExampleOrder(command.id).map((order) => ({ order, at: command.at }));

/**
 * 取消可能かを判定して PlacedOrder に絞る。
 * `cancel` は PlacedOrder しか受け取らないので、二重キャンセルはここで止まる。
 */
export const ensureCancellable = ({
  order,
}: LoadedExampleOrder): Result<PlacedOrder, ValidationError> => {
  switch (order.status) {
    case 'Placed':
      return ok(order);
    case 'Cancelled':
      return err(new ValidationError(`すでに取消済みの注文です: ${order.id}`));
    // Draft は永続化しないので、読み出した注文が Draft になることは無い（型の網羅のため）
    default:
      return err(new ValidationError(`未確定の注文は取消できません: ${order.id}`));
  }
};

export const applyCancel = (order: PlacedOrder, at: Date): CancelledOrder => cancel(order, at);

export const toEvents = (order: CancelledOrder): readonly CancelExampleOrderEvent[] => [
  { kind: 'ExampleOrderCancelled', order },
  ...order.lines.map(
    (line): CancelExampleOrderEvent => ({
      kind: 'StockReleased',
      productCode: line.productCode,
      quantity: line.quantity,
    }),
  ),
];
