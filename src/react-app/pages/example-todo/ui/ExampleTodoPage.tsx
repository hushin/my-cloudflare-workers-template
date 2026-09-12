import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useState } from 'react';
import { client } from '@/react-app/shared/api';
import { cn } from '@/react-app/shared/lib';
import { Button, Input } from '@/react-app/shared/ui';
import { exampleTodoCreateSchema, exampleTodoUpdateSchema } from '@/shared/schemas/example-todo';

function getErrorMessage(err: unknown): string {
  if (
    err != null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof err.message === 'string'
  ) {
    return err.message;
  }
  return '';
}

const exampleTodoQueryKey = ['example-todo'];

type ExampleTodo = InferResponseType<(typeof client.api)['example-todo']['$get'], 200>[number];

export function ExampleTodoPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const todosQuery = useQuery({
    queryKey: exampleTodoQueryKey,
    queryFn: async () => {
      const res = await client.api['example-todo'].$get();
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      await client.api['example-todo'].$post({ json: { title } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: exampleTodoQueryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await client.api['example-todo'][':id'].$put({ param: { id }, json: { title } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: exampleTodoQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.api['example-todo'][':id'].$delete({ param: { id } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: exampleTodoQueryKey });
    },
  });

  const todos = todosQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Example Todo</h1>
        {todosQuery.isSuccess && (
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{todos.length} 件</p>
        )}
      </header>

      <TodoComposer
        onCreate={(title) => createMutation.mutateAsync(title)}
        isSubmitting={createMutation.isPending}
      />

      {todosQuery.isPending ? (
        <TodoListSkeleton />
      ) : todosQuery.isError ? (
        <TodoListError
          onRetry={() => void todosQuery.refetch()}
          isRetrying={todosQuery.isFetching}
        />
      ) : todos.length === 0 ? (
        <TodoListEmpty />
      ) : (
        <ul className="animate-in fade-in-0 divide-y divide-border border-t border-border duration-300 motion-reduce:animate-none">
          {todos.map((todo) =>
            editingId === todo.id ? (
              <EditTodoItem
                key={todo.id}
                todo={todo}
                onSave={(title) => updateMutation.mutateAsync({ id: todo.id, title })}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <TodoItem
                key={todo.id}
                todo={todo}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === todo.id}
                onEdit={() => setEditingId(todo.id)}
                onDelete={() => deleteMutation.mutate(todo.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function TodoComposer({
  onCreate,
  isSubmitting,
}: {
  onCreate: (title: string) => Promise<unknown>;
  isSubmitting: boolean;
}) {
  const form = useForm({
    defaultValues: { title: '' },
    validators: {
      onChange: exampleTodoCreateSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      await onCreate(value.title);
      formApi.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="title"
        validators={{
          onChange: exampleTodoCreateSchema.shape.title,
        }}
      >
        {(field) => {
          const error = field.state.meta.errors.map((e) => getErrorMessage(e)).join(', ');

          return (
            <div className="flex flex-col gap-2">
              <div
                data-invalid={error.length > 0 || undefined}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 pl-4 shadow-sm transition-[border-color,box-shadow]',
                  'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50',
                  'data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20',
                  'data-invalid:has-[input:focus-visible]:border-destructive data-invalid:has-[input:focus-visible]:ring-destructive/20',
                )}
              >
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="新しいタスクを入力"
                  aria-label="新しいタスク"
                  aria-invalid={error.length > 0 || undefined}
                  className="h-9 border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0 aria-invalid:ring-0 md:text-base dark:bg-transparent"
                />
                <Button type="submit" size="lg" disabled={isSubmitting} className="shrink-0 px-4">
                  {isSubmitting ? '追加中…' : '追加'}
                </Button>
              </div>
              {error.length > 0 && <p className="px-1 text-sm text-destructive">{error}</p>}
            </div>
          );
        }}
      </form.Field>
    </form>
  );
}

function TodoItem({
  todo,
  isDeleting,
  onEdit,
  onDelete,
}: {
  todo: ExampleTodo;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        'group flex items-start gap-4 py-3.5 transition-opacity',
        isDeleting && 'opacity-40',
      )}
    >
      <span className="min-w-0 flex-1 text-sm leading-6 font-medium wrap-break-word">
        {todo.title}
      </span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          編集
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          削除
        </Button>
      </div>
    </li>
  );
}

function EditTodoItem({
  todo,
  onSave,
  onDone,
}: {
  todo: ExampleTodo;
  onSave: (title: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const form = useForm({
    defaultValues: { title: todo.title },
    validators: {
      onChange: exampleTodoUpdateSchema,
    },
    onSubmit: async ({ value }) => {
      await onSave(value.title);
      onDone();
    },
  });

  return (
    <li className="py-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
          }
        }}
      >
        <form.Field
          name="title"
          validators={{
            onChange: exampleTodoUpdateSchema.shape.title,
          }}
        >
          {(field) => {
            const error = field.state.meta.errors.map((e) => getErrorMessage(e)).join(', ');

            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-label="タスク名"
                    aria-invalid={error.length > 0 || undefined}
                    className="h-10 flex-1"
                  />
                  <Button type="submit" size="lg" disabled={form.state.isSubmitting}>
                    保存
                  </Button>
                  <Button type="button" variant="ghost" size="lg" onClick={onDone}>
                    キャンセル
                  </Button>
                </div>
                {error.length > 0 && <p className="px-1 text-sm text-destructive">{error}</p>}
              </div>
            );
          }}
        </form.Field>
      </form>
    </li>
  );
}

function TodoListSkeleton() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="divide-y divide-border border-t border-border"
    >
      {['w-3/5', 'w-2/5', 'w-1/2'].map((width) => (
        <div key={width} className="flex items-center py-4">
          <div className={cn('h-5 animate-pulse rounded-full bg-foreground/10', width)} />
        </div>
      ))}
    </div>
  );
}

function TodoListEmpty() {
  return (
    <div className="border-t border-border py-10">
      <p className="text-sm font-medium">タスクはまだありません</p>
      <p className="mt-1 text-sm text-muted-foreground">上の入力欄から追加できます。</p>
    </div>
  );
}

function TodoListError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4 border-t border-border py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">タスクを読み込めませんでした</p>
        <p className="text-sm text-muted-foreground">
          通信に失敗しました。もう一度お試しください。
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? '再試行中…' : '再試行'}
      </Button>
    </div>
  );
}
