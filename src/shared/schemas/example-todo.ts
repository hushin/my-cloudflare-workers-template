import { z } from 'zod';

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
