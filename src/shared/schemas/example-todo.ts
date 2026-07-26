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
  title: z.string().min(1).max(200),
});

export const exampleTodoUpdateSchema = z.object({
  title: z.string().min(1).max(200),
});

export const exampleTodoStatusSchema = z.enum(['active', 'completed']);

export type ExampleTodoStatusDto = z.infer<typeof exampleTodoStatusSchema>;

export const exampleTodoStatusUpdateSchema = z.object({
  status: exampleTodoStatusSchema,
});
