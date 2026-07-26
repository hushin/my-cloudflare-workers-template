/**
 * 確定済みの注文を取り消すワークフロー。
 *
 * 出力はドメインイベントの列（注文の取消 + 明細ごとの在庫戻し）。
 * 永続化はワークフローの外（route）で 1 回の `db.batch()` にまとめる。
 */
import { ok } from '@/worker/lib/result';
import {
  applyCancel,
  ensureCancellable,
  loadExampleOrder,
  toEvents,
  validateCommand,
} from './steps';
import type { CancelExampleOrderWorkflow, FindExampleOrder } from './types';

export const cancelExampleOrderWorkflow =
  <E>(findExampleOrder: FindExampleOrder<E>): CancelExampleOrderWorkflow<E> =>
  (command) =>
    ok(command)
      .andThen(validateCommand)
      .asyncAndThen(loadExampleOrder(findExampleOrder))
      .andThen((loaded) => ensureCancellable(loaded).map((order) => applyCancel(order, loaded.at)))
      .map(toEvents);

export type * from './types';
