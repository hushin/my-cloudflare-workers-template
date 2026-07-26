/**
 * ドメイン層のエラー。
 *
 * ドメイン層では throw せず、これらを `Result` の Err として運ぶ。
 * `type` フィールドで判別できるようにしてあるので、HTTP へのマッピング
 * （`routes/error.ts`）を switch で網羅的に書ける。
 *
 * 「class を使わない」のはドメインオブジェクト（データ）の話。エラーは
 * stack trace が欲しいので Error を継承した class にしている。
 */

/** 入力値がドメインの制約を満たさない。HTTP では 400。 */
export class ValidationError extends Error {
  readonly type = 'ValidationError';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** 参照した集約が存在しない。HTTP では 404。 */
export class EntityNotFound extends Error {
  readonly type = 'EntityNotFound';

  constructor(message: string) {
    super(message);
    this.name = 'EntityNotFound';
  }
}

/**
 * 注文された商品コードが商品マスタに無い。HTTP では 400。
 *
 * 「参照した集約が無い」（EntityNotFound / 404）とは別の型にする。
 * URL で指定されたリソースではなくリクエストボディの中身が不正、という違い。
 */
export class ProductNotFound extends Error {
  readonly type = 'ProductNotFound';

  constructor(message: string) {
    super(message);
    this.name = 'ProductNotFound';
  }
}

/** 在庫が注文数量に足りない。入力は正しいがサーバの状態と衝突しているので 409。 */
export class InsufficientStock extends Error {
  readonly type = 'InsufficientStock';

  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStock';
  }
}

/** 集約単位の上限（1 注文の合計数量など）に違反した。HTTP では 400。 */
export class OrderLimitExceeded extends Error {
  readonly type = 'OrderLimitExceeded';

  constructor(message: string) {
    super(message);
    this.name = 'OrderLimitExceeded';
  }
}

export type DomainError =
  | ValidationError
  | EntityNotFound
  | ProductNotFound
  | InsufficientStock
  | OrderLimitExceeded;
