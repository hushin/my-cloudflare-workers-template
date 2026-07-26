/**
 * エラー型 → HTTP レスポンスの変換。
 * 各ハンドラで分岐を書かず、ここ 1 箇所に集約する。
 */
import type { D1Error } from '@/worker/db/errors';
import type { DomainError } from '@/worker/domain/errors';

/** route が受け取りうるエラーの総体（ドメイン + インフラ） */
export type AppError = DomainError | D1Error;

export type ErrorResponse = {
  readonly body: { error: string };
  readonly status: 400 | 404 | 409 | 500;
};

/**
 * API の結果として表現しない失敗（データ不整合など）。
 * クライアントに選択肢は無いので Result を畳まずに throw し、Hono の 500 に載せる。
 * ドメイン層では throw しないが、IO 境界であるここは例外でよい。
 */
export const throwUnexpected = (error: AppError): never => {
  throw error;
};

/** 新しいエラー型を足したらここが型エラーになる（マッピング漏れの検出） */
const assertNever = (error: never): never => {
  throw error;
};

export const toErrorResponse = (error: AppError): ErrorResponse => {
  switch (error.type) {
    // 既存クライアントの互換のため body は { error: 'Not Found' } のまま
    case 'EntityNotFound':
      return { body: { error: 'Not Found' }, status: 404 };
    case 'ValidationError':
      return { body: { error: error.message }, status: 400 };
    // リクエストボディに含まれた商品コードが無い。URL のリソース不在（404）とは区別する
    case 'ProductNotFound':
      return { body: { error: error.message }, status: 400 };
    // 集約単位の上限違反
    case 'OrderLimitExceeded':
      return { body: { error: error.message }, status: 400 };
    // 入力は正しいがサーバ側の状態と衝突している
    case 'InsufficientStock':
      return { body: { error: error.message }, status: 409 };
    // D1 の失敗はクライアント起因ではないので詳細を返さない
    case 'D1Error':
      return { body: { error: 'Internal Server Error' }, status: 500 };
    default:
      return assertNever(error);
  }
};
