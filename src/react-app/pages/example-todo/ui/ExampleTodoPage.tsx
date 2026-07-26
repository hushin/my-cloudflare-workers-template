import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { InferResponseType } from 'hono/client';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Separator,
} from '@/react-app/shared/ui';
import { client } from '@/react-app/shared/api';
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

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'completed' }) => {
      await client.api['example-todo'][':id'].status.$patch({
        param: { id },
        json: { status },
      });
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

  const createForm = useForm({
    defaultValues: { title: '' },
    validators: {
      onChange: exampleTodoCreateSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      await createMutation.mutateAsync(value.title);
      formApi.reset();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Example Todo</h1>
        <p className="text-muted-foreground">
          <Link to="/" className="underline underline-offset-4 hover:text-foreground">
            Home
          </Link>{' '}
          に戻る
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>新規 Todo</CardTitle>
          <CardDescription>タイトルを入力して追加してください。</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void createForm.handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <createForm.Field
              name="title"
              validators={{
                onChange: exampleTodoCreateSchema.shape.title,
              }}
            >
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="New todo"
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors.map((e) => getErrorMessage(e)).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </createForm.Field>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                Add
              </Button>
              {createMutation.isPending && <Badge variant="secondary">Adding...</Badge>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-col gap-4">
        {todosQuery.isPending && <p className="text-muted-foreground">Loading...</p>}
        {todosQuery.isError && <p className="text-destructive">Failed to load todos.</p>}

        {todosQuery.data?.map((todo) =>
          editingId === todo.id ? (
            <EditTodoCard key={todo.id} todo={todo} onDone={() => setEditingId(null)} />
          ) : (
            <Card key={todo.id} className="flex justify-between p-4">
              <div className="flex items-center gap-2">
                <span
                  className={
                    todo.status === 'completed'
                      ? 'font-medium text-muted-foreground line-through'
                      : 'font-medium'
                  }
                >
                  {todo.title}
                </span>
                {todo.status === 'completed' && <Badge variant="secondary">Completed</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    statusMutation.mutate({
                      id: todo.id,
                      status: todo.status === 'completed' ? 'active' : 'completed',
                    })
                  }
                >
                  {todo.status === 'completed' ? 'Reopen' : 'Complete'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingId(todo.id)}>
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(todo.id)}
                  disabled={deleteMutation.isPending && deleteMutation.variables === todo.id}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}

function EditTodoCard({ todo, onDone }: { todo: ExampleTodo; onDone: () => void }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (title: string) => {
      await client.api['example-todo'][':id'].$put({ param: { id: todo.id }, json: { title } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: exampleTodoQueryKey });
      onDone();
    },
  });

  const editForm = useForm({
    defaultValues: { title: todo.title },
    validators: {
      onChange: exampleTodoUpdateSchema,
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync(value.title);
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void editForm.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <editForm.Field
            name="title"
            validators={{
              onChange: exampleTodoUpdateSchema.shape.title,
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-2">
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors.map((e) => getErrorMessage(e)).join(', ')}
                  </p>
                )}
              </div>
            )}
          </editForm.Field>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              Save
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
