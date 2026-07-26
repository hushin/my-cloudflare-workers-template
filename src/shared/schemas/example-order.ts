import { z } from 'zod';

/**
 * DTO のスキーマ。react-app からもそのまま import されるので、
 * zod の `.brand()` は使わずに素の DTO のまま保つ
 * （branded 型への変換は worker 側 workflow の validate ステップの仕事）。
 *
 * ここで表現するのは「JSON として受け付ける形」だけ。
 * 「1 注文の合計数量は 100 まで」のような集約単位のルールはドメイン側に書く
 * （zod に寄せると同じルールが 2 箇所に散る）。
 */

export const exampleOrderIdParamSchema = z.object({
  id: z.string().min(1),
});

export const exampleOrderLineSchema = z.object({
  productCode: z.string().min(1).max(20),
  quantity: z.number().int().min(1).max(99),
});

export const exampleOrderPlaceSchema = z.object({
  lines: z.array(exampleOrderLineSchema).min(1),
});

export const exampleOrderStatusSchema = z.enum(['placed', 'cancelled']);

export type ExampleOrderStatusDto = z.infer<typeof exampleOrderStatusSchema>;
