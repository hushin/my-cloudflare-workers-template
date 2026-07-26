/**
 * 注文を確定するワークフロー（DMMF の Place Order）。
 *
 * validate → resolve（IO）→ 在庫チェック → 値付け → イベント化 を Result で繋ぐ。
 * どのステップで落ちてもエラーが Err として最後まで運ばれ、後続は実行されない
 * （Railway Oriented Programming）。DB には触らず、出力はドメインイベントの列。
 */
import { ok } from '@/worker/lib/result';
import { checkStock, priceOrder, resolveProducts, toEvents, validateCommand } from './steps';
import type { FindProducts, PlaceExampleOrderWorkflow } from './types';

export const placeExampleOrderWorkflow =
  <E>(findProducts: FindProducts<E>): PlaceExampleOrderWorkflow<E> =>
  (command) =>
    ok(command)
      .andThen(validateCommand)
      .asyncAndThen(resolveProducts(findProducts))
      .andThen(checkStock)
      .andThen(priceOrder)
      .map(toEvents);

export type * from './types';
