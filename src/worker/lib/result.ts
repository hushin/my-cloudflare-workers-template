/**
 * neverthrow の再 export と共通ヘルパ。
 *
 * domain / workflows / repositories はここ経由で import する。
 * Result ライブラリを差し替えたくなったときの影響範囲をこの1ファイルに閉じるため。
 */
import { type Result, err, ok } from 'neverthrow';

export {
  Result,
  ResultAsync,
  err,
  errAsync,
  fromPromise,
  fromSafePromise,
  fromThrowable,
  ok,
  okAsync,
} from 'neverthrow';

/**
 * null / undefined を Err に落とす。
 * repository の「見つからなければエラー」版（`getXxx`）を薄く重ねるのに使う。
 */
export const okOr = <T, E>(value: T | null | undefined, onMissing: () => E): Result<T, E> =>
  value == null ? err(onMissing()) : ok(value);
