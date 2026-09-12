import { z } from 'zod';

/**
 * DTO のスキーマ。react-app からもそのまま import されるので、
 * zod の `.brand()` は使わずに素の DTO のまま保つ
 * （branded 型への変換は worker 側 workflow の validate ステップの仕事）。
 */

export const exampleTodoIdParamSchema = z.object({
  id: z.string().min(1),
});

export const exampleTodoCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'タスク名を入力してください')
    .max(200, 'タスク名は200文字以内で入力してください'),
});

export const exampleTodoUpdateSchema = z.object({
  title: z
    .string()
    .min(1, 'タスク名を入力してください')
    .max(200, 'タスク名は200文字以内で入力してください'),
});

export const exampleTodoStatusSchema = z.enum(['active', 'completed']);

export type ExampleTodoStatusDto = z.infer<typeof exampleTodoStatusSchema>;

export const exampleTodoStatusUpdateSchema = z.object({
  status: exampleTodoStatusSchema,
});
