import { z } from 'zod';

export const exampleTodoIdParamSchema = z.object({
  id: z.string().min(1),
});

export const exampleTodoCreateSchema = z.object({
  title: z.string().min(1).max(200),
});

export const exampleTodoUpdateSchema = z.object({
  title: z.string().min(1).max(200),
});
