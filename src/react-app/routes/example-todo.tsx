import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type { InferResponseType } from 'hono/client';
import { useState } from 'react';
import { client } from '@/react-app/client';
import { exampleTodoCreateSchema, exampleTodoUpdateSchema } from '@/schemas/example-todo';

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

export const Route = createFileRoute('/example-todo')({
  component: ExampleTodoPage,
});

const exampleTodoQueryKey = ['example-todo'];

type ExampleTodo = InferResponseType<(typeof client.api)['example-todo']['$get'], 200>[number];

function ExampleTodoPage() {
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
    <div className="page">
      <p>
        <Link to="/">Home</Link>
      </p>
      <h1>Example Todo</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void createForm.handleSubmit();
        }}
      >
        <createForm.Field
          name="title"
          validators={{
            onChange: exampleTodoCreateSchema.shape.title,
          }}
        >
          {(field) => (
            <>
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="New todo"
              />
              {field.state.meta.errors.length > 0 && (
                <span>{field.state.meta.errors.map((e) => getErrorMessage(e)).join(', ')}</span>
              )}
            </>
          )}
        </createForm.Field>
        <button type="submit">Add</button>
      </form>

      {todosQuery.isPending && <p>Loading...</p>}
      {todosQuery.isError && <p>Failed to load todos.</p>}

      <ul>
        {todosQuery.data?.map((todo) =>
          editingId === todo.id ? (
            <EditTodoRow key={todo.id} todo={todo} onDone={() => setEditingId(null)} />
          ) : (
            <li key={todo.id}>
              {todo.title}
              <button type="button" onClick={() => setEditingId(todo.id)}>
                Edit
              </button>
              <button type="button" onClick={() => deleteMutation.mutate(todo.id)}>
                Delete
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function EditTodoRow({ todo, onDone }: { todo: ExampleTodo; onDone: () => void }) {
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
    <li>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void editForm.handleSubmit();
        }}
      >
        <editForm.Field
          name="title"
          validators={{
            onChange: exampleTodoUpdateSchema.shape.title,
          }}
        >
          {(field) => (
            <>
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span>{field.state.meta.errors.map((e) => getErrorMessage(e)).join(', ')}</span>
              )}
            </>
          )}
        </editForm.Field>
        <button type="submit">Save</button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </form>
    </li>
  );
}
