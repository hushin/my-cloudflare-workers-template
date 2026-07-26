/**
 * インフラ層のエラー。ドメインのエラー（domain/errors.ts）とは別に持つ。
 * ドメイン層はこれを知らない（repository の戻り値のエラー型として現れるだけ）。
 */
export class D1Error extends Error {
  readonly type = 'D1Error';

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'D1Error';
  }
}
