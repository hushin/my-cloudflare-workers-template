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

export type DomainError = ValidationError | EntityNotFound;
